# api-keys-and-webhooks delta

## ADDED Requirements

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
