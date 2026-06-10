# 0002. Redis for bid-state cache

- Status: accepted, superseded by ADR-0006
- Date: 2025-09-22

## Context

The bid engine must look up bid-state for every incoming auction request: active line-items targeting the slot, remaining flight budget, pacing posture, frequency-cap counters, and audience-membership bitmaps. Postgres latency for these reads would breach the 80ms p99 budget (see ADR-0004) at any meaningful QPS.

We need a hot cache that:

- Sustains low single-digit-ms reads under sustained QPS in the tens of thousands.
- Supports atomic increment-and-check operations for budget / frequency counters.
- Can be primed from Postgres on each catalog write via change-data-capture.

Two options were weighed:

1. **Redis (managed via ElastiCache)** — well-known, atomic INCR / DECR primitives, Lua scripting for compound updates.
2. **In-process LRU per bid-engine pod** — fastest possible, but consistency across pods becomes a coordination problem and the budget counters cannot live in-process at all.

## Decision

Use Redis 7 on ElastiCache as the bid-state cache. Each bid-engine pod connects to a regional cluster; budget and frequency counters live in dedicated keyspaces with atomic INCR semantics. CDC from Postgres warms the cache via a side-channel writer service.

## Consequences

- **Positive**: single-digit-ms reads from the bid-engine hot path; atomic counter operations remove a class of races.
- **Positive**: matches the team's existing operational expertise.
- **Negative**: Redis is memory-bound — as the catalog grows we will need to either shard aggressively or accept eviction-driven cache misses on cold keys.
- **Negative**: cross-region replication is asynchronous and lossy under partition; counter divergence is possible.
