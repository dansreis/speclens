# Add Multi-Touch Attribution

## Why

Last-click attribution (ADR-0007) shipped as a deliberate first-version choice with the explicit caveat that it would need to be revisited once brand campaign volume could support a better model. Two pressures forced the revisit ahead of schedule: three of our largest brand customers are running last-click on AdMedia and multi-touch elsewhere and cannot reconcile our numbers with their cross-channel view; and brand-awareness campaigns are losing budget to lower-funnel placements on every internal review because last-click structurally under-credits them.

The right answer is to move the platform default to multi-touch with time-decay credit, retaining last-click as a per-campaign override.

## What Changes

- The default attribution model becomes multi-touch with time-decay credit (24h half-life).
- Each qualifying touchpoint receives a fractional credit `2^(-Δt / half_life)`; weights are normalised per conversion.
- Last-click is retained as a per-campaign override for measurement-parity reasons.
- ClickHouse schema changes to store per-impression credit fractions.
- A new ADR (0008) supersedes ADR-0007.
- **BREAKING**: rollups under multi-touch are not arithmetically comparable to historical last-click numbers. Both are published for one quarter post-migration; the last-click rollup is then deprecated.

## Capabilities

- **Modified Capabilities**:
  - `attribution-reporting` — default model changes; per-campaign override added

## Impact

- ClickHouse storage cost increases roughly proportionally with average touchpoints-per-conversion.
- Brand-facing dashboards need a "credit-share" view to remain auditable.
- ADR-0007 is frozen as historical record; ADR-0008 names it in `Supersedes:`.
- Cross-team coordination: brand-success team needs migration messaging for the three brand customers requesting this.
