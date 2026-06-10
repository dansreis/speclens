# Add Creative Approval Workflow

## Why

Today, any creative a brand uploads is immediately serveable. Three retailers have asked for the ability to review creatives before they appear on their surfaces — partly for brand-safety reasons that profile rules can't catch (visual taste, off-brand tone), partly because their legal teams want a human in the loop for new advertiser categories.

This change adds a retailer-side approval workflow that gates creatives from serving on that retailer's surfaces until a reviewer has approved them.

## What Changes

- New `creative-approval` capability: creatives enter `submitted` state and require a retailer reviewer to transition them to `approved` before they become serveable.
- Inventory contract unchanged; the gate is at creative-attachment time.
- Webhooks fire on approval / rejection so brand-side tooling can pick the events up.

## Capabilities

- **New Capabilities**:
  - `creative-approval`
- **Modified Capabilities**:
  - `api-keys-and-webhooks` — webhooks are added in this change (proposal note for `init-platform-skeleton` had this as a TODO)

## Impact

- New tables: `creative_revisions`, `approval_decisions`.
- New `creative.approved` and `creative.rejected` webhook event types.
- Existing creatives are grandfathered as `approved` on their owning retailer at migration time.
