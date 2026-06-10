# Tasks

## 1. ScyllaDB stand-up

- [x] 1.1 Provision the three-region ScyllaDB cluster on EKS
- [x] 1.2 Schema design with partition keys (line_item_id, audience_segment)
- [x] 1.3 Bench atomic counter performance against the 80ms p99 budget

## 2. Dual-write

- [x] 2.1 Dual-write path in the bid-engine cache writers
- [x] 2.2 Reconciliation job comparing Redis vs Scylla state hourly
- [x] 2.3 Two-week dual-write soak with on-call rota

## 3. Cutover

- [x] 3.1 Read-cutover behind a feature flag per region
- [x] 3.2 Write-cutover after 72h of clean read-cutover
- [x] 3.3 Decommission the bid-state Redis cluster (keep idempotency Redis)

## 4. ADR + cleanup

- [x] 4.1 Write ADR-0006 (ScyllaDB for bid-state cache, supersedes ADR-0002)
- [x] 4.2 Confirm ADR-0002's file is untouched after the supersession
- [x] 4.3 Re-run the multi-region overspend reproduction — confirm no divergence
