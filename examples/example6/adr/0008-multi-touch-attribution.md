# 0008. Multi-touch attribution with time-decay credit

- Status: accepted, supersedes ADR-0007
- Date: 2026-05-25

Supersedes: ADR-0007

## Context

ADR-0007 made last-click attribution the platform default as a deliberate first-version choice, with the explicit caveat that it would need to be revisited once brand campaign volume could support a better model.

Two pressures forced the revisit ahead of schedule:

1. **Brand-side measurement parity.** Three of our largest brand customers run last-click on AdMedia and multi-touch elsewhere; their internal mix-modelling teams cannot reconcile our numbers with their cross-channel view and have asked for parity.
2. **Brand-awareness campaigns underperforming on paper.** Brands running upper-funnel placements see inflated CPA and deflated ROAS under last-click, even when matched-market lift studies show the campaigns are working. Sales are losing budget to lower-funnel placements that benefit from last-click's structural bias.

Three options were weighed:

1. **Stay on last-click.** Zero disruption, but the measurement-parity ask doesn't go away.
2. **Switch the default to multi-touch with time-decay credit.** Distributes credit across qualifying touchpoints with a half-life parameter, capturing upper-funnel contribution.
3. **Offer both side-by-side.** Brands choose per-campaign. Maximum flexibility, but doubles the attribution-pipeline surface area and confuses cross-campaign rollups.

## Decision

The platform default attribution model becomes **multi-touch with time-decay credit**:

- Qualifying touchpoints are all impressions (clicked or viewed) within the 7-day window prior to a conversion.
- Each touchpoint receives a fractional credit weighted by `2^(-Δt / half_life)`, where `Δt` is the time between the touchpoint and the conversion, and `half_life` is 24h by default.
- Credit weights are normalised so the sum across all qualifying touchpoints for a conversion equals 1.0.

Last-click remains available as a per-campaign override — brands can pin a campaign to last-click for measurement-parity reasons, but the platform-level reporting rolls up on multi-touch.

## Consequences

- **Positive**: aligns with the model that large brand customers' mix-modelling teams use elsewhere.
- **Positive**: stops the structural under-crediting of upper-funnel placements.
- **Negative**: per-impression credit fractions enlarge the attribution table — ClickHouse cost grows roughly proportionally with average touchpoints-per-conversion.
- **Negative**: brand-facing dashboards become harder to audit ("which click won this?" no longer has a single answer). A "credit-share" view will be required.
- **Negative**: rollups under multi-touch are not arithmetically comparable to historical last-click numbers. We will publish both for one quarter then deprecate the last-click rollup.
