# Add Impression Pixel

## Why

Decisioning returns creatives. We have no way to confirm they were actually rendered on the retailer's surface. Without an impression signal we cannot bill, cannot pace, cannot attribute, cannot detect fraud — most of the platform's downstream behaviour assumes impressions exist.

The cheapest, broadest-compatibility way to get an impression signal across web, app, and in-store-screen surfaces is a 1×1 tracking pixel returned alongside the creative payload, fetched by the surface when the creative is rendered.

## What Changes

- Decisioning bundles a tracking-pixel URL into every fill response.
- A new `pixel-ingest` Lambda receives pixel-fetch GETs and publishes an `impressions` event to Kafka.
- The pixel URL is HMAC-signed so it can't be replayed across campaigns or backfilled.

## Capabilities

- **New Capabilities**:
  - `event-ingestion` — the pixel ingest path is the first concrete implementation.

## Impact

- New Kafka topic: `impressions`.
- New Lambda: `pixel-ingest`.
- Decisioning response payload now contains a `tracking.impression_pixel_url` field.
- This is the legacy path. A signed-payload HTTPS endpoint will be added later for app-native surfaces (`add-signed-payload-ingestion`). The pixel path is later deprecated by `deprecate-legacy-impression-pixel`.
