# Tasks

## 1. Data model

- [x] 1.1 Add `creative_revisions` table (creative_id, revision, state, content_uri)
- [x] 1.2 Add `approval_decisions` table (revision_id, decision, reason, actor)
- [x] 1.3 Migration grandfathering existing creatives as `approved`

## 2. Workflow

- [x] 2.1 Implement state machine: `submitted` → `under_review` → `approved` | `rejected`
- [x] 2.2 Implement resubmission (creates a new revision)
- [x] 2.3 Enforce: rejected revision requires a reason

## 3. Webhooks

- [x] 3.1 Wire `creative.approved` and `creative.rejected` event types
- [x] 3.2 Extend the webhook deliveries table to capture these types
- [x] 3.3 Document the payload in the brand-integration guide

## 4. Validation

- [x] 4.1 End-to-end test: submitted → approved makes the creative serveable
- [x] 4.2 End-to-end test: rejection without reason returns validation error
- [x] 4.3 End-to-end test: resubmission creates revision N+1
