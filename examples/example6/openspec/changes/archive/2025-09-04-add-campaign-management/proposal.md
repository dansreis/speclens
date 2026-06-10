# Add Campaign Management

## Why

The platform skeleton ships nothing brand-facing. Before we can run any of the bid-engine, decisioning, or reporting work, brands need a way to declare what they want to spend money on. Campaign management is the first product capability that touches a brand user.

## What Changes

- Brands can create, edit, pause, and resume campaigns scoped to a single retailer.
- Campaign owns flights; flight owns line-items; line-items carry bid, daily budget, and (later) audience targeting.
- Campaign lifecycle: `draft` → `active` → `paused` → `active` → `completed`.
- Edits to bids and budgets propagate to downstream services within 60s.

## Capabilities

- **New Capabilities**:
  - `campaign-management`

## Impact

- New tables: `campaigns`, `flights`, `line_items`. All carry `tenant_id`.
- New service surface: `/api/v0/campaigns/*` on the existing `catalog-api`.
- New Kafka topic: `campaign-lifecycle` (draft, activated, paused, resumed, completed events).
- Establishes the 60s lifecycle-propagation SLO that bid-engine and pacing will need to honour.
