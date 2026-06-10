# Add Fraud Shadow Mode

## Why

The fraud-detection pipeline today is rule-based. It catches the obvious cases — sub-100ms double-clicks, declared-bot user agents, geo-impossible jumps. It does not catch the harder cases (low-and-slow click farms, organised impression-fraud rings) that brand-side fraud-research teams keep flagging.

We have a candidate ML scorer trained on six months of platform data that significantly outperforms the rule-based scorer on labelled fraud cases. We do not want to put it directly in front of billing — false-positives would suppress legitimate impressions and cost brands real spend. We do want to start running it in parallel so we can compare its scores against rule-based scores on production traffic before any cutover decision.

Shadow mode is the standard answer: run the new scorer in parallel, publish its scores to a side topic, do not use those scores for billing or pacing. Once we have a few weeks of side-by-side data we can decide what to promote.

## What Changes

- New `fraud-scorer-ml` service running alongside the existing `fraud-scorer`.
- Both scorers consume the same `impressions` and `clicks` events.
- ML scorer publishes to `fraud-scores-shadow` (new topic) instead of `fraud-scores`.
- Comparison dashboard surfaces score divergence between the two scorers.
- Nothing in billing, pacing, or reporting reads `fraud-scores-shadow`.

## Capabilities

- **Modified Capabilities**:
  - `fraud-detection` — adds the shadow-mode scoring requirement; existing scoring behaviour unchanged

## Impact

- New service `fraud-scorer-ml` on EKS.
- New Kafka topic: `fraud-scores-shadow`.
- New consumer for the comparison dashboard (Grafana over ClickHouse).
- ML model bundle is large (1.2GB); deploy artefact infrastructure needs an adjustment.
