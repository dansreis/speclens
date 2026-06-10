# fraud-detection delta

## ADDED Requirements

### Requirement: Score every impression and click

The fraud-detection pipeline SHALL consume every `impressions` and `clicks` Kafka event and produce a `fraud_score` in [0.0, 1.0] within 60 seconds of the source event.

#### Scenario: Impression scored within SLA

- **WHEN** an impression event for campaign C is published to Kafka at time T
- **THEN** by time T + 60 seconds the fraud-detection pipeline SHALL publish a `fraud_scores` event for that impression

### Requirement: Quarantine high-fraud events from billing

Events with a `fraud_score` ≥ 0.8 SHALL be flagged as `invalid_traffic` and SHALL NOT count toward brand billing or retailer payouts.

#### Scenario: High-score impression excluded from billing

- **WHEN** an impression scores 0.92 from the fraud-detection pipeline
- **THEN** the billing service SHALL NOT include that impression in the brand's invoice
- **AND** the impression SHALL NOT contribute to the retailer's revenue share
