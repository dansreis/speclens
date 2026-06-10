# Design — Migrate Bid State to ScyllaDB

## Context

ADR-0002 selected Redis as the bid-state cache. That choice held until late Q1 2026, when two pressures combined to break it.

**Working set.** As retailer count grew past twenty, the active line-item count crossed ten million. The bid-state working set crossed the inflection point where Redis-memory sharding overhead grew super-linearly with cluster size. We were two scaling events away from Redis costing more than the bid-engine compute it served.

**Cross-region budget divergence.** Redis cross-region replication is asynchronous and lossy under partition. After the platform expanded into a second region, three measurable overspend incidents in six weeks were traced to budget counters diverging between regions for tens of seconds during partition events. Finance noticed.

The bid-engine p99 latency budget (ADR-0004) is unchanged: any replacement must respect 80ms p99.

## Goals / Non-Goals

**Goals:**
- Move bid-state read path to a backend that scales linearly with disk, not RAM.
- Make budget-counter operations strongly-consistent within a region and reconcile cleanly across regions.
- Hold the bid-engine p99 latency budget (ADR-0004).
- Zero overspend incidents post-cutover.

**Non-Goals:**
- This change does not redesign the bid-engine itself.
- This change does not move idempotency keys (frequency-cap dedup, click-dedup) off Redis — those are short-lived and the Redis pattern fits.
- This change does not change the bid-state cache contract from the bid-engine's perspective. The cache is an opaque key-value store from the engine's side.

## Decisions

### Decision: ScyllaDB, not larger Redis, not custom Rust in-memory store

Three options were weighed (full prose in ADR-0006). The summary:

| Option | Working-set ceiling | Multi-region | Engineering cost |
|---|---|---|---|
| Larger Redis | Constrained by RAM | Async / lossy | Low |
| ScyllaDB | Bounded by disk | Built-in | Medium |
| Custom Rust store | Whatever we build | Whatever we build | Very high |

The larger-Redis path does not solve the budget-divergence root cause. The custom store has unbounded engineering cost. ScyllaDB sits on the cost-engineering frontier.

### Decision: Dual-write for two weeks before cutover

Two-week dual-write is long enough to catch slow-emerging divergence bugs (we have seen one on a prior migration that only fired under a specific traffic pattern that occurred once a week). It is short enough to keep the operational complexity of dual-write bounded.

**Alternative considered and rejected:** **read-once shadow comparison.** Cheaper, but only verifies a snapshot; doesn't catch the slow-emerging divergence patterns.

### Decision: Atomic counters via Scylla counter columns, not Lightweight Transactions

ScyllaDB counter columns are designed for high-throughput increment-only operations. LWT gives stronger semantics at a heavy latency cost (multiple round-trips for the Paxos round). The 80ms p99 budget cannot absorb LWT latency.

We accept the trade-off: counter columns are eventually-consistent across regions (with a small reconciliation window in seconds). This is sharply better than Redis's async replication and is materially within tolerance for budget-pacing.

## Risks / Trade-offs

- **[Risk] Migration introduces a regression on the 80ms budget.** → Mitigation: pre-migration bench under representative load; abort criteria on p99 > 80ms during dual-write.
- **[Risk] ScyllaDB operational expertise is thin on the team.** → Mitigation: ScyllaDB-team office hours during dual-write window; runbook investment ahead of cutover.
- **[Risk] Counter divergence under partition is still possible.** → Mitigation: per-region reconciliation cron + an alert when any line-item's regional counters diverge by more than 2%.

## Migration Plan

```
Week 0:  Stand up ScyllaDB cluster                            ▓░░░░░░░░░░░░
Week 1:  Schema migration + dual-write wired                  ▓▓░░░░░░░░░░░
Week 2-3: Dual-write soak — reconciliation cron + on-call     ▓▓▓▓░░░░░░░░░
Week 4:  Read-cutover behind per-region feature flag          ▓▓▓▓▓░░░░░░░░
Week 5:  72h clean → write-cutover                            ▓▓▓▓▓▓░░░░░░░
Week 6:  Decommission Redis bid-state cluster                 ▓▓▓▓▓▓▓░░░░░░
```

Rollback at any step before the write-cutover is a feature-flag flip. Rollback after the write-cutover requires replaying the dual-write reconciliation snapshot to Redis — a documented but uncomfortable path. We give ourselves until end of Week 5 to abort cheaply.

## Open Questions

- None at design time. The decision and migration plan got infrastructure sign-off in advance.
