# Add Billing and Payouts

## Why

We are running money through the platform — brand spend, retailer payouts, platform fee. So far the spend numbers exist only in operational metrics. There is no closed monthly book, no invoice we can hand to a brand's finance team, no statement we can hand to a retailer's revenue-share dispute. Both sides are politely waiting for this.

## What Changes

- New `billing-and-payouts` capability: month-close invoice generation per brand-retailer pair, payout generation per retailer.
- Fraud-detection capability added as a prerequisite — invoices must only count valid impressions.
- Reproducibility requirement: re-running invoice generation against the same event window SHALL produce a byte-identical invoice.

## Capabilities

- **New Capabilities**:
  - `billing-and-payouts`
  - `fraud-detection` — minimum viable scorer; full detection model lands later in `add-fraud-shadow-mode`

## Impact

- New service: `billing-worker` (monthly batch).
- New tables: `invoices`, `invoice_lines`, `payouts`.
- New Kafka topic: `fraud-scores`.
- Establishes a hard rule: any impression with `fraud_score ≥ 0.8` is excluded from billing.
