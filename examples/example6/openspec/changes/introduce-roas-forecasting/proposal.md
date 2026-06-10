# Introduce ROAS Forecasting

## Why

Brands setting up a campaign today see a budget input and… not much else. There is no platform-side answer to "what should I expect this to do?" before the campaign runs. Brand teams build their own spreadsheet models out of the platform's historical data, and they routinely under- or over-budget because those models miss platform-side dynamics (auction density, pacing behaviour, seasonal traffic).

If the platform offered a forward-looking ROAS / impression-volume estimate at campaign-setup time, brands would make better budget decisions and we would close a meaningful gap against off-site channels that already provide this.

This is a proposal-stage change. We have not yet built it; we want sign-off on direction before investing in the modelling and the UI surface.

## What Changes

- New `roas-forecasting` capability: at campaign-setup time, brands see a forward-looking estimate for impression volume, eCPM, and ROAS over the flight window.
- Forecast inputs: campaign budget, targeting (audience segments, geo, day-part), flight window, retailer.
- Forecast outputs: point estimate + confidence range for impressions, eCPM, and ROAS.
- Forecasts roll up across audience segments and retailers — the same modelling primitives serve both campaign-setup forecasts and aggregate cross-campaign forecasts in retailer reporting.

## Capabilities

- **New Capabilities**:
  - `roas-forecasting`
- **Modified Capabilities**:
  - `attribution-reporting` — forecast outputs may be displayed alongside historical ROAS in brand-facing reports
  - `audience-targeting` — segment-level audience-size estimates may be exposed via the same modelling primitives

## Impact

- Cross-cuts three capabilities. Largest design surface of any change in flight.
- New service: `forecasting-worker` (ClickHouse-heavy reads + offline-trained model).
- New brand-console screens for campaign-setup forecasting and brand-portfolio forecasting.
- This proposal stops here. Specs, design, ADRs, and tasks are deferred pending direction sign-off.

---

**Status: Proposal only.** No specs, no design, no tasks, no ADR yet. The next step after sign-off is a design.md exploring the modelling approach (rule-based forecasts vs trained model) and the ADR for whichever path wins.
