# api-keys-and-webhooks delta

## ADDED Requirements

### Requirement: Subscriber can rotate a webhook secret

A subscriber SHALL be able to initiate a rotation on any of their registered webhook endpoints. Rotation SHALL issue a new secret displayed exactly once, transition the existing secret to `rotating`, and start a grace window (default 30 days) during which both secrets are simultaneously active.

#### Scenario: Rotation issues a new secret

- **WHEN** a subscriber POSTs to `/api/v0/webhooks/:id/rotate`
- **THEN** the system SHALL display the new secret in the response body
- **AND** the system SHALL persist the new secret as `active`
- **AND** the system SHALL transition the previous secret to `rotating` with a `grace_until` set 30 days into the future

### Requirement: Webhook signature verification accepts either active secret during grace

When a webhook endpoint has two simultaneously active secrets (one `active`, one `rotating`), incoming POSTs to the platform's signed-event ingestion paths SHALL accept payloads signed by *either* secret.

#### Scenario: Both secrets verify during grace

- **WHEN** a payload is signed by the rotating (old) secret and received during the grace window
- **THEN** the platform SHALL accept the payload
- **AND** the platform SHALL emit a `webhook.legacy_secret_accepted` metric tagged by webhook id

#### Scenario: Old secret is rejected after grace ends

- **WHEN** a payload is signed by the rotating secret and received after `grace_until`
- **THEN** the platform SHALL reject the payload with a 401
- **AND** the rotating secret SHALL be transitioned to `revoked`

### Requirement: Rotation events are auditable

Every rotation SHALL be logged to the immutable audit channel with the subscriber id, webhook id, actor identity, and timestamp.

#### Scenario: Audit record captures rotation

- **WHEN** a subscriber rotates webhook W
- **THEN** the audit channel SHALL receive an immutable record with subscriber id, webhook id, and actor identity
