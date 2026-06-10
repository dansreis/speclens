# Migrate Tenant Isolation to Schema-Per-Tenant

## Why

ADR-0005 chose Postgres row-level security as the tenant-isolation strategy, sized for the projected 20–40 retailer tenants in the first 18 months. The platform is now past that projection — sixty-three active retailer tenants, with two enterprise pilots that will push past one hundred this year.

Three pressures combined to force the re-evaluation: vacuum and index contention on the largest shared tables routinely overlapping with peak campaign-launch windows; per-tenant migration risk preventing pilot-with-one-tenant rollouts; and two prospective European-region tenants whose data-residency requirements RLS cannot satisfy.

The right answer is schema-per-tenant — each retailer gets its own Postgres schema, with cross-tenant analytics rollups via materialised views in a shared `platform` schema. The decision is captured in ADR-0009 (supersedes ADR-0005).

This is the biggest infrastructure change since the platform-skeleton; the migration plan is non-trivial and the cutover window is correspondingly large.

## What Changes

- **BREAKING (internal)**: catalog database schema changes from a single shared schema with RLS to a schema-per-tenant model.
- Per-tenant Flyway runner replaces the global migration job.
- Connection pool routes each request to a tenant-specific schema based on the resolved tenant id.
- The `app.current_tenant` session-variable mechanism from ADR-0005 is removed.
- New ADR (0009) supersedes ADR-0005.
- Cross-tenant analytics rollups move to materialised views in a shared `platform` schema.

## Capabilities

- **Modified Capabilities**:
  - `tenant-isolation` — enforcement mechanism changes from RLS to physical schema separation

## Impact

- Migration is rolled out tenant-by-tenant. ~63 + 2 = 65 tenant schemas to provision.
- Connection-pool layer (pgbouncer + custom router) needs to be replaced or substantially extended.
- Every service that uses the catalog database needs its connection-checkout logic updated.
- ADR-0005 is frozen as historical record; ADR-0009 names it in `Supersedes:`.
- Two prospective European-region tenants unblocked for onboarding.
