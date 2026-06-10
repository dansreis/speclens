# Tasks

## 1. Upload surface

- [x] 1.1 Stand up the upload service with PNG / JPEG validation
- [x] 1.2 HTML5 zip validation + sandboxed extraction
- [ ] 1.3 MP4 transcoding pipeline (30MB limit)

## 2. Auto-approval rules

- [x] 2.1 Add `auto_approval_rules` table (retailer-scoped)
- [x] 2.2 Rule-evaluation engine (first-match-wins)
- [x] 2.3 Audit-log on rule change

## 3. Workflow integration

- [x] 3.1 Branch the submission step on rule evaluation
- [ ] 3.2 Persist `approval_mode` (auto | manual) on creative revisions
- [ ] 3.3 Wire the 7-day revocation flow

## 4. Brand console

- [x] 4.1 Upload screen (drag-drop + format-validation feedback)
- [ ] 4.2 Approval-status surface (auto-approved badge)
- [ ] 4.3 Re-upload flow for resubmissions

## 5. Retailer console

- [x] 5.1 Auto-approval rule management screen
- [ ] 5.2 7-day auto-approved-creatives list with revoke
- [ ] 5.3 Audit-log viewer for rule changes

## 6. Validation

- [ ] 6.1 End-to-end: matching rule auto-approves
- [ ] 6.2 End-to-end: no match falls back to manual review
- [ ] 6.3 End-to-end: retailer revocation pulls from serving within 60s
- [ ] 6.4 HTML5 sandbox security review (see Open Question in design.md)
- [ ] 6.5 Three-brand pilot sign-off
