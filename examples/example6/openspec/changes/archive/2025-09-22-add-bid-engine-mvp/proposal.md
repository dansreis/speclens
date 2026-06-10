# Add Bid Engine MVP

## Why

We have campaigns. Nothing serves them. The bid engine is the first piece of platform plumbing that turns a "live" campaign into an actual bid response when an ad slot is requested. This is the highest-stakes piece of the platform for latency — it sits in the synchronous render path of every retailer surface — and the architectural commitments made here (latency budget, storage backend) need to be lasting.

## What Changes

- New `bid-engine` service (Rust, in-cluster) accepting bid-request RPCs and returning at most one bid response.
- Bid-state cache (Redis, ElastiCache) populated by CDC from the catalog Postgres.
- Hard p99 latency budget of 80ms — load-bearing architectural commitment captured as ADR-0004.
- Eligibility evaluation by simple eCPM ranking. No pacing, no fraud, no brand-safety — those land in later changes.

## Capabilities

- **New Capabilities**:
  - `bid-engine`

## Impact

- New service `bid-engine` (Rust). New deployment on EKS.
- New ElastiCache Redis cluster.
- New ADRs: 0002 (Redis for bid-state cache), 0004 (p99 latency budget).
- Establishes the synchronous-Postgres-read prohibition: the bid engine MUST NOT query Postgres in the hot path.
