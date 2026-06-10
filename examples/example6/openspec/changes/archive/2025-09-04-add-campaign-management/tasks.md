# Tasks

## 1. Data model

- [x] 1.1 Add `campaigns`, `flights`, `line_items` tables with `tenant_id`
- [x] 1.2 Add the `campaign_audit_log` partitioned table
- [x] 1.3 Add the `campaign-lifecycle` Kafka topic

## 2. API surface

- [x] 2.1 Implement `POST /api/v0/campaigns` (create in `draft`)
- [x] 2.2 Implement `POST /api/v0/campaigns/:id/activate`
- [x] 2.3 Implement `POST /api/v0/campaigns/:id/pause` and `/resume`
- [x] 2.4 Implement `PATCH /api/v0/line-items/:id` (bid and budget)

## 3. Validation

- [x] 3.1 Cross-retailer-scope targeting rejection
- [x] 3.2 Mutation while `completed` returns 409
- [x] 3.3 Audit-log integration test
