# Campaign Management

Brand-side capability for creating, editing, pausing, and resuming retail-media campaigns. A campaign owns one or more flights; each flight owns one or more line-items; each line-item carries a bid, a budget, targeting, and creative associations.

## Requirements

### Requirement: Brand can create a campaign

A brand user SHALL be able to create a campaign by providing a name, a retailer scope (one retailer, never cross-retailer), a start date, and a daily budget.

#### Scenario: Successful campaign creation

- **WHEN** a brand user submits a campaign with name "Spring Refresh", retailer "fresh-grocer", start date "2026-04-01", and daily budget "$2,500"
- **THEN** the system SHALL create the campaign in the `draft` state
- **AND** the system SHALL emit a `campaign.created` audit event with the actor and timestamp
- **AND** the campaign SHALL NOT serve impressions until the brand user explicitly transitions it to `active`

#### Scenario: Rejection on cross-retailer scope

- **WHEN** a brand user submits a campaign whose targeting names retailers outside the campaign's declared retailer scope
- **THEN** the system SHALL reject the submission with a validation error naming the offending retailer ids
- **AND** the system SHALL NOT create a partial campaign

### Requirement: Brand can pause and resume a campaign

A brand user SHALL be able to pause an `active` campaign at any time and resume a `paused` campaign. Pausing a campaign MUST stop all serving within 60 seconds of the pause request being acknowledged.

#### Scenario: Pause stops serving within the budget

- **WHEN** a brand user pauses an `active` campaign at time T
- **THEN** the bid engine SHALL stop returning bids for that campaign no later than T + 60 seconds
- **AND** impressions served between T and the cutoff SHALL count against the campaign's spend
- **AND** the system SHALL transition the campaign to `paused` and emit `campaign.paused`

#### Scenario: Resume returns to serving

- **WHEN** a brand user resumes a `paused` campaign whose flight window is still open
- **THEN** the system SHALL transition the campaign to `active`
- **AND** the bid engine SHALL start returning bids for the campaign within 60 seconds
- **AND** the system SHALL emit `campaign.resumed`

### Requirement: Brand can edit a campaign's flights and line-items

A brand user SHALL be able to add, edit, or remove flights and line-items on a campaign at any point in its lifecycle. Edits to budgets and bids MUST take effect within the bid engine within 60 seconds of acknowledgement.

#### Scenario: Budget increase takes effect on next pacing tick

- **WHEN** a brand user raises a line-item's daily budget from $500 to $1,000 at time T
- **THEN** the budget-pacing service SHALL recompute the line-item's pacing posture using the new budget at the next pacing tick (≤ 60s after T)
- **AND** the bid engine SHALL allow bids that consume the increased budget no later than the recomputation

#### Scenario: Removing a line-item stops its serving

- **WHEN** a brand user removes a line-item from a campaign
- **THEN** the bid engine SHALL stop returning bids for that line-item within 60 seconds
- **AND** historical impressions served by the removed line-item SHALL remain queryable in reporting
