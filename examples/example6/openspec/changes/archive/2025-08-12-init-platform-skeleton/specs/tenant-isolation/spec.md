# tenant-isolation delta

## ADDED Requirements

### Requirement: Every catalog row is tenant-scoped

Every row in every catalog table SHALL carry a `tenant_id` column populated with the owning retailer's id. The `tenant_id` SHALL be set at insert time and MUST NOT be mutable thereafter.

#### Scenario: Insert without tenant_id is rejected

- **WHEN** a service attempts to insert a row into a catalog table without a `tenant_id`
- **THEN** the database SHALL reject the insert

#### Scenario: Update attempting to change tenant_id is rejected

- **WHEN** a service attempts to UPDATE a row's `tenant_id`
- **THEN** the database SHALL reject the UPDATE
