# Tasks

## 1. Data model

- [x] 1.1 Add `audience_segments` table (id, retailer, label, description)
- [x] 1.2 Add `line_item_segments` table (line_item, segment, mode: include|exclude)
- [x] 1.3 Migrations + Flyway script

## 2. Bid engine

- [x] 2.1 Extend the bid-state cache key with segment requirements
- [x] 2.2 Implement include/exclude eligibility predicate
- [x] 2.3 Benchmark eligibility predicate against the 80ms p99 budget

## 3. Decisioning contract

- [x] 3.1 Extend the `/v0/serve` schema with `audience_labels`
- [x] 3.2 Pass labels through to the bid engine
- [x] 3.3 Update the retailer-integration documentation

## 4. Validation

- [x] 4.1 End-to-end test: include-segment narrows eligibility correctly
- [x] 4.2 End-to-end test: missing labels disable include-segment line-items
- [x] 4.3 Latency regression test still meets ADR-0004
