# Design — Add Fraud Shadow Mode

## Context

The rule-based fraud scorer was the right call at launch — interpretable, defensible to brand auditors, easy to evolve. It is also leaving real fraud uncaught: brand-side research teams have flagged sustained low-and-slow click-farm traffic that the rule set does not score above 0.5, and one organised impression-fraud ring last quarter that the rules did not catch at all.

A candidate ML scorer trained on six months of platform-labelled fraud data outperforms the rule-based scorer on the held-out evaluation set: F1 0.78 vs 0.59. Putting it directly into the billing path is a non-starter; we don't know its false-positive behaviour under live production traffic.

The standard answer is shadow mode: run the new scorer in parallel, do not use its scores for any production decision, surface side-by-side comparison data, decide cutover separately.

## Goals / Non-Goals

**Goals:**
- Run the ML scorer against live production `impressions` and `clicks` traffic.
- Publish ML scores to a side topic with the same per-event payload shape as the production `fraud-scores` topic.
- Make divergence between rule-based and ML scores observable per-event and in aggregate.
- Zero impact on billing, pacing, reporting, or any production decision.

**Non-Goals:**
- This change does not decide ML cutover. Cutover is a separate change, gated on shadow-mode data.
- This change does not retrain the ML model in production. The model bundle is static; retraining lives offline.
- This change does not address the deploy-artefact-size problem for ML models generally — narrowly handled for this model only.

## Decisions

### Decision: Kafka side topic, not in-process dual scoring

Two architectures were weighed:

1. **Side topic** (chosen) — `fraud-scorer-ml` is its own service, consumes from the same `impressions` / `clicks` topics, publishes to a new `fraud-scores-shadow` topic. Comparison happens off-stream via Grafana over ClickHouse.
2. **In-process dual scoring** — extend the existing `fraud-scorer` to run both rule-based and ML scorers in-process; publish both scores in a single event.

Side-topic wins because it isolates the ML scorer's failure modes — a model crash, a memory leak, an inference latency spike — entirely from the production scoring path. In-process dual scoring couples them and a production scorer outage caused by the shadow scorer is a real failure mode we do not want.

**Alternative considered and rejected:** **batch shadow scoring overnight.** Cheaper, but does not catch the same diurnal patterns that live traffic exhibits. The shadow signal is much weaker.

### Decision: ML model deployed as a separate service, not as a sidecar

The model bundle is 1.2GB. Co-located as a sidecar with the existing `fraud-scorer`, every rolling deploy of the rule-based scorer would re-download the bundle. Separate deployment lets the ML scorer's deploy cadence diverge from the rule-based scorer's.

## Event flow

```
                  ┌──────────────────────┐
                  │  Kafka: impressions  │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
   ┌──────────────────┐          ┌──────────────────┐
   │ fraud-scorer     │          │ fraud-scorer-ml  │
   │ (rules)          │          │ (ML candidate)   │
   └────────┬─────────┘          └────────┬─────────┘
            │                             │
            ▼                             ▼
   ┌──────────────────┐          ┌──────────────────────┐
   │ fraud-scores     │          │ fraud-scores-shadow  │
   │ (production)     │          │ (shadow only)        │
   └────────┬─────────┘          └────────┬─────────────┘
            │                             │
            ▼                             ▼
   billing / pacing /            comparison dashboard
   reporting                     (Grafana, no production
                                  decisions)
```

The rule-based path is unchanged. The ML path is strictly additive.

## Risks / Trade-offs

- **[Risk] Doubled Kafka consumer load on `impressions` and `clicks`.** → Mitigation: capacity already accounted for; the topics are partitioned generously.
- **[Risk] ML scorer's latency exceeds 60-second SLA, gets backlogged.** → Mitigation: shadow-mode SLA is best-effort; backlog only delays the comparison dashboard, not anything production.
- **[Risk] Brand teams see the shadow scores and start asking why we haven't cut over.** → Mitigation: clear UI labelling; comparison dashboard is internal-only for the duration.

## Open Questions

- **Cutover criteria.** What does "ML scorer is ready to promote" look like? Provisional: F1 on the production-labelled set ≥ 0.75 over 30 days, false-positive rate below the rule-based scorer's by 2 percentage points. Owner of that decision: brand-success + fraud team jointly. Decide before shadow mode reaches steady state.
- **Score-divergence alerting.** Should we alert if the ML scorer disagrees with the rule-based scorer beyond some threshold? Provisional: yes, but only as an analyst signal — not pager-level.
