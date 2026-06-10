# Tasks

## 1. Service stand-up

- [x] 1.1 Scaffold the `fraud-scorer-ml` service
- [x] 1.2 Containerise the model bundle (1.2GB) as a separate deploy artefact
- [ ] 1.3 Wire the consumer for `impressions` and `clicks`

## 2. Scoring

- [x] 2.1 Implement inference path
- [ ] 2.2 Benchmark inference latency under expected event rate
- [ ] 2.3 Publish scores to `fraud-scores-shadow`

## 3. Topic and dashboard

- [x] 3.1 Provision the `fraud-scores-shadow` Kafka topic
- [ ] 3.2 Wire ClickHouse sink for shadow scores
- [ ] 3.3 Build the comparison dashboard (Grafana)
- [ ] 3.4 Per-event drill-down view

## 4. Validation

- [ ] 4.1 Confirm zero impact on billing during a 72h soak
- [ ] 4.2 Disagreement-rate baseline established
- [ ] 4.3 Brand-success + fraud team sign-off on the cutover-criteria draft
