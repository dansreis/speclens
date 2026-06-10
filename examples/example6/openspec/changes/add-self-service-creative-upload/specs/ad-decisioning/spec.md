# ad-decisioning delta

## MODIFIED Requirements

### Requirement: Return a creative payload when a bid wins

When the bid engine returns a winning bid that passes brand-safety checks, decisioning SHALL return a creative payload containing the creative asset URL and the click-through URL. Decisioning SHALL treat auto-approved creatives (`approval_mode = auto`) identically to manually-approved creatives at serve time — there is no behavioural difference downstream of the creative-approval workflow.

#### Scenario: Auto-approved creative serves normally

- **WHEN** the bid engine returns a winning bid for line-item L whose creative was auto-approved
- **AND** L's creative passes the brand-safety profile attached to the slot
- **THEN** decisioning SHALL return a 200 response containing the creative payload
- **AND** decisioning SHALL fire-and-forget an impression-pending event to Kafka
- **AND** decisioning SHALL NOT emit any auto-approval-specific metric

#### Scenario: Brand-safety rejection falls through to next bid

- **WHEN** the bid engine returns a winning bid for line-item L
- **AND** L's creative fails the brand-safety profile attached to the slot
- **THEN** decisioning SHALL discard the bid and request the next-ranked eligible bid from the bid engine
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` metric
