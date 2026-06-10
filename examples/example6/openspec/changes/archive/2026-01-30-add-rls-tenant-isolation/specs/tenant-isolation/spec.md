# tenant-isolation delta

## ADDED Requirements

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
