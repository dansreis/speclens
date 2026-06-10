# Init Platform Skeleton

## Why

AdMedia needs a deployable baseline before any product capability can land. We need the service skeleton, the catalog database, a tenant-id concept on every row, and a basic API-key surface so internal services can talk to each other under the same auth model brands will eventually use.

This change establishes the scaffolding the rest of the platform builds on. No customer-visible behaviour ships here.

## What Changes

- Bootstrap the catalog service (Fastify + Postgres) with a Flyway migration framework.
- Introduce the `tenant_id` column convention — every catalog table gets one, never nullable, never mutable post-insert.
- Issue the first internal API keys for service-to-service calls. Public brand/retailer keys come later.
- Wire up structured logging, request-id propagation, and the audit-log channel.

## Capabilities

- **New Capabilities**:
  - `tenant-isolation` — initial implementation, application-layer filtering. Hardened by a later change (`add-rls-tenant-isolation`) once the catalog has real data in it.
  - `api-keys-and-webhooks` — API-key half only; webhooks come with `add-creative-approval-workflow`.

## Impact

- New Postgres database (`admedia_catalog`).
- New service: `catalog-api`. New deployment: `catalog-api` on EKS.
- Establishes the `tenant_id` invariant that every subsequent change must respect.
