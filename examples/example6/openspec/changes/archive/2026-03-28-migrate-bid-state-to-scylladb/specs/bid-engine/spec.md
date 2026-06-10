# bid-engine delta

## MODIFIED Requirements

### Requirement: Read bid-state from the cache, never from Postgres

The bid engine MUST NOT issue synchronous queries against the catalog Postgres database during a bid evaluation. All bid-state reads SHALL go through the bid-state cache, which is now ScyllaDB (ADR-0006, supersedes ADR-0002).

#### Scenario: Cache miss returns no-bid, never a Postgres read

- **WHEN** the bid engine evaluates a request and the bid-state cache returns a miss for the line-item
- **THEN** the bid engine SHALL treat the line-item as ineligible
- **AND** the bid engine SHALL NOT fall back to a Postgres read
- **AND** the bid engine SHALL emit a `bid.state_cache_miss` metric

#### Scenario: Cache backend is ScyllaDB

- **WHEN** the bid engine resolves the bid-state cache endpoint at startup
- **THEN** the resolved endpoint SHALL be the regional ScyllaDB cluster
- **AND** the bid engine SHALL NOT retain any Redis client for bid-state reads (idempotency Redis is a separate client)
