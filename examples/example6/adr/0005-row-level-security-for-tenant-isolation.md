# 0005. Row-level security for tenant isolation

- Status: accepted, superseded by ADR-0009
- Date: 2026-01-30

## Context

AdMedia is a multi-tenant platform: each retailer is a tenant, and every catalog row, event, and report row belongs to exactly one tenant. The first tenant-isolation question is how to keep one retailer's data from leaking into another's queries.

Three approaches were weighed:

1. **Application-layer filtering** — every query in every service must include a tenant predicate. Easy to get right once, easy to get wrong forever after. One missing `WHERE tenant_id = $1` and the breach is silent.
2. **Postgres row-level security (RLS)** — tenant predicate enforced by the database itself via session variables. Defence in depth: even a buggy query can't escape the predicate.
3. **Schema-per-tenant** — each tenant gets its own Postgres schema. Strongest isolation, but operationally heavy at the tenant counts we projected.

At the time of this ADR we projected 20–40 retailer tenants in the first 18 months. RLS sized correctly for that.

## Decision

Enable Postgres row-level security on every catalog table. Each service connection sets `app.current_tenant` as a session variable on connection check-out; RLS policies enforce `tenant_id = current_setting('app.current_tenant')::uuid` on SELECT, INSERT, UPDATE, and DELETE.

Admin / migration paths use a separate role that bypasses RLS and is audited.

## Consequences

- **Positive**: tenant-isolation is enforced by the database, not by application discipline. A missing predicate becomes a denied-row, not a leak.
- **Positive**: single schema keeps migrations simple — one DDL run covers every tenant.
- **Negative**: RLS adds a small per-query cost. Bid-state reads do not go through Postgres so the hot path is unaffected, but reporting queries pay the tax.
- **Negative**: scaling past a few hundred tenants stresses the single-schema model — large indexes, table bloat, vacuum contention all worsen as tenant count grows.
