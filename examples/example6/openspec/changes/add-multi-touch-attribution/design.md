# Design — Add Multi-Touch Attribution

## Context

The platform default attribution model is last-click within a 7-day window (ADR-0007). The decision shipped with an explicit revisit trigger: "once brand campaign volume could support a better model." Two pressures forced the revisit:

1. **Brand-side measurement parity.** Three of our largest brand customers run last-click on AdMedia and multi-touch elsewhere. Their internal mix-modelling teams cannot reconcile our numbers with their cross-channel view and have asked, individually and consistently, for parity.
2. **Upper-funnel under-crediting.** Brands running brand-awareness placements see inflated CPA and deflated ROAS under last-click, even when matched-market lift studies show the campaigns are working. Internal budget reviews keep stripping spend from these placements because the reported numbers look bad.

Both pressures point at the same fix: switch to a model that distributes credit across qualifying touchpoints.

## Goals / Non-Goals

**Goals:**
- Default attribution model produces credits that brand mix-modelling teams can reconcile against.
- Upper-funnel touchpoints receive measurable credit.
- 15-minute attribution latency SLO is preserved.
- Last-click remains queryable for the three brand customers that have measurement contracts referencing it.

**Non-Goals:**
- This change does not introduce a learned attribution model. The time-decay model is rule-based; no training data is required.
- This change does not unify cross-channel attribution. Multi-touch within AdMedia is the scope; cross-channel reconciliation remains the brand's responsibility.

## Decisions

### Decision: Time-decay multi-touch, not flat or position-based

Three model variants were weighed:

| Model | Description | Trade-off |
|---|---|---|
| Flat (linear) | Each qualifying touchpoint receives 1/N of the credit. | Easy to reason about. Over-credits ancient touchpoints. |
| Position-based (U-shape) | First and last touchpoint each get 40%; middle touchpoints share the remaining 20%. | Captures the funnel-edge intuition. Arbitrary weights. |
| Time-decay (chosen) | Credit decays exponentially with distance from conversion. | Continuous, intuitive, parameterised by a single half-life value. |

Time-decay was chosen because it has one tunable parameter (half-life) that maps onto a real business intuition ("how recently does a touchpoint matter?"), it requires no arbitrary segment boundaries, and the three brand customers that prompted this change all run time-decay variants in their own stacks.

**Alternative considered and rejected:** **Markov-chain removal effects.** Most accurate in expectation, requires training data per campaign, brand teams cannot audit "why did this touchpoint get this credit". Defer.

### Decision: 24-hour half-life as the default

The half-life parameter governs how aggressively recent touchpoints are credited. 24 hours was chosen because:

- A 24h half-life weights a click 1 day before conversion at 50% and a click 7 days before at ~0.8%. This roughly matches the "things that matter to a shopping decision" intuition.
- Shorter half-lives (e.g. 4h) collapse credit onto effectively-the-most-recent touchpoint, recreating the last-click problem.
- Longer half-lives (e.g. 7 days) flatten the model toward linear attribution and dilute the funnel signal.

Per-campaign half-life override is allowed; the default is 24h.

### Decision: Retain last-click as a per-campaign override

Three brand customers have measurement contracts that explicitly reference last-click. Forcing them onto multi-touch breaks those contracts. Per-campaign override allows the platform default to be modern without rupturing customer commitments.

The override is a single field on the campaign (`attribution_model: 'multi_touch' | 'last_click'`). Platform-level rollups use multi-touch regardless of campaign override; per-campaign rollups respect the override.

## Risks / Trade-offs

- **[Risk] Per-impression credit fractions enlarge the attribution table.** → Mitigation: ClickHouse compression handles this well in practice; benched at expected production volumes.
- **[Risk] Brand-facing dashboards become harder to audit ("which click won?").** → Mitigation: add a "credit-share" view per conversion showing the fractional credit allocated to each qualifying touchpoint.
- **[Risk] Historical last-click numbers and new multi-touch numbers are not comparable.** → Mitigation: publish both for one quarter; deprecate last-click rollup at the end of that window with documented brand-success messaging.

## Migration Plan

```
Week 0:  Schema migration on ClickHouse (additive — credit_fraction column)
Week 1:  Multi-touch worker runs in shadow mode; publishes to a side rollup
Week 2:  Internal reconciliation between shadow rollup and brand-success expectations
Week 3:  Cutover — platform-level rollup switches to multi-touch
Week 4:  Brand-facing dashboards gain the credit-share view
Q+1:     Deprecate the last-click rollup; brand-success owns the messaging
```

Rollback before cutover is a feature-flag flip. Rollback after cutover requires republishing the legacy last-click rollup from the retained ClickHouse columns.

## Open Questions

- ADR-0007 needs to be superseded by a new ADR (0008) capturing this decision. The adr step will record it.
- Per-campaign override field needs to flow through the campaign-management API surface. Owner: campaign-management team, separate small change.
