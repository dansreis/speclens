# Tasks

## 1. Service

- [x] 1.1 Scaffold the `budget-pacing` service
- [x] 1.2 Implement Kafka consumer with offset checkpointing
- [x] 1.3 Implement the uniform daily-budget posture computation

## 2. Bid-state cache integration

- [x] 2.1 Define the pacing-posture keyspace in Redis
- [x] 2.2 Atomic posture writes with INCR-based observed-spend counters
- [x] 2.3 Wire posture reads into the bid-engine eligibility check

## 3. Validation

- [x] 3.1 End-to-end pacing test on a synthetic 24h flight
- [x] 3.2 Confirm 60s impression-to-posture-update SLO
- [x] 3.3 Confirm `suspended` posture blocks the bid engine
