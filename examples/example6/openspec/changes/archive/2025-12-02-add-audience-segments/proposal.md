# Add Audience Segments

## Why

Untargeted retail-media bids are worth a fraction of targeted ones. Brands cannot run their actual buying motion against the platform until they can attach audience segments to line-items. Retailers, meanwhile, are sitting on the most valuable first-party purchase data in the channel; turning it into segments is how we monetise the platform's structural advantage over off-site channels.

## What Changes

- New `audience-targeting` capability: line-items can include and exclude retailer-published audience segments.
- Audience-segment membership is resolved by the retailer at request time (not pre-computed by the platform) — keeps the platform out of the PII-storage business and respects each retailer's identity system.
- Bid engine eligibility evaluation extended to honour include/exclude sets.

## Capabilities

- **New Capabilities**:
  - `audience-targeting`

## Impact

- New `audience_segments` and `line_item_segments` tables.
- Decisioning contract extended: ad requests may include an `audience_labels` field.
- Bid engine eligibility logic gains a segment-membership predicate.
- No platform-side membership cache — deliberate design choice to keep the platform off the PII liability path.
