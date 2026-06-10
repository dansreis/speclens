# Tasks

## 1. Data model

- [x] 1.1 Add `keyword_block` rule type to the `brand_safety_rules` table
- [x] 1.2 Define the rule-params shape (terms[], selector)
- [x] 1.3 Migration

## 2. Decisioning

- [x] 2.1 Implement the keyword-block evaluator (case-insensitive, accent-insensitive)
- [x] 2.2 Wire matching-term capture into the audit-log payload
- [x] 2.3 Benchmark against the 80ms p99 budget

## 3. Rule-management UI

- [x] 3.1 Add the keyword-block form in the retailer console
- [x] 3.2 Inline validation for empty term lists
- [ ] 3.3 Surface matching-term in the rejection-history view

## 4. Validation

- [x] 4.1 End-to-end test: term match rejects the bid
- [x] 4.2 End-to-end test: accent-insensitive match (`"acai"` matches `"Açaí"`)
- [x] 4.3 Latency regression test still meets ADR-0004
