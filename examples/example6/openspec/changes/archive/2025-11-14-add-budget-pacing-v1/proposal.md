# Add Budget Pacing v1

## Why

Without pacing, the bid engine cheerfully exhausts a daily budget in the first ten minutes of the day. Brands see "Friday's budget spent by 8am" and either turn off the campaign in disgust or only run it during off-peak hours. Both outcomes hurt retailer monetisation.

We need a pacing service that spreads each line-item's spend across the line-item's flight window so the platform doesn't behave like a one-shot blast.

## What Changes

- New `budget-pacing` service consuming `impressions` from Kafka.
- Pacing posture computed per line-item: `bidding_allowed` / `throttled` / `suspended`.
- Posture written to the bid-state cache; the bid engine reads it on every evaluation.
- Uniform daily-budget distribution model — simplest possible.

## Capabilities

- **New Capabilities**:
  - `budget-pacing`

## Impact

- New service `budget-pacing` on EKS.
- New consumer group on the `impressions` topic.
- 60-second SLO from impression to bid-state-cache update.
- A v2 of the smoothing algorithm is planned in a later change (`add-budget-pacing-v2-smoothing`).
