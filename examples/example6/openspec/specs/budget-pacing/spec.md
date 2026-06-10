# Budget Pacing

Spreads each line-item's spend across the line-item's flight window so that the campaign does not exhaust its budget early. The pacing service consumes `impressions` events from Kafka and writes a pacing posture (bidding allowed / throttled / suspended) per line-item into the bid-state cache.

## Requirements

### Requirement: Compute pacing posture from observed spend

The pacing service SHALL compute, for each line-item, an `expected_spend` based on a uniform distribution of the daily budget across the remaining hours of the flight day, and an `observed_spend` from impression events. The pacing posture SHALL be derived from the ratio `observed_spend / expected_spend`.

#### Scenario: On-pace line-item

- **WHEN** observed spend at time T equals expected spend at time T
- **THEN** the pacing posture SHALL be `bidding_allowed`
- **AND** the bid engine SHALL allow bids for the line-item at the configured bid

#### Scenario: Over-pace line-item

- **WHEN** observed spend exceeds 110% of expected spend
- **THEN** the pacing posture SHALL be `throttled`
- **AND** the bid engine SHALL reduce participation by sampling a fraction of eligible requests proportional to the over-pace ratio

#### Scenario: Daily budget exhausted

- **WHEN** observed spend reaches 100% of the daily budget
- **THEN** the pacing posture SHALL be `suspended`
- **AND** the bid engine SHALL stop returning bids for the line-item until the next pacing day boundary

### Requirement: Stop overspend within 60 seconds

The pacing service SHALL update the bid-state cache so that the bid engine stops returning bids for an exhausted line-item within 60 seconds of the budget being reached.

#### Scenario: Budget exhausted mid-flight

- **WHEN** a line-item's observed spend crosses 100% of its daily budget at time T
- **THEN** the bid engine SHALL stop returning bids for the line-item no later than T + 60 seconds
- **AND** any impressions served between T and the cutoff SHALL be counted as overspend and reported separately
