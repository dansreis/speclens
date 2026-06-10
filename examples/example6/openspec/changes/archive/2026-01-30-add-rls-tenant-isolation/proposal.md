# Add RLS Tenant Isolation

## Why

The platform skeleton ships application-layer tenant filtering. Every query in every service must include a tenant predicate. We have already shipped one near-miss where a new analytics endpoint was reviewed by three people and merged without the predicate; the leak was caught by a junior engineer running a load test on staging.

That class of bug will recur. The right fix is to push tenant-isolation into the database itself — postgres row-level security — so that a missing predicate becomes a denied-row, not a leak.

## What Changes

- Enable postgres row-level security on every catalog table.
- Add per-connection session variable `app.current_tenant` populated by the catalog-api connection middleware.
- Add the RLS-bypass admin role used only by Flyway migrations and audited operational rescues.
- New ADR (0005) capturing the decision and its alternatives.

## Capabilities

- **Modified Capabilities**:
  - `tenant-isolation` — adds the database-enforced predicate requirement to what was previously an application-layer invariant

## Impact

- Adds a small per-query latency tax on Postgres reads. Bid-state reads go through Redis (ADR-0002) and are unaffected.
- Establishes the connection-checkout convention: every service connection sets `app.current_tenant`. Services that forget to set it will get zero rows back, by design.
- Auditing requirement: every connection on the admin-bypass role is logged immutably.
