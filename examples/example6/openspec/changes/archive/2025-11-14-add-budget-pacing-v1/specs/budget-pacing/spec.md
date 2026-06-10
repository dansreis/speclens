# budget-pacing delta

## ADDED Requirements

### Requirement: Compute pacing posture from observed spend

The pacing service SHALL compute, for each line-item, an `expected_spend` based on a uniform distribution of the daily budget across the remaining hours of the flight day, and an `observed_spend` from impression events. The pacing posture SHALL be derived from the ratio `observed_spend / expected_spend`.

#### Scenario: On-pace line-item

- **WHEN** observed spend at time T equals expected spend at time T
- **THEN** the pacing posture SHALL be `bidding_allowed`

#### Scenario: Over-pace line-item

- **WHEN** observed spend exceeds 110% of expected spend
- **THEN** the pacing posture SHALL be `throttled`

#### Scenario: Daily budget exhausted

- **WHEN** observed spend reaches 100% of the daily budget
- **THEN** the pacing posture SHALL be `suspended`

### Requirement: Stop overspend within 60 seconds

The pacing service SHALL update the bid-state cache so that the bid engine stops returning bids for an exhausted line-item within 60 seconds of the budget being reached.

#### Scenario: Budget exhausted mid-flight

- **WHEN** a line-item's observed spend crosses 100% of its daily budget at time T
- **THEN** the bid engine SHALL stop returning bids for the line-item no later than T + 60 seconds
