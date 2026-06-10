# creative-approval delta

## MODIFIED Requirements

### Requirement: Brand submits a creative for retailer review

A brand user SHALL be able to submit a creative — image / HTML5 / video — for a specific retailer's review. On submission, the platform SHALL evaluate the retailer's auto-approval rule set against the creative. If any rule matches, the creative SHALL transition immediately to `approved` without human review; otherwise, the creative SHALL enter the `submitted` state and the retailer's approval queue.

#### Scenario: Auto-approval rule matches

- **WHEN** a brand user submits a creative whose format and brand category match a configured auto-approval rule on the target retailer
- **THEN** the platform SHALL persist the creative as `approved` with `approval_mode = auto`
- **AND** the platform SHALL emit `creative.approved` with `mode: auto`

#### Scenario: No auto-approval rule matches

- **WHEN** a brand user submits a creative and no auto-approval rule matches
- **THEN** the platform SHALL persist the creative in `submitted` state
- **AND** the system SHALL notify the retailer's approval queue (existing behaviour)

## ADDED Requirements

### Requirement: Retailer admin can define auto-approval rules

A retailer admin SHALL be able to define one or more auto-approval rules. Each rule carries a set of conditions (creative format, brand category, file-size limit) and is bound to the retailer. Rules are evaluated at submission time; the first matching rule wins.

#### Scenario: Define a rule by format and category

- **WHEN** a retailer admin creates an auto-approval rule with `format = image/jpeg`, `category = grocery-staples`, `max_file_size = 2MB`
- **THEN** the system SHALL persist the rule
- **AND** subsequent submissions matching all three conditions SHALL auto-approve

### Requirement: Rule changes are audited and revocable

Every auto-approval rule change SHALL be logged to the immutable audit channel. A retailer admin SHALL be able to revoke an auto-approved creative within 7 days of approval; revocation pulls the creative from serving within 60 seconds.

#### Scenario: Retailer revokes an auto-approved creative

- **WHEN** a retailer admin revokes auto-approved creative C
- **THEN** the platform SHALL transition C from `approved` to `rejected` with `reason = retailer-revocation`
- **AND** decisioning SHALL stop returning fills using C within 60 seconds
- **AND** the audit channel SHALL record the revocation
