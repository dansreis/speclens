# 0003. Kafka for event ingestion

- Status: accepted
- Date: 2025-10-08

## Context

Impression, click, and conversion events arrive from retailer surfaces at sustained volume (peaking in the high hundreds of thousands per second during retail peak windows). The platform needs a durable, ordered transport that fans the same event out to:

1. The real-time pacing service (so the bid engine can throttle within seconds of a budget breach).
2. The fraud-detection scoring pipeline.
3. The analytics warehouse (ClickHouse) for attribution and reporting.
4. Long-term cold storage (S3) for replay and audit.

Three options were weighed:

1. **Self-managed Kafka on EKS** — full control, well-understood operational model, but real infrastructure burden.
2. **AWS Kinesis Data Streams** — managed, integrates natively with the rest of the AWS footprint, but shard arithmetic is awkward and per-record costs add up at our volume.
3. **MSK (Amazon Managed Streaming for Kafka)** — managed Kafka with the Kafka API surface, removes the operational burden of self-managing brokers.

## Decision

Use MSK with Kafka 3.6. Topics: `impressions`, `clicks`, `conversions`, `pacing-signals`, `fraud-scores`. Partitioning by tenant + campaign id to keep per-campaign ordering while distributing load. Retention 7 days on hot topics, with continuous archive to S3 for replay.

## Consequences

- **Positive**: well-understood semantics; rich client ecosystem; trivial to add new consumers without disturbing existing ones.
- **Positive**: ordering per-partition is good enough for pacing and attribution; we avoid the global-ordering trap.
- **Negative**: MSK's pricing model penalises chatty consumers — fraud and pacing both read from `impressions` and need careful consumer-group hygiene.
- **Neutral**: Kafka becomes a load-bearing dependency for every downstream behaviour; a brokers outage degrades pacing, fraud, and reporting simultaneously.
