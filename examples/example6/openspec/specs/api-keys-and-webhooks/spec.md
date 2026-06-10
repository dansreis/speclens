# API Keys and Webhooks

External-integration surface for brands and retailers. API keys grant authenticated access to the platform's REST API; webhooks deliver platform events (campaign status changes, creative approvals, invoice availability) to subscriber-provided HTTPS endpoints with HMAC-signed payloads.

## Requirements

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
- **AND** the request SHALL be logged with the key id (never the key value)

#### Scenario: Invalid key is rejected

- **WHEN** a request authenticates with a key that does not match any stored hash
- **THEN** the REST API SHALL respond 401
- **AND** the system SHALL emit an `api.auth_failure` metric tagged by source IP

### Requirement: Subscriber can register a webhook endpoint

A brand or retailer subscriber SHALL be able to register a webhook endpoint specifying a URL, an event-type filter, and a generated webhook secret used for HMAC signing.

#### Scenario: Webhook fires for matching event

- **WHEN** an event of a type in the subscriber's filter occurs
- **THEN** the platform SHALL POST the event payload to the subscriber's URL
- **AND** the POST SHALL include an `X-AdMedia-Signature` header containing an HMAC-SHA256 of the payload signed by the webhook secret

### Requirement: Webhook deliveries are retried

The platform SHALL retry failed webhook deliveries (non-2xx response or connection failure) with exponential backoff over 24 hours. After 24 hours of failure the platform SHALL mark the endpoint `suspended` and notify the owning admin.

#### Scenario: Endpoint returns 503, retried with backoff

- **WHEN** a webhook POST returns 503
- **THEN** the platform SHALL retry the delivery with exponential backoff (1m, 5m, 30m, 2h, 6h, 24h)
- **AND** the platform SHALL stop retrying after the 24-hour mark
- **AND** the platform SHALL transition the endpoint to `suspended`
