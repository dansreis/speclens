# Migrate Bid State to ScyllaDB

## Why

The bid-state cache lives in Redis (ADR-0002). That choice held until two pressures combined to break it: working-set growth past the cost-efficient Redis-memory point, and cross-region budget-counter divergence that produced enough overspend incidents that finance noticed.

The decision and its alternatives are documented at length in ADR-0006. The short version: move bid-state to ScyllaDB, keep Redis only for short-lived idempotency keys, retain the 80ms p99 bid-engine budget (ADR-0004) throughout.

This is the platform's first capability-modifying change driven by a hard operational constraint rather than a new product capability.

## What Changes

- Migrate bid-state from Redis to ScyllaDB.
- Atomic counters move from Redis INCR to Scylla counter columns.
- Redis is retained only for short-lived idempotency keys (frequency-cap dedup, click-dedup).
- New ADR (0006) supersedes ADR-0002.

## Capabilities

- **Modified Capabilities**:
  - `bid-engine` — the bid-state-source-of-truth requirement now points at ScyllaDB; the latency budget is unchanged

## Impact

- New ScyllaDB cluster (self-managed on EKS, three-region active-active).
- Decommission of the production Redis cluster (post-cutover); retention for the idempotency-key cluster.
- Migration is dual-write for two weeks, then read-cutover, then write-cutover.
- ADR-0002 is frozen as historical record (not edited) and ADR-0006 names it in `Supersedes:`.
