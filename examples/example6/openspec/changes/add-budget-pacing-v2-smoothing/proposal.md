# Add Budget Pacing v2 Smoothing

## Why

Budget pacing v1 uses a uniform daily-budget distribution across remaining hours of the flight day. It is the simplest defensible model and it works — for round-number days with steady traffic. It does not work well for two real patterns we see:

1. **Peak-window retailers**: traffic on grocery and discount retailers peaks sharply on weekday evenings and Saturday mornings. Uniform pacing systematically under-spends during peaks and over-spends during troughs, dragging average eCPM down.
2. **Day-part campaigns**: brands running breakfast-CPG campaigns explicitly want to bias spend toward morning hours. Uniform pacing fights this intent.

Both patterns need a smoothing layer that adapts the expected-spend curve to historical traffic patterns rather than treating every hour the same.

## What Changes

- New per-line-item smoothing profile: `uniform` (current), `traffic-weighted` (new default), `day-part` (custom hours).
- New `expected_spend_curve` precomputed daily per line-item using the previous 14 days of impression traffic on the targeted slots.
- Pacing posture computation continues to use the same throttle / suspend thresholds, but compares against the new curve.
- **MODIFIED**: the requirement "Compute pacing posture from observed spend" gets a new expected-spend mechanism.
- **ADDED**: brand can configure the smoothing profile per line-item.

## Capabilities

- **Modified Capabilities**:
  - `budget-pacing` — pacing-posture mechanism MODIFIED; smoothing-profile configuration ADDED

## Impact

- New daily batch job: `pacing-curve-builder`.
- Adds a config field on `line_items.smoothing_profile` (default migrates existing line-items to `traffic-weighted` once historical data is sufficient — currently `uniform` is preserved as fallback).
- No change to the 60-second posture-update SLO.
- References the requirement that is being renamed in `rename-stop-overspend-requirement` — coordinate.
