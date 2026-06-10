# attribution-reporting delta

## ADDED Requirements

### Requirement: Attribute conversions via last-click within a 7-day window

The attribution pipeline SHALL attribute each conversion to the most recent click from the same campaign and same user that occurred within 7 days prior to the conversion timestamp. Conversions with no qualifying click SHALL be reported as **unattributed**.

#### Scenario: Single qualifying click wins credit

- **WHEN** user U converts on campaign C at time T
- **AND** the only qualifying click from C for U was at time T - 2 days
- **THEN** the attribution pipeline SHALL credit 100% of the conversion to that click's line-item

#### Scenario: Multiple qualifying clicks — most recent wins

- **WHEN** user U converts on campaign C at time T
- **AND** qualifying clicks exist at T - 1 day (line-item A) and T - 4 days (line-item B)
- **THEN** the attribution pipeline SHALL credit 100% of the conversion to line-item A
- **AND** line-item B SHALL receive zero credit for this conversion

#### Scenario: No qualifying click — conversion is unattributed

- **WHEN** user U converts on campaign C at time T
- **AND** no qualifying click from C for U exists in the prior 7 days
- **THEN** the conversion SHALL be recorded with `attribution_status = unattributed`
- **AND** the conversion SHALL NOT roll up into campaign C's ROAS

### Requirement: Provide brand-facing ROAS rollups

The attribution pipeline SHALL roll up attributed conversion value over campaign, flight, and line-item and expose ROAS and CPA in the brand-facing reporting API.

#### Scenario: Daily rollup includes only attributed conversions

- **WHEN** the daily rollup runs for campaign C for date D
- **THEN** ROAS for date D SHALL equal sum(attributed-conversion-value on D) ÷ sum(spend on D)
- **AND** unattributed conversions SHALL NOT contribute to the numerator

### Requirement: Reports are queryable within 15 minutes of event

The attribution pipeline SHALL make a conversion's attributed credit queryable in the brand-facing reporting API within 15 minutes of the conversion event being received.

#### Scenario: Conversion at T queryable by T + 15 minutes

- **WHEN** a conversion event for campaign C arrives at time T
- **THEN** by time T + 15 minutes the conversion SHALL appear in the reporting API
- **AND** the attribution credit SHALL be assigned to a specific line-item OR marked `unattributed`
