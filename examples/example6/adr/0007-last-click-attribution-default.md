# 0007. Last-click attribution as the platform default

- Status: accepted, superseded by ADR-0008
- Date: 2026-02-18

## Context

Brands need to know which of their ad impressions drove which conversions. The attribution question — "which touchpoint gets credit for this sale?" — has many defensible answers, but the platform needs a default that brands can reason about and that the team can build before having attribution-research expertise on staff.

Three models were weighed for the initial release:

1. **Last-click within a 7-day window.** Credit the most recent ad click within seven days of the conversion. Industry-standard, trivially explainable, easy to compute.
2. **Last-touch (click-or-view) within a 7-day window.** Includes ad views even without clicks. Closer to "true exposure", but conflates intent signals with passive exposure and inflates reported ROAS.
3. **Multi-touch / fractional credit.** Distribute credit across multiple touchpoints with a learned model. Most accurate in expectation, but requires a meaningful conversion volume per campaign to train and is hard for brands to audit.

At launch, brand volume per campaign is too low for fractional models to converge. We accept the inaccuracy of last-click as a deliberate first-version choice.

## Decision

The default attribution model is **last-click within a 7-day window**, measured by:

- A conversion event is attributed if its `conversion_at` is within 7 days of an `impressions.clicked_at` event from the same campaign and same user.
- Among all qualifying clicks, credit is assigned 100% to the most recent.
- If no qualifying click exists, the conversion is reported as **unattributed** and does not roll up into any campaign's ROAS.

Click and conversion identity matching uses the platform's cross-surface user-id resolution service (out of scope for this ADR).

## Consequences

- **Positive**: simple to compute, simple to explain, simple to audit. Brand-facing dashboards can show the click that won the credit.
- **Positive**: keeps the first version's data model small — no per-impression credit fractions to store.
- **Negative**: systematically under-credits upper-funnel exposure (views without clicks). Brands running brand-awareness campaigns will see deflated ROAS.
- **Negative**: last-click is a known oversimplification; once brand campaign volume grows we will need a better model.
