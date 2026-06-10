# Tasks

## 1. Storage

- [x] 1.1 Provision the ElastiCache Redis cluster (single AZ, dev sizing)
- [x] 1.2 Build the CDC pipeline from catalog Postgres → Redis
- [x] 1.3 Verify cache-warm time after a cold restart (target < 5 min for dev data)

## 2. Service

- [x] 2.1 Scaffold the `bid-engine` Rust service
- [x] 2.2 Implement the bid-request RPC (gRPC over h2)
- [x] 2.3 Implement eCPM ranking
- [x] 2.4 Wire latency-budget metrics (p50, p95, p99 per minute)

## 3. ADRs

- [x] 3.1 Write ADR-0002 (Redis for bid-state cache)
- [x] 3.2 Write ADR-0004 (80ms p99 latency budget)

## 4. Validation

- [x] 4.1 Synthetic load test at 5k QPS sustained
- [x] 4.2 Confirm p99 < 80ms across the load test
- [x] 4.3 Confirm no Postgres queries fire during the load test
