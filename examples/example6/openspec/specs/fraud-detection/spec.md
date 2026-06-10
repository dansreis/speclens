# Fraud Detection

Post-impression analysis pipeline that scores each impression and click for invalid-traffic signatures (bots, click farms, sub-100ms double-clicks, geo-impossible sessions) and produces a `fraud_score` consumed by attribution and billing.

## Requirements

### Requirement: Score every impression and click

The fraud-detection pipeline SHALL consume every `impressions` and `clicks` Kafka event and produce a `fraud_score` in [0.0, 1.0] within 60 seconds of the source event.

#### Scenario: Impression scored within SLA

- **WHEN** an impression event for campaign C is published to Kafka at time T
- **THEN** by time T + 60 seconds the fraud-detection pipeline SHALL publish a `fraud_scores` event for that impression
- **AND** the score SHALL be in the closed interval [0.0, 1.0]

### Requirement: Quarantine high-fraud events from billing

Events with a `fraud_score` ≥ 0.8 SHALL be flagged as `invalid_traffic` and SHALL NOT count toward brand billing or retailer payouts. Flagged events MUST remain queryable in the reporting API.

#### Scenario: High-score impression excluded from billing

- **WHEN** an impression scores 0.92 from the fraud-detection pipeline
- **THEN** the billing service SHALL NOT include that impression in the brand's invoice
- **AND** the impression SHALL NOT contribute to the retailer's revenue share
- **AND** the impression SHALL remain visible in the brand-facing reporting API marked `invalid_traffic`

#### Scenario: Low-score impression bills normally

- **WHEN** an impression scores 0.15 from the fraud-detection pipeline
- **THEN** the billing service SHALL include the impression in the brand's invoice as normal

### Requirement: Persist scoring rationale for audit

Every `fraud_scores` event SHALL include the rule id (or model version) that produced the score and the top three contributing features. Disputes from brands SHALL be answerable from this audit data.

#### Scenario: Brand disputes a flagged impression

- **WHEN** a brand admin opens a dispute on a specific impression flagged `invalid_traffic`
- **THEN** the reporting API SHALL return the rule id, model version, and top contributing features for that impression's score
