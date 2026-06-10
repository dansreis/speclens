# event-ingestion delta

## REMOVED Requirements

### Requirement: Accept impressions via a signed pixel URL

**Reason**: Pixel-based impression confirmation has been replaced by the signed-payload HTTPS ingestion endpoint. Three retailer privacy teams have specifically asked us to remove the 1×1 GIF tracker path. Decommissioning the `pixel-ingest` Lambda also removes a fixed monthly cost on the decisioning edge.

**Migration**: Retailer surfaces still depending on the pixel path SHALL migrate to the signed-payload HTTPS endpoint at `POST /v0/events` before 2026-07-30. Brand-success owns the migration coordination with the three remaining surfaces. The signed-payload contract is documented in the existing requirement `Accept events via a signed-payload HTTPS endpoint` — no new requirement is introduced by this change.

After 2026-07-30, requests against any pixel URL SHALL receive a 410 Gone response.
