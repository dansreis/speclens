# Tasks

## 1. Data model

- [x] 1.1 Add `brand_safety_profiles` table
- [x] 1.2 Add `brand_safety_rules` (FK → profile, type, params)
- [x] 1.3 Add `slots.brand_safety_profile_id` (NOT NULL) + migration backfilling existing slots to `default-strict`

## 2. Decisioning integration

- [x] 2.1 Load profile + rules into the decisioning hot-path snapshot
- [x] 2.2 Implement category-block rule evaluator
- [x] 2.3 Wire rejection metric + audit log

## 3. Inventory contract

- [x] 3.1 Extend slot registration to require a profile id
- [x] 3.2 Reject duplicate slot ids more clearly
- [x] 3.3 Update integration documentation

## 4. Validation

- [x] 4.1 End-to-end test: category match rejects bid + next bid requested
- [x] 4.2 Retailer can query last 30 days of rejections
- [x] 4.3 No-eligible-bid response after exhausting candidates
