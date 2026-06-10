# attribution-reporting delta

## MODIFIED Requirements

### Requirement: Attribute conversions via multi-touch time-decay credit

The attribution pipeline SHALL attribute each conversion across qualifying touchpoints within a 7-day window prior to the conversion timestamp. Qualifying touchpoints are all impressions (clicked or viewed) from the same campaign and same user. Each touchpoint SHALL receive a fractional credit weighted by `2^(-Δt / half_life)`, where `Δt` is the time between the touchpoint and the conversion and `half_life` is 24h by default. Credit weights SHALL be normalised so the sum across qualifying touchpoints for a conversion equals 1.0.

A campaign MAY override the model to last-click; if so, only the most recent qualifying click receives credit and the credit fraction is 1.0.

#### Scenario: Two touchpoints — closer one weighted heavier

- **WHEN** user U converts on campaign C at time T
- **AND** qualifying touchpoints exist at T - 12h (line-item A) and T - 72h (line-item B), with 24h half-life
- **THEN** the attribution pipeline SHALL credit line-item A approximately 0.79 of the conversion and line-item B approximately 0.21
- **AND** the sum of credits across qualifying touchpoints SHALL equal 1.0

#### Scenario: Single qualifying touchpoint receives full credit

- **WHEN** user U converts on campaign C at time T
- **AND** the only qualifying touchpoint from C for U was at time T - 2 days
- **THEN** the attribution pipeline SHALL credit 100% of the conversion to that touchpoint's line-item

#### Scenario: No qualifying touchpoint — conversion is unattributed

- **WHEN** user U converts on campaign C at time T
- **AND** no qualifying touchpoint from C for U exists in the prior 7 days
- **THEN** the conversion SHALL be recorded with `attribution_status = unattributed`
- **AND** the conversion SHALL NOT roll up into campaign C's ROAS

#### Scenario: Campaign override forces last-click

- **WHEN** user U converts on campaign C at time T
- **AND** campaign C has `attribution_model = last_click`
- **AND** qualifying clicks exist at T - 1 day (line-item A) and T - 4 days (line-item B)
- **THEN** the attribution pipeline SHALL credit 100% of the conversion to line-item A
- **AND** line-item B SHALL receive zero credit

## ADDED Requirements

### Requirement: Expose credit-share per conversion

The brand-facing reporting API SHALL expose a credit-share view per conversion, listing each qualifying touchpoint and its fractional credit. This makes the attribution allocation auditable.

#### Scenario: Credit-share view returns per-touchpoint fractions

- **WHEN** a brand admin queries the credit-share view for a specific conversion
- **THEN** the reporting API SHALL return one row per qualifying touchpoint
- **AND** each row SHALL contain the touchpoint timestamp, line-item id, and credit fraction
- **AND** the sum of credit fractions across rows SHALL equal 1.0
