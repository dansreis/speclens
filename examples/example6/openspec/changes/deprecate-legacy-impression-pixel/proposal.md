# Deprecate Legacy Impression Pixel

## Why

The platform shipped impression confirmation via a signed 1×1 tracking pixel (`add-impression-pixel`, archived 2025-10-28). Since then we have added a signed-payload HTTPS ingestion endpoint for native app surfaces and the two largest retailers have migrated all their surfaces to it. Of the remaining surfaces, three are stale integrations from retailers who have asked us to remove the pixel path entirely — their security teams flag the 1×1 GIF as a tracker and the optics are bad with their privacy reviews.

The pixel-ingest Lambda also consumes a non-trivial fraction of the decisioning edge cost. Removing the pixel path simplifies the decisioning response, eliminates a Lambda, and ends an awkward conversation with two retailer privacy teams.

## What Changes

- **BREAKING**: the impression-pixel ingest path is removed. Surfaces still using the pixel-confirmation path SHALL migrate to the signed-payload HTTPS endpoint before the cutover date (2026-07-30).
- Decisioning fill responses no longer include `tracking.impression_pixel_url`.
- The `pixel-ingest` Lambda is decommissioned.
- The `impressions` Kafka topic is unchanged — the upstream ingest path is what changes.

## Capabilities

- **Modified Capabilities**:
  - `event-ingestion` — the pixel-URL acceptance requirement is REMOVED (signed-payload endpoint is the only path)
  - `ad-decisioning` — the response payload no longer carries `tracking.impression_pixel_url`

## Impact

- Three retailer surfaces still on the pixel path must migrate by 2026-07-30. Brand-success has been working with them since April.
- Decisioning response schema becomes simpler; retailer-integration documentation needs an update.
- Lambda decommission removes ~$8k/month in edge spend.
