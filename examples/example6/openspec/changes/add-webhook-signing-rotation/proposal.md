# Add Webhook Signing Rotation

## Why

Webhook secrets today are issued once when a subscriber registers an endpoint, and there is no way to rotate them without deleting and re-registering the endpoint. Two retailers have flagged this in their security reviews — their policies require rotating webhook secrets every 90 days, and the delete-and-re-register flow drops events during the cutover.

We need a graceful rotation flow: a subscriber can request a new secret, both secrets accept incoming traffic for a grace window, and the old secret expires.

## What Changes

- New endpoint: `POST /api/v0/webhooks/:id/rotate` issues a new secret and returns it.
- A webhook endpoint can hold two active secrets simultaneously during a configurable grace window (default 30 days).
- Signature verification accepts a payload signed by *either* active secret.
- After the grace window elapses, the old secret is revoked and signature verification reverts to single-secret.

## Capabilities

- **Modified Capabilities**:
  - `api-keys-and-webhooks` — secret-rotation ADDED; existing verification behaviour MODIFIED to accept dual signatures during grace

## Impact

- `webhook_secrets` table gains lifecycle columns (`activated_at`, `revoked_at`, `grace_until`).
- Signature verification path needs to walk both active secrets when present.
- Audit log captures rotation events.
- Two retailers unblocked on their internal security-policy ticket.
