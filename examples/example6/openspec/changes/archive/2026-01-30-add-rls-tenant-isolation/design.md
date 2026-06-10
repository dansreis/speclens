# Design — Add RLS Tenant Isolation

## Context

The platform currently relies on application-layer tenant filtering: every query in every service must include a `WHERE tenant_id = $current_tenant` predicate. This invariant is enforced only by code review and the discipline of the engineers writing the queries.

We have already had one near-miss. A new analytics endpoint shipped a `SELECT campaign_id, sum(spend)` query that joined `campaigns` to `impressions` without the predicate on either table. It was reviewed by three people. The leak was caught by a junior engineer running a load test on staging who noticed a campaign id they didn't recognise in their report.

Application-layer filtering is a quiet-failure model. The fix needs to move the invariant into a place where a missing predicate is *visibly* wrong, not silently dangerous.

## Goals / Non-Goals

**Goals:**
- A missing tenant predicate becomes a denied-row (zero results), not a leak.
- The fix is defence-in-depth: it does not replace good query discipline, it backstops it.
- Migration path is rollable forward in one deploy and rollable back in one deploy.

**Non-Goals:**
- This change does not address horizontal scaling of the catalog database — that's a later concern (and ultimately drives ADR-0009 superseding ADR-0005).
- This change does not move bid-state out of Redis. Redis enforcement of tenant boundaries is application-layer-only and that's acceptable for the lifetime of ADR-0002.

## Decisions

### Decision: Postgres row-level security, not schema-per-tenant

Two architectures were weighed for moving enforcement into the database:

1. **Row-level security on a shared schema.** Tenant predicate enforced by the database via a session variable. Single schema, simple migrations, defence in depth.
2. **Schema-per-tenant.** Each tenant gets its own Postgres schema. Strongest isolation, but operationally heavy at the tenant counts we project for the next 18 months.

We projected 20–40 retailer tenants over that window. RLS sizes correctly for that. Schema-per-tenant is the better answer once we cross a few hundred tenants — but we are not there now, and the operational cost of running schema-per-tenant before it's needed would push the migration window past the date the security team is willing to accept the current risk.

**Alternative considered and rejected:** **application-layer linter that rejects PRs lacking a tenant predicate**. This is what we have today, dressed up. It is a quiet-failure model with extra ceremony. RLS makes the failure mode visible (zero results) instead of silent (cross-tenant leak).

### Decision: Session variable, not connection pooling per tenant

RLS reads `current_setting('app.current_tenant')`. The session variable approach lets us keep a single shared connection pool. The alternative — a connection pool per tenant — explodes connection count at the database. The session-variable model has a small footgun (the variable must be set on every connection check-out) but the cost of forgetting is *zero rows returned*, which is recoverable.

## Risks / Trade-offs

- **[Risk] Per-query latency tax on Postgres reads.** → Mitigation: bid path does not touch Postgres (ADR-0002); reporting paths absorb it.
- **[Risk] A service forgets to set the session variable and silently returns zero rows.** → Mitigation: integration test that every service's connection-checkout sets the variable; canary on each service's first deploy that asserts non-zero row return on a known-good query.
- **[Risk] Migration runs against a table mid-flight produce empty result sets.** → Mitigation: deploy migration in maintenance window; canary one table first.

## Migration Plan

```
┌─────────────────────────────────────────────────────────┐
│ 1. Deploy migrations_admin role + audit hook            │
│ 2. Deploy connection middleware that SETs the variable  │
│ 3. Canary RLS on the smallest catalog table             │
│ 4. Verify metrics; ramp RLS table-by-table              │
│ 5. Final flip: RLS on the last large table              │
│ 6. Remove application-layer predicate guards (cleanup)  │
└─────────────────────────────────────────────────────────┘
```

Rollback at any step is `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` plus reverting the connection middleware. No data is mutated by this change — it is purely a policy change.

## Open Questions

- None at design time. The decision and migration plan got security-team sign-off in advance.
