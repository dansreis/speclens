# Event Ingestion

The pipeline that captures impression, click, and conversion events from retailer surfaces and routes them durably to downstream consumers (pacing, fraud, attribution, archive). Kafka is the backbone, per ADR-0003.

## Requirements

### Requirement: Accept events via a signed-payload HTTPS endpoint

Event ingestion SHALL accept impression, click, and conversion events via a public HTTPS endpoint that validates an HMAC signature in the `X-AdMedia-Signature` header against the retailer's currently-active webhook secret.

#### Scenario: Valid signature is accepted

- **WHEN** a retailer surface POSTs an event payload with a valid HMAC signature
- **THEN** the ingestion endpoint SHALL respond 202 within 50ms
- **AND** the event SHALL be published to the appropriate Kafka topic (`impressions`, `clicks`, or `conversions`)

#### Scenario: Invalid signature is rejected

- **WHEN** a retailer surface POSTs an event payload whose signature does not validate against any currently-active retailer secret
- **THEN** the ingestion endpoint SHALL respond 401
- **AND** the event SHALL NOT be published to any Kafka topic
- **AND** the system SHALL emit an `ingestion.signature_invalid` metric tagged by source IP

### Requirement: Preserve per-campaign event ordering

Events for a given campaign SHALL be partitioned into Kafka such that all events for that campaign land on the same partition and are therefore strictly ordered for any single consumer.

#### Scenario: Click followed by impression for the same campaign

- **WHEN** a click event for campaign C is published at time T1 and an impression event for campaign C is published at time T2 (T1 < T2)
- **THEN** a single Kafka consumer reading the partition for campaign C SHALL observe the click before the impression
- **AND** the consumer offset SHALL advance monotonically

### Requirement: Survive consumer outages without event loss

Event ingestion SHALL retain published events on Kafka for at least 7 days after publication. Downstream consumers SHALL be able to resume from their last committed offset and replay missed events.

#### Scenario: Consumer downtime followed by recovery

- **WHEN** a downstream consumer is offline for 4 hours
- **THEN** when the consumer resumes it SHALL receive every event published during the outage
- **AND** the consumer SHALL process them in partition-order
