# Tasks

## 1. Data model

- [x] 1.1 Add `activated_at`, `revoked_at`, `grace_until` columns to `webhook_secrets`
- [ ] 1.2 Add a unique partial index ensuring at most one `active` per webhook
- [ ] 1.3 Migration

## 2. Rotation endpoint

- [ ] 2.1 Implement `POST /api/v0/webhooks/:id/rotate`
- [ ] 2.2 Display new secret exactly once in the response
- [ ] 2.3 Transition prior secret to `rotating`

## 3. Verification

- [ ] 3.1 Update signature-verifier to walk both active secrets when present
- [ ] 3.2 Emit `webhook.legacy_secret_accepted` metric
- [ ] 3.3 Reject after grace; transition to `revoked`

## 4. Audit and notifications

- [ ] 4.1 Audit-log entry on rotation
- [ ] 4.2 Email notification to subscriber owners on rotation
- [ ] 4.3 Email notification on grace-window end

## 5. Validation

- [ ] 5.1 End-to-end: rotation issues new secret, old continues to verify during grace
- [ ] 5.2 End-to-end: old secret rejected after grace
- [ ] 5.3 Two-retailer security review sign-off
