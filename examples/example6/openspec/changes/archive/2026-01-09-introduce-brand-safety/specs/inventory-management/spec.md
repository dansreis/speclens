# inventory-management delta

## MODIFIED Requirements

### Requirement: Retailer can register an ad slot

A retailer admin SHALL be able to register an ad slot by providing a slot id, a surface identifier, accepted creative formats, accepted dimensions, and a brand-safety profile (newly required).

#### Scenario: Slot registered with accepted formats and a profile

- **WHEN** a retailer admin registers slot `web-home-hero-1` with formats `image/jpeg` and `image/png`, dimensions `1200x400`, and brand-safety profile `default-strict`
- **THEN** the system SHALL persist the slot in `active` state
- **AND** decisioning SHALL begin treating the slot id as resolvable

#### Scenario: Slot registration missing brand-safety profile is rejected

- **WHEN** a retailer admin attempts to register a slot without a `brand_safety_profile_id`
- **THEN** the system SHALL reject the registration with a validation error
- **AND** no slot SHALL be created
