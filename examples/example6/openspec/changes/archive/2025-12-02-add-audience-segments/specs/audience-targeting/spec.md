# audience-targeting delta

## ADDED Requirements

### Requirement: Brand can attach audience segments to a line-item

A brand user SHALL be able to attach one or more retailer-published audience segments to a line-item, as either an include set, an exclude set, or both.

#### Scenario: Include set narrows eligibility

- **WHEN** a brand user attaches include segment `loyalty-gold` to line-item L
- **THEN** the bid engine SHALL only consider L eligible for requests whose audience signal contains `loyalty-gold`

#### Scenario: Exclude set narrows eligibility further

- **WHEN** a brand user attaches include segment `loyalty-gold` AND exclude segment `recent-purchaser-30d` to line-item L
- **THEN** the bid engine SHALL only consider L eligible for requests whose audience signal contains `loyalty-gold` AND does not contain `recent-purchaser-30d`

### Requirement: Segment membership is resolved at decisioning time

Audience-segment membership SHALL be resolved by the retailer at the moment of the ad request, not pre-computed by the platform. Decisioning passes the segment membership through to the bid engine as opaque labels.

#### Scenario: Retailer-resolved segments arrive in the bid request

- **WHEN** a retailer surface initiates an ad request and includes the resolved audience labels in the request
- **THEN** the bid engine SHALL use those labels for eligibility evaluation
- **AND** the bid engine SHALL NOT consult any platform-side membership cache

#### Scenario: Missing audience labels means no segments

- **WHEN** a retailer surface initiates an ad request without an audience-labels field
- **THEN** the bid engine SHALL treat the request as having no segment membership
- **AND** line-items requiring include-segments SHALL be ineligible for the request
