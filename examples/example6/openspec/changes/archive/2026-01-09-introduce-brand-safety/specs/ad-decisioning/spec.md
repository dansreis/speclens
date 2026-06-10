# ad-decisioning delta

## MODIFIED Requirements

### Requirement: Return a creative payload when a bid wins

When the bid engine returns a winning bid that passes brand-safety checks, decisioning SHALL return a creative payload containing the creative asset URL, click-through URL, and the impression tracking pixel.

#### Scenario: Winning bid passes brand-safety

- **WHEN** the bid engine returns a winning bid for line-item L on slot S
- **AND** L's creative passes the brand-safety profile attached to S
- **THEN** decisioning SHALL return a 200 response containing the creative payload
- **AND** decisioning SHALL fire-and-forget an impression-pending event to Kafka

#### Scenario: Brand-safety rejection falls through to next bid

- **WHEN** the bid engine returns a winning bid for line-item L
- **AND** L's creative fails the brand-safety profile attached to the slot
- **THEN** decisioning SHALL discard the bid and request the next-ranked eligible bid from the bid engine
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` metric tagged by retailer, line-item, and rule id

## ADDED Requirements

### Requirement: No-eligible-bid after exhaustion returns no-fill

When decisioning has discarded every bid the bid engine can produce (because all candidates failed brand-safety), decisioning SHALL return a no-fill response within the slot's latency ceiling.

#### Scenario: All candidates rejected

- **WHEN** the bid engine produces three sequential candidate bids and decisioning discards all three on brand-safety
- **THEN** decisioning SHALL return a no-fill response
- **AND** decisioning SHALL emit a `decisioning.brand_safety_exhausted` metric tagged by slot
