# Add Ad Decisioning Pipeline

## Why

The bid engine returns bids. It does not return ads. Retailer surfaces don't speak to the bid engine — they speak to a decisioning edge that resolves slot configuration, calls the bid engine, applies safety, and returns either a creative payload or a no-fill. This change adds that edge.

This is the first cross-cutting change in the platform — it touches `ad-decisioning` (new) and modifies the contract the bid engine is called against.

## What Changes

- New `ad-decisioning` edge service running on Lambda@Edge in front of retailer surfaces.
- Slot-id resolution from inventory configuration before any bid call.
- Slot-level latency ceiling: decisioning returns no-fill if it can't meet the retailer's declared budget.
- Wire decisioning → bid-engine gRPC.

## Capabilities

- **New Capabilities**:
  - `ad-decisioning`

## Impact

- New Lambda@Edge deployment.
- The retailer-facing ad-request contract is now stable: `POST /v0/serve?slot=<id>`.
- Establishes that brand-safety checks run AFTER the bid is returned, not before — refined later in `introduce-brand-safety`.
