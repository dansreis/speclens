# Inventory Management

Retailer-side capability for declaring the ad slots available on the retailer's surfaces, the formats and dimensions each slot accepts, and the brand-safety profile attached to each slot.

## Requirements

### Requirement: Retailer can register an ad slot

A retailer admin SHALL be able to register an ad slot by providing a slot id, a surface identifier (e.g. `web-home-hero`, `app-search-results`), accepted creative formats, accepted dimensions, and a brand-safety profile.

#### Scenario: Slot registered with accepted formats

- **WHEN** a retailer admin registers slot `web-home-hero-1` accepting formats `image/jpeg` and `image/png`, dimensions `1200x400`, with brand-safety profile `default-strict`
- **THEN** the system SHALL persist the slot in `active` state
- **AND** decisioning SHALL begin treating the slot id as resolvable

#### Scenario: Duplicate slot id rejected

- **WHEN** a retailer admin attempts to register a slot id that already exists for the same retailer
- **THEN** the system SHALL reject the registration with a duplicate-id error
- **AND** the existing slot SHALL be unchanged

### Requirement: Retailer can deactivate an ad slot

A retailer admin SHALL be able to deactivate a slot. A deactivated slot MUST NOT receive bid requests, but historical impressions MUST remain queryable.

#### Scenario: Deactivation stops new ad requests

- **WHEN** a retailer admin deactivates slot `web-home-hero-1`
- **THEN** decisioning SHALL return a no-fill response for any subsequent request naming that slot
- **AND** decisioning SHALL emit a `decisioning.slot_inactive` metric

### Requirement: Slot brand-safety profile is enforced at decisioning time

The brand-safety profile attached to a slot SHALL be the profile evaluated for every bid served on that slot, regardless of any campaign- or line-item-level setting.

#### Scenario: Slot-level profile overrides line-item targeting

- **WHEN** decisioning evaluates a winning bid from line-item L on slot S
- **AND** L's creative passes L's campaign-level brand-safety profile but fails S's slot-level profile
- **THEN** decisioning SHALL discard the bid
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` metric tagged by slot, line-item, and rule id
