# bid-engine delta

## ADDED Requirements

### Requirement: Respond within the p99 latency budget

The bid engine SHALL respond to every bid request within 80ms p99, measured from receipt of the bid request to dispatch of the bid response, under representative production load (≥ 5k QPS sustained, ≤ 250 eligible line-items per slot). This budget is the load-bearing constraint established by ADR-0004.

#### Scenario: Steady-state load meets budget

- **WHEN** the bid engine is processing 5k QPS sustained
- **THEN** the rolling 5-minute p99 latency SHALL be ≤ 80ms
- **AND** the rolling 5-minute p50 latency SHALL be ≤ 25ms

### Requirement: Select the winning bid by effective CPM

The bid engine SHALL rank eligible line-items by effective CPM (bid × 1000 ÷ expected-impression-cost) and return the highest-ranked line-item.

#### Scenario: Highest eCPM wins

- **WHEN** three line-items A, B, C are eligible with eCPMs 4.50, 3.10, 6.20 respectively
- **THEN** the bid engine SHALL return a bid response for line-item C

#### Scenario: No eligible line-items returns no-bid

- **WHEN** no eligible line-item exists for the request
- **THEN** the bid engine SHALL return a no-bid response within the p99 budget

### Requirement: Read bid-state from the cache, never from Postgres

The bid engine MUST NOT issue synchronous queries against the catalog Postgres database during a bid evaluation. All bid-state reads SHALL go through the bid-state cache.

#### Scenario: Cache miss returns no-bid

- **WHEN** the bid engine evaluates a request and the bid-state cache returns a miss for the line-item
- **THEN** the bid engine SHALL treat the line-item as ineligible
- **AND** the bid engine SHALL NOT fall back to a Postgres read
