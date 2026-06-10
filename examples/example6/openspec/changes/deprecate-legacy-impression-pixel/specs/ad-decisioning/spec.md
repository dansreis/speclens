# ad-decisioning delta

## MODIFIED Requirements

### Requirement: Return a creative payload when a bid wins

When the bid engine returns a winning bid that passes brand-safety checks, decisioning SHALL return a creative payload containing the creative asset URL and the click-through URL. The payload SHALL NOT contain a `tracking.impression_pixel_url` field — impression confirmation now flows exclusively through the signed-payload HTTPS endpoint owned by the retailer surface.

#### Scenario: Winning bid passes brand-safety

- **WHEN** the bid engine returns a winning bid for line-item L on slot S
- **AND** L's creative passes the brand-safety profile attached to S
- **THEN** decisioning SHALL return a 200 response containing `creative.asset_url` and `creative.click_url`
- **AND** the response SHALL NOT contain `tracking.impression_pixel_url`
- **AND** decisioning SHALL fire-and-forget an impression-pending event to Kafka

#### Scenario: Brand-safety rejection falls through to next bid

- **WHEN** the bid engine returns a winning bid for line-item L
- **AND** L's creative fails the brand-safety profile attached to the slot
- **THEN** decisioning SHALL discard the bid and request the next-ranked eligible bid from the bid engine
- **AND** decisioning SHALL emit a `decisioning.brand_safety_reject` metric tagged by retailer, line-item, and rule id
