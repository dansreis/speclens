# brand-safety delta

## ADDED Requirements

### Requirement: Define keyword-block rules

A retailer admin SHALL be able to add `keyword-block` rules to a brand-safety profile. Each keyword-block rule carries a list of terms (case-insensitive, accent-insensitive) and a metadata-field selector identifying which creative metadata field to match against (`brand_name`, `title`, `alt_text`, or `all`).

#### Scenario: Add a keyword-block rule

- **WHEN** a retailer admin adds a keyword-block rule to profile `kids-aisle-strict` with terms `["diet", "low-fat"]` and selector `brand_name`
- **THEN** the system SHALL persist the rule
- **AND** decisioning SHALL begin evaluating the rule on every winning bid that uses this profile

### Requirement: Evaluate keyword-block at decisioning time

For each winning bid, decisioning SHALL evaluate every keyword-block rule on the slot's profile. If any rule's term list matches the selected metadata field on the creative (case-insensitive, accent-insensitive), decisioning MUST discard the bid.

#### Scenario: Keyword match rejects the bid

- **WHEN** decisioning evaluates a winning bid whose creative metadata has `brand_name = "Diet Dynamics"`
- **AND** the slot's profile contains a keyword-block rule with terms `["diet"]` and selector `brand_name`
- **THEN** decisioning SHALL discard the bid
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` event tagged with rule id and matching term

#### Scenario: No match passes through

- **WHEN** decisioning evaluates a winning bid whose creative metadata contains none of the configured terms
- **THEN** decisioning SHALL NOT reject the bid on keyword-block grounds
