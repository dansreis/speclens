# Tasks

## 1. Storage

- [x] 1.1 Additive ClickHouse migration: add `credit_fraction` column
- [x] 1.2 Add `attribution_touchpoints` materialised view
- [x] 1.3 Benchmark storage growth on 30 days of production-like data

## 2. Attribution worker

- [x] 2.1 Implement the multi-touch time-decay credit calculation
- [x] 2.2 Implement the per-conversion normalisation
- [x] 2.3 Implement the per-campaign last-click override path
- [x] 2.4 Shadow-mode publishing to the side rollup

## 3. Reporting API

- [x] 3.1 Extend the brand-facing reporting endpoints with credit-share
- [x] 3.2 Add the credit-share dashboard view in the brand console
- [ ] 3.3 Migrate the platform-level rollup to multi-touch (gated on reconciliation sign-off)

## 4. ADR

- [x] 4.1 Write ADR-0008 (Multi-touch attribution with time-decay credit, supersedes ADR-0007)

## 5. Validation and rollout

- [x] 5.1 Reconciliation against brand-success expected ratios on three pilot brands
- [ ] 5.2 Brand-success messaging draft for the historical-numbers-change communication
- [ ] 5.3 Cutover plan reviewed with each of the three brand customers requesting this
- [ ] 5.4 Deprecate the last-click rollup at the start of next quarter
