# 0006. ScyllaDB for bid-state cache

- Status: accepted, supersedes ADR-0002
- Date: 2026-03-28

Supersedes: ADR-0002

## Context

ADR-0002 selected Redis as the bid-state cache. That choice held until late Q1 2026, when two pressures combined to break it:

1. **Working-set growth.** As retailer count grew past twenty, the active line-item count crossed ten million. Holding that working set entirely in Redis memory required cluster sizes whose costs grew super-linearly with sharding overhead.
2. **Cross-region durability.** Redis cross-region replication is asynchronous and lossy under partition. As we expanded into a second region, budget counter divergence between regions produced visible overspend incidents (totalling enough that finance noticed).

A redesign considered three options:

1. **Stay on Redis, larger cluster, accept divergence.** Cheapest engineering effort, but does not solve the budget-divergence root cause.
2. **Move bid-state to ScyllaDB.** Wide-column store with sub-ms reads, eventually-consistent multi-region replication, persistence to disk so memory pressure no longer caps the working set.
3. **Move bid-state into a custom Rust in-memory store with explicit replication.** Maximum control, very high engineering cost, single-purpose technology to operate.

The bid-engine p99 latency budget (ADR-0004) is still 80ms — any replacement must respect it.

## Decision

Migrate bid-state from Redis to ScyllaDB (self-managed on EKS, three-region active-active topology). Counter operations use Scylla's atomic counters; pacing and frequency caps move with the data. Redis is retained only for short-lived idempotency keys.

## Consequences

- **Positive**: working set is bounded by disk, not RAM — capacity planning becomes linear again.
- **Positive**: multi-region replication is built into the storage layer, removing the application-level reconciliation logic that produced the overspend incidents.
- **Positive**: median bid-engine read latency drops slightly versus a sharded Redis cluster of equivalent capacity.
- **Negative**: ScyllaDB is operationally less familiar to the team than Redis. Investment in tooling and runbooks during migration.
- **Negative**: ScyllaDB's strongest performance assumes thoughtful partition-key design — schema choices are harder to revisit.
