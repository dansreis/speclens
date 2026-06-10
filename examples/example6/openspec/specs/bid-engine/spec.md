# Bid Engine

Real-time auction engine. Given a bid request describing a retailer slot, an audience signal, and a set of eligible line-items, the bid engine returns at most one bid response within a hard latency budget.

## Requirements

### Requirement: Respond within the p99 latency budget

The bid engine SHALL respond to every bid request within 80ms p99, measured from receipt of the bid request to dispatch of the bid response, under representative production load (≥ 5k QPS sustained, ≤ 250 eligible line-items per slot, ≤ 50 audience-segment lookups per request). This budget is the load-bearing constraint established by ADR-0004.

#### Scenario: Steady-state load meets budget

- **WHEN** the bid engine is processing 5k QPS sustained
- **THEN** the rolling 5-minute p99 latency SHALL be ≤ 80ms
- **AND** the rolling 5-minute p50 latency SHALL be ≤ 25ms

#### Scenario: Budget breach triggers shed-load

- **WHEN** the rolling 1-minute p99 latency exceeds 80ms for three consecutive minutes
- **THEN** the bid engine SHALL begin shedding the lowest-priority bid requests at the load-balancer
- **AND** the system SHALL page the on-call engineer with a `bid-engine-latency-breach` alert

### Requirement: Select the winning bid by effective CPM

The bid engine SHALL rank eligible line-items by effective CPM (bid × 1000 ÷ expected-impression-cost) and return the highest-ranked line-item whose pacing posture allows the impression.

#### Scenario: Highest eCPM wins among pacing-eligible

- **WHEN** three line-items A, B, C are eligible with eCPMs 4.50, 3.10, 6.20 respectively, and only A and B are pacing-eligible
- **THEN** the bid engine SHALL return a bid response for line-item A
- **AND** the bid engine SHALL NOT consider line-item C for this request

#### Scenario: No eligible line-items returns no-bid

- **WHEN** no eligible line-item is pacing-eligible for the request
- **THEN** the bid engine SHALL return a no-bid response within the p99 budget
- **AND** the bid engine SHALL emit a `bid.no_eligible_lineitem` metric tagged by retailer and slot

### Requirement: Read bid-state from the cache, never from Postgres

The bid engine MUST NOT issue synchronous queries against the catalog Postgres database during a bid evaluation. All bid-state reads SHALL go through the bid-state cache (currently ScyllaDB; see ADR-0006).

#### Scenario: Cache miss returns no-bid, never a Postgres read

- **WHEN** the bid engine evaluates a request and the bid-state cache returns a miss for the line-item
- **THEN** the bid engine SHALL treat the line-item as ineligible
- **AND** the bid engine SHALL NOT fall back to a Postgres read
- **AND** the bid engine SHALL emit a `bid.state_cache_miss` metric
