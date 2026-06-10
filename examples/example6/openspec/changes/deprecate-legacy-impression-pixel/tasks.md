# Tasks

## 1. Decisioning response

- [x] 1.1 Remove `tracking.impression_pixel_url` from the fill response schema
- [x] 1.2 Update retailer-integration documentation
- [x] 1.3 Coordinate with brand-success on the three remaining retailer surfaces

## 2. Pixel-ingest decommission

- [x] 2.1 Add a deprecation header to existing pixel responses
- [x] 2.2 Switch pixel responses to 410 Gone after 2026-07-30
- [ ] 2.3 Decommission the `pixel-ingest` Lambda
- [ ] 2.4 Remove the Lambda's IAM role and CloudWatch dashboards

## 3. Validation

- [x] 3.1 End-to-end test: fill response no longer includes pixel URL
- [x] 3.2 Confirm signed-payload HTTPS path handles the migrated volume
- [ ] 3.3 Post-decommission canary: pixel URL returns 410 from every edge location
