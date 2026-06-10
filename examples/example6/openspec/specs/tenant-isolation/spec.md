# Tenant Isolation

Multi-tenancy guarantees for the platform. Each retailer is a tenant; every catalog row, event, report row, and creative asset belongs to exactly one tenant. Tenant-isolation guarantees keep one retailer's data from leaking into another's queries. The current mechanism is Postgres row-level security (ADR-0005); a migration to schema-per-tenant is in flight (ADR-0009, active change `migrate-tenant-isolation-to-schema-per-tenant`).

## Requirements

### Requirement: Every catalog row is tenant-scoped

Every row in every catalog table SHALL carry a `tenant_id` column populated with the owning retailer's id. The `tenant_id` SHALL be set at insert time and MUST NOT be mutable thereafter.

#### Scenario: Insert without tenant_id is rejected

- **WHEN** a service attempts to insert a row into a catalog table without a `tenant_id`
- **THEN** the database SHALL reject the insert
- **AND** the rejection SHALL be logged to the audit channel

#### Scenario: Update attempting to change tenant_id is rejected

- **WHEN** a service attempts to UPDATE a row's `tenant_id`
- **THEN** the database SHALL reject the UPDATE
- **AND** the rejection SHALL be logged to the audit channel

### Requirement: Queries see only the calling tenant's rows

For every read against catalog tables, the database SHALL apply a row-level security predicate that limits visible rows to those whose `tenant_id` matches the session's `app.current_tenant` setting.

#### Scenario: Cross-tenant SELECT returns no rows

- **WHEN** a service session with `app.current_tenant = tenant-A` issues `SELECT * FROM campaigns`
- **THEN** the result set SHALL contain only rows where `tenant_id = tenant-A`
- **AND** rows belonging to other tenants SHALL be invisible — not "denied", invisible — to the query

### Requirement: Admin operations bypass RLS only under audit

A separate database role MAY bypass row-level security for migrations and operational rescues. Every connection that uses this role SHALL be logged to the immutable audit channel with the connecting service, user, and reason.

#### Scenario: Admin connection is audited

- **WHEN** the migrations runner connects as the RLS-bypass role
- **THEN** the connection SHALL be logged to the audit channel with the connecting service id and migration version
- **AND** the audit record SHALL be immutable
