# ad-decisioning delta

## ADDED Requirements

### Requirement: Resolve slot configuration before consulting the bid engine

Decisioning SHALL resolve the slot configuration — slot id, accepted creative formats, accepted dimensions — from inventory configuration before issuing a bid request.

#### Scenario: Unknown slot id returns no-fill

- **WHEN** a retailer surface requests a fill for slot id `slot-unknown-42`
- **THEN** decisioning SHALL return a no-fill response within 50ms
- **AND** decisioning SHALL emit a `decisioning.unknown_slot` metric tagged by retailer
- **AND** decisioning SHALL NOT consult the bid engine

### Requirement: Return a creative payload when a bid wins

When the bid engine returns a winning bid, decisioning SHALL return a creative payload containing the creative asset URL, click-through URL, and the impression tracking pixel.

#### Scenario: Winning bid returns a creative payload

- **WHEN** the bid engine returns a winning bid for line-item L on slot S
- **THEN** decisioning SHALL return a 200 response containing the creative payload
- **AND** decisioning SHALL fire-and-forget an impression-pending event

### Requirement: Respect the slot's total latency ceiling

Decisioning SHALL return a response (fill or no-fill) within the retailer-declared latency ceiling for the slot. The ceiling is configured per retailer (default 150ms).

#### Scenario: Ceiling breach returns no-fill

- **WHEN** decisioning has not received a bid response within 90% of the slot's latency ceiling
- **THEN** decisioning SHALL abandon the auction and return a no-fill response within the ceiling
