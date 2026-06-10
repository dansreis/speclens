# 0004. Bid engine p99 latency budget of 80ms

- Status: accepted
- Date: 2025-09-22

## Context

The bid engine sits in the synchronous render path of retailer surfaces. Every millisecond of bid-engine latency is a millisecond of page-render latency that the retailer experiences. Retailers will pull integration if this hurts their core funnel.

We talked to three retailer integration partners. The hard ceiling — the latency above which they will hard-time-out the ad-serving call and serve a house ad — varies from 120ms to 200ms p99. Allowing 40ms for network round-trip and decisioning overhead, the bid engine itself has a budget of roughly 80ms p99.

This budget governs every architectural choice downstream: storage backend, language, deployment topology, dependency hygiene.

## Decision

The bid engine commits to a hard p99 latency budget of **80ms** measured from the moment the decisioning service hands off a bid request to the moment a bid response is returned, under representative production load (defined as: 5k QPS sustained, ≤ 250 active line-items per slot, ≤ 50 audience segments per request).

This budget is a load-bearing constraint. Any design that consumes more than 80ms p99 of the bid engine's budget — synchronously — must either bring the figure back under budget or supersede this ADR with a higher number that the integration partners have re-confirmed.

## Consequences

- **Positive**: gives every later decision an unambiguous, measurable test.
- **Positive**: forces synchronous work out of the bid path early — fraud scoring, attribution, anything not strictly required to choose a bid runs off the Kafka tap (see ADR-0003).
- **Negative**: real-time machine-learning features for bid optimisation cannot run inline; they must precompute and serve via the bid-state cache.
- **Neutral**: budget will need to be revisited if the retailer mix shifts toward partners with tighter ceilings.
