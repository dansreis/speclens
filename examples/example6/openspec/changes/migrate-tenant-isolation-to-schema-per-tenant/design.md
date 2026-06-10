# Design — Migrate Tenant Isolation to Schema-Per-Tenant

## Context

The platform has run on Postgres row-level security since ADR-0005 (January 2026). RLS sized correctly for the projected 20–40 retailer tenants in the first 18 months. The platform is now at sixty-three active retailer tenants, with two enterprise pilots that will push past one hundred this year.

Three pressures combined to force the re-evaluation:

1. **Vacuum and index contention.** The largest catalog tables now carry rows for sixty-plus tenants in one physical table. Index size has crossed the working-set threshold for the smaller RDS classes; vacuum cycles routinely overlap with peak campaign-launch windows. We have already had two campaign-launch incidents traced to vacuum contention on `line_items`.
2. **Per-tenant migration risk.** Larger retailers want to pilot new features (new audience-segment types, new attribution models) ahead of platform-wide rollout. Under shared-schema RLS, any tenant-conditional DDL contaminates the global schema. We've been declining these pilots — losing competitive opportunities.
3. **Regulatory data-residency.** Two prospective European-region tenants require physical segregation of their data from US tenants. RLS does not satisfy auditors here; physical schema separation does.

ADR-0005's "Negative" consequence — "scaling past a few hundred tenants stresses the single-schema model" — has materialised earlier than expected because of (1) and (2), not just (3).

## Goals / Non-Goals

**Goals:**
- Each tenant's data lives in a physically separate Postgres schema.
- Vacuum and index contention bounded to a single tenant's data, not the platform total.
- Tenant-conditional DDL becomes safe — pilot features land in one tenant's schema without polluting others.
- Data-residency story: schemas can be moved to region-specific RDS instances without code changes.
- Migration is rollable forward tenant-by-tenant and rollable back per-tenant (a single tenant can revert without disturbing others).

**Non-Goals:**
- This change does not unify cross-tenant analytics. Cross-tenant rollups become explicit and more expensive — that's an accepted trade-off, documented in ADR-0009.
- This change does not move tenant data across RDS instances. Schemas live in the same instance post-migration; cross-instance moves are a separate follow-up.

## Decisions

### Decision: Schema-per-tenant on the existing RDS instance

Alternatives weighed:

| Architecture | Isolation | Migration cost | Cross-tenant query cost |
|---|---|---|---|
| Schema-per-tenant (chosen) | Strong (physical schemas) | Medium — per-tenant Flyway, one cluster | Medium — explicit materialised views |
| Database-per-tenant | Strongest (full DB isolation) | High — per-tenant RDS instance, ops nightmare at scale | High — cross-DB queries |
| Keep RLS, larger instance | Weak (shared physical tables) | Low | Low |

Schema-per-tenant is the cost-engineering middle ground that unblocks (1), (2), and (3) without the operational cost of database-per-tenant.

**Alternative considered and rejected:** **Keep RLS, scale vertically.** The RDS instance can absorb more load, but vertical scaling does not solve (2) or (3) — and (1) is structurally driven by vacuum overlap, which a larger instance does not fix.

### Decision: Per-tenant Flyway runner, not platform-wide DDL replay

DDL changes (column adds, index changes) will fan out across N tenant schemas. Two patterns were considered:

- **Per-tenant Flyway runner** — each tenant's schema has its own migration state; the runner applies pending migrations on each schema in turn.
- **Platform-wide DDL replay** — a single DDL transaction iterates every schema.

Per-tenant Flyway was chosen because it allows tenant-by-tenant migration windows. A long migration on Tenant A does not block Tenant B's deploys. The cost is migration-state bookkeeping for N schemas; tooling investment handles this.

### Decision: Materialised views in a shared `platform` schema for cross-tenant rollups

Cross-tenant analytics rollups (platform-wide CPM, retailer-comparison reports) cannot be a single SQL query under schema-per-tenant. Two options:

- **Application-layer rollups** — services fan out queries to every tenant schema, aggregate in application code.
- **Materialised views in `platform`** — a background refresher job aggregates from tenant schemas into materialised views in a shared schema; analytics queries read from the materialised view.

Materialised views win on query latency and complexity. The cost is materialised-view refresh scheduling — handled by a dedicated job per rollup.

## Risks / Trade-offs

- **[Risk] Connection-pool layer becomes more complex.** → Mitigation: replace pgbouncer + glue with a tenant-aware router service; team has prior experience.
- **[Risk] Per-tenant migration state can drift across tenants.** → Mitigation: drift-detection cron comparing migration version across schemas; alert if any tenant lags > 24h.
- **[Risk] Materialised-view refresh becomes a scheduling problem.** → Mitigation: per-rollup refresh schedule with explicit freshness SLOs; alert on staleness.
- **[Risk] Migration introduces a regression on tenant-isolation guarantees during dual-state.** → Mitigation: dual-state runs each query in both old (RLS) and new (schema-routed) modes and compares result sets row-for-row.

## Migration Plan

```
                  ┌─────────────────────┐
                  │  Platform (RLS)     │
                  │  shared schema      │
                  └──────────┬──────────┘
                             │
                             ▼  Week 0-2 — prep
                  ┌─────────────────────┐
                  │ Tenant-router stood │
                  │ up; per-tenant      │
                  │ Flyway runner ready │
                  └──────────┬──────────┘
                             │
                             ▼  Week 3-7 — per-tenant rollout
       ┌────────────────┬────────────────┬────────────────┐
       ▼                ▼                ▼                ▼
  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
  │ tenant  │      │ tenant  │      │ tenant  │      │ tenant  │
  │ schema  │      │ schema  │      │ schema  │ ...  │ schema  │
  │ A       │      │ B       │      │ C       │      │ N       │
  └─────────┘      └─────────┘      └─────────┘      └─────────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                             │
                             ▼  Week 8 — cleanup
                  ┌─────────────────────┐
                  │ RLS removed;        │
                  │ shared schema       │
                  │ holds only platform │
                  │ materialised views  │
                  └─────────────────────┘
```

Per-tenant rollout proceeds smallest-to-largest. Each tenant moves through:

1. **Provision** — create `tenant_<uuid>` schema, run Flyway from baseline.
2. **Backfill** — copy tenant's rows from shared tables into the new schema.
3. **Dual-state** — connection router sends reads to both old and new; compare; alert on divergence.
4. **Read-cutover** — connection router sends reads only to the new schema.
5. **Write-cutover** — connection router sends writes only to the new schema. Old rows in shared tables become read-only history.

Rollback per-tenant: route reads and writes back to the shared schema. The shared schema's data is not deleted until Week 8; per-tenant rollback is cheap until then.

## Open Questions

- **Storage for archived event data.** Event data (impressions, clicks) is already partitioned by day and tenant; do we move it into per-tenant schemas, or keep it in shared partitioned tables? Leaning toward keeping event data shared with RLS — it's append-only, doesn't suffer the vacuum problem, and cross-tenant analytics rely on it. Decide before Week 3.
- **Connection-router placement.** Stand-alone service vs library inside catalog-api. Service is more flexible but adds a network hop. Decision needed during Week 0–2.
- **ADR-0005 supersession.** This design proposes superseding ADR-0005 with ADR-0009 (Schema-per-tenant isolation). The adr step will record the new ADR.
