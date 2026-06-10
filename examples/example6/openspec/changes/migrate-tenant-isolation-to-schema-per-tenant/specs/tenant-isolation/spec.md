# tenant-isolation delta

## MODIFIED Requirements

### Requirement: Queries see only the calling tenant's rows

For every read against catalog tables, the calling service connection SHALL be routed to a tenant-specific Postgres schema (`tenant_<uuid>`) such that the connection can only see rows belonging to the calling tenant. Cross-schema reads are not possible without an explicit `SET search_path` action, which is reserved for the platform analytics rollup runner.

#### Scenario: Cross-tenant SELECT returns no rows

- **WHEN** a service session resolved to tenant-A issues `SELECT * FROM campaigns`
- **THEN** the result set SHALL contain only rows from `tenant_<tenant-A-uuid>.campaigns`
- **AND** rows belonging to other tenants SHALL be inaccessible — the calling session's `search_path` SHALL NOT include other tenant schemas

#### Scenario: Tenant-router rejects unresolved tenant

- **WHEN** a service issues a request without a resolvable tenant id
- **THEN** the tenant router SHALL reject the request with a 401
- **AND** no database connection SHALL be acquired

### Requirement: Admin operations operate per-schema and are audited

A separate database role MAY connect to any tenant schema for migrations and operational rescues. Every connection that uses this role SHALL be logged to the immutable audit channel with the connecting service, target tenant schema, and reason.

#### Scenario: Migration runner connects to a specific tenant schema

- **WHEN** the per-tenant Flyway runner connects as the migrations-admin role to schema `tenant_abc-...`
- **THEN** the connection SHALL be logged to the audit channel with the migration version and target schema
- **AND** the audit record SHALL be immutable

## ADDED Requirements

### Requirement: Cross-tenant rollups read from materialised views in the shared `platform` schema

Cross-tenant analytics rollups SHALL be served from materialised views in a shared `platform` schema, refreshed by a dedicated background runner. No service-level query SHALL fan-out across tenant schemas directly.

#### Scenario: Platform-CPM rollup served from materialised view

- **WHEN** the analytics API serves a platform-wide CPM query
- **THEN** the query SHALL read from `platform.platform_cpm_daily`
- **AND** the query SHALL NOT iterate tenant schemas

#### Scenario: Materialised view staleness alert

- **WHEN** a materialised view in the `platform` schema is more than 30 minutes stale
- **THEN** the system SHALL emit a `platform.materialised_view_stale` alert tagged by view name
