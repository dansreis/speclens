# Add Last-Click Attribution

## Why

Brands have impressions, clicks, and conversions. They cannot answer the only question that matters to them: which of these drove the others? Until we ship attribution, the reporting we expose is operational telemetry (did the campaign run) rather than commercial measurement (did the campaign work).

This change ships the first attribution model: last-click within a 7-day window. It is deliberately the least-sophisticated defensible default — see ADR-0007 for why we chose it over more accurate alternatives at this stage.

## What Changes

- New `attribution-reporting` capability and pipeline.
- Last-click model: credit the most recent click from the same campaign and same user within 7 days of the conversion.
- Brand-facing ROAS and CPA rollups derived from attributed conversions only.
- 15-minute attribution latency SLO.
- New ADR (0007) capturing the model choice.

## Capabilities

- **New Capabilities**:
  - `attribution-reporting`

## Impact

- New ClickHouse cluster for analytics rollups.
- New attribution worker consuming `clicks` and `conversions` from Kafka.
- Brand-facing reporting API extended with `roas`, `cpa`, `attributed_conversions` fields.
- Establishes the convention that unattributed conversions are visible but excluded from rollups.
