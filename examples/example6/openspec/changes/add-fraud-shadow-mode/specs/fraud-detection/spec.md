# fraud-detection delta

## ADDED Requirements

### Requirement: Shadow-mode ML scorer publishes alongside rule-based scorer

The platform SHALL run a shadow-mode ML scorer (`fraud-scorer-ml`) consuming the same `impressions` and `clicks` events as the production rule-based scorer. The ML scorer SHALL publish its scores to the `fraud-scores-shadow` Kafka topic. No service (billing, pacing, reporting) SHALL consume from `fraud-scores-shadow` for production decisions.

#### Scenario: Both scorers publish for the same event

- **WHEN** an impression event for campaign C is published at time T
- **THEN** by time T + 60 seconds the rule-based scorer SHALL publish to `fraud-scores`
- **AND** by time T + 60 seconds (best-effort) the ML scorer SHALL publish to `fraud-scores-shadow`
- **AND** the billing service SHALL consume only from `fraud-scores`

#### Scenario: Shadow scorer backlog does not affect billing

- **WHEN** the ML scorer is backlogged by 30 minutes
- **THEN** billing SHALL continue to operate using `fraud-scores` from the rule-based scorer
- **AND** the comparison dashboard SHALL surface the backlog metric

### Requirement: Comparison dashboard surfaces score divergence

The platform SHALL expose an internal comparison dashboard showing, per event-type and per time window, the distribution of rule-based vs ML scores and the disagreement rate at threshold 0.8.

#### Scenario: Analyst queries divergence over the last 7 days

- **WHEN** an analyst opens the comparison dashboard for the last 7 days
- **THEN** the dashboard SHALL show per-day disagreement rate at threshold 0.8
- **AND** the dashboard SHALL link each disagreement to a per-event drill-down view
