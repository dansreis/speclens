# 0009. Schema-per-tenant isolation

- Status: accepted, supersedes ADR-0005
- Date: 2026-05-30

Supersedes: ADR-0005

## Context

ADR-0005 chose Postgres row-level security as the tenant-isolation strategy, sized for the projected 20–40 retailer tenants in the first 18 months. The platform is now past that projection — sixty-three active retailer tenants, with two enterprise pilots that will push past one hundred this year.

Three pressures combined to force a re-evaluation:

1. **Vacuum and index contention.** The largest catalog tables now carry rows for sixty-plus tenants in one physical table. Index size has crossed the working-set threshold for the smaller RDS classes; vacuum cycles routinely overlap with peak campaign-launch windows.
2. **Per-tenant migration risk.** Some larger retailers want to pilot new features (new spec-driven workflows, new audience-segment types) ahead of platform-wide rollout. Under shared-schema RLS, any tenant-conditional DDL contaminates the global schema.
3. **Regulatory data-residency requirements.** Two prospective European-region tenants require their data to be physically segregated from US tenants. RLS does not satisfy auditors here; physical schema separation does.

ADR-0005's "Negative" consequence — that scaling past a few hundred tenants stresses the single-schema model — has materialised.

## Decision

Migrate tenant isolation from row-level security to **schema-per-tenant**. Each retailer tenant gets its own Postgres schema (`tenant_<uuid>`), populated by the same catalog DDL applied via a per-tenant Flyway runner. Cross-schema queries (analytics rollups) explicitly aggregate across tenant schemas via materialised views in a shared `platform` schema.

The application-layer connection pool routes each request to a schema based on the resolved tenant id; the `app.current_tenant` session variable mechanism from ADR-0005 is removed.

## Consequences

- **Positive**: index size per tenant is now proportional to that tenant's data, not the platform total. Vacuum runs are per-tenant and stop contending across retailers.
- **Positive**: tenant-conditional DDL becomes safe — pilot features land in one tenant's schema without polluting the rest.
- **Positive**: data-residency story improves dramatically — schemas can be moved to region-specific RDS instances without code changes.
- **Negative**: cross-tenant analytics rollups become explicit and more expensive. Materialised-view refresh becomes a scheduling problem.
- **Negative**: migration is non-trivial — every catalog table must be cloned per-tenant and historical data backfilled. See the `migrate-tenant-isolation-to-schema-per-tenant` change for the migration plan.
- **Negative**: DDL deploys now fan out across N schemas. Tooling investment required.
