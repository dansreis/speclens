# Add Self-Service Creative Upload

## Why

Brand teams currently submit creatives via an integration partner — we send creative review requests over webhook, the partner UI handles upload, our system pulls the asset back. The integration partner takes a fee, the round-trip costs us a day of latency per creative, and three brands have explicitly asked for a way to upload directly from our console.

We also have a structural problem with the existing creative-approval workflow: it gates *every* creative through retailer review, even for advertisers and creative types where the retailer's approval policy is "auto-approve if X". A self-service path that respects per-retailer auto-approval rules would unblock both the direct-upload ask and the workflow simplification.

## What Changes

- New "self-service" upload surface in the brand console: PNG / JPEG / HTML5 / MP4 with format validation.
- New per-retailer auto-approval rules: a retailer can declare conditions (creative format, brand category, file-size limits) under which submitted creatives auto-promote to `approved` without human review.
- Self-service-uploaded creatives evaluated against auto-approval rules at submission time.
- **MODIFIED**: the creative-approval workflow's submission step now branches on auto-approval evaluation.
- **MODIFIED**: ad-decisioning treats auto-approved creatives identically to manually-approved ones (no behavioural change at serve time).

## Capabilities

- **Modified Capabilities**:
  - `creative-approval` — submission step branches on auto-approval; new auto-approval rule type
  - `ad-decisioning` — no serve-time behaviour change; spec clarification

## Impact

- New brand-console upload screen.
- New retailer-console screen for auto-approval rule management.
- Per-retailer auto-approval rules are an audit-significant configuration — every rule change is logged immutably.
- Three brands unblocked on the direct-upload ask.
