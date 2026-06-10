# Tasks

## 1. Ingest

- [x] 1.1 Stand up the `pixel-ingest` Lambda
- [x] 1.2 Implement HMAC validation on the pixel URL
- [x] 1.3 Publish `impressions` events to Kafka with strict per-campaign partitioning

## 2. Decisioning integration

- [x] 2.1 Generate the signed pixel URL inside decisioning
- [x] 2.2 Include `tracking.impression_pixel_url` in the fill response
- [x] 2.3 Document the pixel contract for retailer integration partners

## 3. Validation

- [x] 3.1 End-to-end test: fill → pixel fetch → `impressions` event
- [x] 3.2 Replay-attack test: same pixel URL fetched twice produces one event
