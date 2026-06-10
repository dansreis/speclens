# budget-pacing delta

## MODIFIED Requirements

### Requirement: Compute pacing posture from observed spend

The pacing service SHALL compute, for each line-item, an `expected_spend` derived from the line-item's `expected_spend_curve` for the current hour of the flight day, and an `observed_spend` from impression events. The pacing posture SHALL be derived from the ratio `observed_spend / expected_spend`.

The `expected_spend_curve` SHALL be selected by the line-item's `smoothing_profile`:

- `uniform`: daily budget distributed evenly across the remaining hours of the flight day. Behaviour is identical to the v1 pacing model.
- `traffic-weighted`: daily budget distributed proportionally to historical impression traffic on the line-item's targeted slots (14-day rolling window).
- `day-part`: daily budget distributed only across the brand-configured day-part hours; hours outside the day-part receive zero expected spend.

#### Scenario: On-pace line-item under traffic-weighted profile

- **WHEN** observed spend at time T equals the expected-spend-curve value at time T for a `traffic-weighted` line-item
- **THEN** the pacing posture SHALL be `bidding_allowed`

#### Scenario: Over-pace line-item

- **WHEN** observed spend exceeds 110% of the expected-spend-curve value at time T
- **THEN** the pacing posture SHALL be `throttled`

#### Scenario: Day-part outside the configured hours

- **WHEN** a `day-part` line-item is evaluated during an hour outside its configured day-part window
- **THEN** expected spend at that hour SHALL be zero
- **AND** any observed spend in that hour SHALL be flagged as `outside_day_part`
- **AND** the pacing posture SHALL be `suspended` until the next day-part hour begins

#### Scenario: Daily budget exhausted

- **WHEN** observed spend reaches 100% of the daily budget
- **THEN** the pacing posture SHALL be `suspended`

## ADDED Requirements

### Requirement: Brand can configure the smoothing profile per line-item

A brand user SHALL be able to set the smoothing profile on a line-item to one of `uniform`, `traffic-weighted`, or `day-part`. Day-part profiles SHALL include the hour-of-day window (in the line-item's configured timezone). The default for newly-created line-items is `traffic-weighted`.

#### Scenario: Configure day-part profile

- **WHEN** a brand user sets a line-item's smoothing profile to `day-part` with window `06:00–10:00 America/New_York`
- **THEN** the system SHALL persist the profile
- **AND** the pacing service SHALL use the configured window when computing the expected-spend curve

#### Scenario: Fallback when insufficient traffic history

- **WHEN** a `traffic-weighted` line-item has fewer than 7 days of historical impression data on its targeted slots
- **THEN** the pacing service SHALL fall back to the `uniform` curve for that day
- **AND** the system SHALL emit a `pacing.traffic_weighted_fallback` metric tagged by line-item
