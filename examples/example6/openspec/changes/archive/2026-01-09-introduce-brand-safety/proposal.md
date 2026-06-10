# Introduce Brand Safety

## Why

Two retailer integration partners flagged the same concern in their pre-launch reviews: there is no way for the retailer to refuse an alcohol creative on a grocery-app home screen, or a competitor's creative anywhere on their surface. Both partners made signing conditional on having a meaningful brand-safety story.

This change adds per-slot brand-safety profiles and the rule evaluation pipeline that decisioning consults before returning a creative payload.

## What Changes

- New `brand-safety` capability: retailers can define profiles composed of category-block rules and content rules.
- Brand-safety profiles attach to slots (inventory-management is modified to require a profile reference).
- Decisioning consults the slot's profile after the bid engine returns a winner; failing creatives are discarded and the next-ranked bid is requested.

## Capabilities

- **New Capabilities**:
  - `brand-safety`
- **Modified Capabilities**:
  - `inventory-management` — slot registration now requires a brand-safety profile id
  - `ad-decisioning` — winning bids must pass brand-safety before the fill response is returned

## Impact

- New `brand_safety_profiles` and `brand_safety_rules` tables.
- New `decisioning.brand_safety_reject` metric and audit channel.
- Slot registration contract changes (breaking for retailers in the pre-launch integration program; coordinated with both partners).
