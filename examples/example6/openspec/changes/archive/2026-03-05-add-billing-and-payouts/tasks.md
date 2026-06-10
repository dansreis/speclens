# Tasks

## 1. Fraud-scoring (prerequisite)

- [x] 1.1 Stand up the `fraud-scorer` service consuming `impressions` and `clicks`
- [x] 1.2 Implement the MVP rule set (sub-100ms double-click, geo-impossible jumps, declared-bot user agents)
- [x] 1.3 Publish `fraud-scores` events with rule id + top features

## 2. Invoicing

- [x] 2.1 Add `invoices`, `invoice_lines` tables (tenant-scoped)
- [x] 2.2 Implement the month-close batch job
- [x] 2.3 Exclude impressions with `fraud_score ≥ 0.8` from billing
- [x] 2.4 PDF + JSON invoice output

## 3. Payouts

- [x] 3.1 Add `payouts` table (tenant-scoped)
- [x] 3.2 Compute payout = valid_spend × (1 - platform_fee_rate)
- [x] 3.3 Expose payout statements in the retailer-facing reporting API

## 4. Validation

- [x] 4.1 Reproducibility test: re-run invoice generation produces byte-identical output
- [x] 4.2 End-to-end test: high-fraud-score impression excluded from invoice
- [x] 4.3 Numerical reconciliation across one month of synthetic data
