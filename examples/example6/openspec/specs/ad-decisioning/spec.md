# Ad Decisioning

The edge service that retailer surfaces call to fill a sponsored placement. Decisioning resolves the slot configuration, consults the bid engine for the winning bid, applies brand-safety rules, and returns either a creative payload or a no-fill signal.

## Requirements

### Requirement: Resolve slot configuration before consulting the bid engine

Decisioning SHALL resolve the slot configuration — slot id, accepted creative formats, accepted dimensions, brand-safety profile — from inventory configuration before issuing a bid request.

#### Scenario: Unknown slot id returns no-fill

- **WHEN** a retailer surface requests a fill for slot id `slot-unknown-42`
- **THEN** decisioning SHALL return a no-fill response within 50ms
- **AND** decisioning SHALL emit a `decisioning.unknown_slot` metric tagged by retailer
- **AND** decisioning SHALL NOT consult the bid engine

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

### Requirement: Respect the slot's total latency ceiling

Decisioning SHALL return a response (fill or no-fill) within the retailer-declared latency ceiling for the slot. The ceiling is configured per retailer (default 150ms).

#### Scenario: Ceiling breach returns no-fill

- **WHEN** decisioning has not received a bid response within 90% of the slot's latency ceiling
- **THEN** decisioning SHALL abandon the auction and return a no-fill response within the ceiling
- **AND** decisioning SHALL emit a `decisioning.ceiling_breach` metric tagged by retailer and slot
