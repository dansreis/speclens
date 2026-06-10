# Creative Approval

Retailer-side workflow for reviewing brand-submitted creatives before they become serveable on the retailer's surfaces. Each creative passes through `submitted` → `under_review` → (`approved` | `rejected`) before it can be attached to a line-item that serves on that retailer.

## Requirements

### Requirement: Brand submits a creative for retailer review

A brand user SHALL be able to submit a creative — image / HTML5 / video — for a specific retailer's review. The creative MUST enter the `submitted` state and SHALL NOT be serveable until the retailer transitions it to `approved`.

#### Scenario: Creative enters the review queue

- **WHEN** a brand user submits a creative targeting retailer R
- **THEN** the system SHALL persist the creative in `submitted` state
- **AND** the system SHALL notify retailer R's approval queue
- **AND** the creative SHALL NOT be attachable to any line-item that serves on R

### Requirement: Retailer reviewer approves or rejects a creative

A retailer reviewer SHALL be able to transition a `submitted` creative to `approved` or `rejected`. A rejection MUST include a reason and SHOULD reference the retailer's published creative guidelines.

#### Scenario: Approval makes the creative serveable

- **WHEN** a retailer reviewer transitions creative C from `submitted` to `approved`
- **THEN** the system SHALL emit a `creative.approved` event
- **AND** the creative SHALL become attachable to line-items serving on the retailer
- **AND** brand-side notifications SHALL fire to the creative's owners

#### Scenario: Rejection requires a reason

- **WHEN** a retailer reviewer transitions creative C from `submitted` to `rejected` without providing a reason
- **THEN** the system SHALL reject the transition with a validation error
- **AND** the creative SHALL remain in `submitted` state

### Requirement: Brand can resubmit a rejected creative

A brand user SHALL be able to address the rejection reason and resubmit the same creative. Resubmission MUST create a new revision; the rejected revision SHALL remain visible to both parties as an audit record.

#### Scenario: Resubmission creates a new revision

- **WHEN** a brand user resubmits creative C after rejection
- **THEN** the system SHALL create revision N+1 of C in `submitted` state
- **AND** revision N SHALL remain visible in the audit history
- **AND** the retailer's queue SHALL surface the new revision for review
