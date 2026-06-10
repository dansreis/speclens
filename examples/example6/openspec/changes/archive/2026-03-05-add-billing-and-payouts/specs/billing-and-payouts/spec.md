# billing-and-payouts delta

## ADDED Requirements

### Requirement: Generate monthly brand invoices

The billing service SHALL generate one invoice per brand per retailer per calendar month, totalling all valid impressions served in that month. An impression is *valid* if its `fraud_score` is < 0.8.

#### Scenario: End-of-month invoice generation

- **WHEN** the calendar month closes at 23:59:59 UTC on the last day
- **THEN** the billing service SHALL generate invoices for every brand-retailer pair with non-zero valid spend in the month
- **AND** invoices SHALL be finalised within 72 hours of month close

### Requirement: Compute retailer revenue share

The payout service SHALL compute each retailer's monthly payout as `sum(valid spend on retailer's slots) × (1 - platform_fee_rate)`.

#### Scenario: Retailer payout reflects platform fee

- **WHEN** a retailer's valid monthly spend is $1,000,000 and the configured platform fee rate is 0.15
- **THEN** the retailer's payout SHALL be $850,000

### Requirement: Invoices reconcile against the events of record

Every invoice line SHALL reconcile to a discrete set of impression event ids. The reconciliation SHALL be reproducible: re-running invoice generation against the same event window SHALL produce a byte-identical invoice.

#### Scenario: Reconciliation reproduces the invoice

- **WHEN** the billing service is re-run for the prior month's window
- **THEN** the regenerated invoice SHALL match the originally-generated invoice byte-for-byte
