# event-ingestion delta

## ADDED Requirements

### Requirement: Accept impressions via a signed pixel URL

Event ingestion SHALL accept impression confirmations via GET requests against a signed pixel URL embedded in the decisioning fill response. The signature SHALL bind the impression to a specific campaign, slot, and timestamp window.

#### Scenario: Valid pixel fetch publishes one impression

- **WHEN** a retailer surface fetches a pixel URL whose signature validates and whose timestamp is within the validity window
- **THEN** the `pixel-ingest` service SHALL publish one `impressions` event to Kafka
- **AND** the service SHALL respond with a 1×1 transparent GIF

#### Scenario: Replay returns the GIF but emits no second event

- **WHEN** the same pixel URL is fetched twice
- **THEN** the `pixel-ingest` service SHALL respond with the GIF on both fetches
- **AND** only one `impressions` event SHALL be published

### Requirement: Preserve per-campaign event ordering

Impression events for a given campaign SHALL be partitioned into Kafka such that all events for that campaign land on the same partition and are therefore strictly ordered for any single consumer.

#### Scenario: Two impressions on the same campaign retain order

- **WHEN** an impression for campaign C is published at time T1 and another at time T2 (T1 < T2)
- **THEN** a single Kafka consumer reading the partition for campaign C SHALL observe T1 before T2
