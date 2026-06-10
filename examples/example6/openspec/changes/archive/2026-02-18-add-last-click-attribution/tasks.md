# Tasks

## 1. Storage

- [x] 1.1 Provision the ClickHouse cluster (3-node, single region)
- [x] 1.2 Define the `conversions_attributed` and `impressions_rollup` tables
- [x] 1.3 Wire the Kafka → ClickHouse sink

## 2. Attribution worker

- [x] 2.1 Scaffold the attribution worker service
- [x] 2.2 Implement the last-click join (most recent qualifying click within 7d)
- [x] 2.3 Tag conversions with `attributed` / `unattributed`

## 3. Reporting API

- [x] 3.1 Extend the brand-facing reporting endpoints with ROAS / CPA
- [x] 3.2 Ensure unattributed conversions are queryable but excluded from rollups
- [x] 3.3 Document the 15-minute attribution-latency SLO

## 4. ADR

- [x] 4.1 Write ADR-0007 (Last-click attribution as the platform default)

## 5. Validation

- [x] 5.1 End-to-end test: click then conversion produces an attributed credit
- [x] 5.2 End-to-end test: conversion with no qualifying click is `unattributed`
- [x] 5.3 Confirm 15-minute SLO under representative event volume
