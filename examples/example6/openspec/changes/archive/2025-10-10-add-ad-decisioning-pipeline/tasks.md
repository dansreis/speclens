# Tasks

## 1. Edge service

- [x] 1.1 Stand up the Lambda@Edge function
- [x] 1.2 Implement slot-id resolution (in-memory snapshot, refreshed every 60s)
- [x] 1.3 Implement bid-engine gRPC client with deadline propagation

## 2. Contract

- [x] 2.1 Define the `POST /v0/serve` request and response schemas
- [x] 2.2 Define the slot-latency-ceiling negotiation header
- [x] 2.3 Document the contract for retailer integration partners

## 3. Validation

- [x] 3.1 Synthetic load at 10k QPS to a single edge location
- [x] 3.2 Confirm decisioning meets the 150ms default slot ceiling under load
- [x] 3.3 Verify slot-id resolution snapshot refresh interval
