# api-keys-and-webhooks delta

## ADDED Requirements

### Requirement: Brand or retailer can issue an API key

A brand admin or a retailer admin SHALL be able to issue an API key scoped to their own tenant. The key SHALL be displayed exactly once at issue time and SHALL be persisted only as a salted hash.

#### Scenario: Key displayed once, never again

- **WHEN** a brand admin issues a new API key
- **THEN** the system SHALL display the full key value in the response of the issue request
- **AND** the system SHALL persist only the salted hash of the key
- **AND** subsequent reads of the key SHALL never return the cleartext value

### Requirement: API requests are authenticated by key

The REST API SHALL authenticate every non-public request by the `Authorization: Bearer <api-key>` header. The key SHALL be validated against the salted-hash store, and the request SHALL be scoped to the tenant that owns the key.

#### Scenario: Valid key returns scoped data

- **WHEN** a request authenticates with a valid key owned by `tenant-A`
- **THEN** the request SHALL be processed
- **AND** the response SHALL contain only data belonging to `tenant-A`

#### Scenario: Invalid key is rejected

- **WHEN** a request authenticates with a key that does not match any stored hash
- **THEN** the REST API SHALL respond 401
