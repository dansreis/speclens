# brand-safety delta

## ADDED Requirements

### Requirement: Define brand-safety profiles

A retailer admin SHALL be able to define one or more brand-safety profiles. A profile contains a name, a set of category-block rules, and a set of content rules. Profiles SHALL be attached to slots; the attached profile is the source of truth for that slot.

#### Scenario: Profile with category-block rules

- **WHEN** a retailer admin creates profile `default-strict` blocking categories `alcohol`, `gambling`, and `political`
- **THEN** the system SHALL persist the profile
- **AND** the profile SHALL be selectable as the brand-safety profile for any slot owned by the retailer

### Requirement: Evaluate brand-safety at decisioning time

For each winning bid, decisioning SHALL evaluate the slot's brand-safety profile against the creative's category and content metadata. If any rule rejects the creative, decisioning MUST discard the bid.

#### Scenario: Category match rejects the bid

- **WHEN** decisioning evaluates a winning bid whose creative declares category `alcohol`
- **AND** the slot's brand-safety profile blocks category `alcohol`
- **THEN** decisioning SHALL discard the bid
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` event tagged with rule id `category-block:alcohol`

### Requirement: Brand-safety rejections are auditable

Every brand-safety rejection SHALL be persisted with the slot id, the rejected creative id, the rule id that rejected it, and the timestamp. Retailers SHALL be able to query their own rejections in the reporting API.

#### Scenario: Retailer queries last 30 days of rejections

- **WHEN** a retailer admin requests brand-safety rejections for the last 30 days
- **THEN** the reporting API SHALL return every rejection that occurred on the retailer's slots in that window
- **AND** each rejection record SHALL include slot id, creative id, rule id, and timestamp
