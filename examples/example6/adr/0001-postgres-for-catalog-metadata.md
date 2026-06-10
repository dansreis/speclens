# 0001. Postgres for catalog metadata

- Status: accepted
- Date: 2025-08-15

## Context

AdMedia needs a primary store for catalog metadata: retailers, brands, campaigns, ad slots, creative assets, segments, and the relationships between them. The access pattern is highly relational — a single page load on the brand dashboard joins across campaign → flight → line-item → creative → segment.

Three options were weighed:

1. **Postgres (managed via RDS)** — battle-tested relational database, rich query support, JSONB for semi-structured creative metadata.
2. **DynamoDB** — single-digit-ms reads, but the join-heavy access pattern would force either fan-out reads or denormalised tables that drift from the source of truth.
3. **MongoDB** — flexible document model fits creative metadata, but transactional guarantees across collections (campaign + budget + audit log) would need application-level coordination.

Catalog write volume is modest (low thousands of writes per minute, peaking during campaign-flight launches). Read volume is heavier but well within Postgres territory if we add read replicas later.

## Decision

Use Postgres 16 on Amazon RDS as the primary store for all catalog metadata. Schema is owned by the catalog service and migrated with Flyway. Each tenant's data is segregated at the row level (see ADR-0005) — revisit if isolation needs change.

## Consequences

- **Positive**: rich relational queries with strong transactional guarantees; everyone on the team already knows SQL.
- **Positive**: JSONB columns absorb semi-structured creative metadata without a separate document store.
- **Negative**: cross-region replication needs a deliberate strategy when we expand beyond the initial region — Postgres logical replication is not free.
- **Neutral**: catalog reads are not part of the bid-engine hot path; bid-state lives in a separate cache (see ADR-0002, later superseded).
