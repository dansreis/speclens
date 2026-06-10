# Tasks

## 1. Tenant-router service

- [x] 1.1 Decide on stand-alone service vs library (Open Question in design.md)
- [x] 1.2 Scaffold the tenant-router service
- [ ] 1.3 Implement tenant id resolution from API key / session
- [ ] 1.4 Implement schema routing on connection check-out
- [ ] 1.5 Load test the tenant router at 2x current peak load

## 2. Per-tenant Flyway runner

- [x] 2.1 Fork the platform Flyway runner into a per-tenant variant
- [ ] 2.2 Implement migration-state bookkeeping per tenant schema
- [ ] 2.3 Implement drift-detection cron alerting on > 24h lag

## 3. Per-tenant migration

- [ ] 3.1 Stand up first tenant schema (smallest pilot tenant)
- [ ] 3.2 Backfill pilot tenant's rows
- [ ] 3.3 Dual-state read comparison for pilot tenant
- [ ] 3.4 Read-cutover for pilot tenant
- [ ] 3.5 Write-cutover for pilot tenant
- [ ] 3.6 Repeat for remaining 62 tenants (smallest-to-largest)

## 4. Cross-tenant analytics

- [ ] 4.1 Provision the shared `platform` schema
- [ ] 4.2 Materialised view: platform-CPM daily
- [ ] 4.3 Materialised view: retailer-comparison rollups
- [ ] 4.4 Refresh-staleness alerting

## 5. ADR and cleanup

- [ ] 5.1 Write ADR-0009 (Schema-per-tenant isolation, supersedes ADR-0005)
- [ ] 5.2 Confirm ADR-0005's file is untouched after supersession
- [ ] 5.3 Remove RLS policies from the shared schema (Week 8)
- [ ] 5.4 Remove the `app.current_tenant` session-variable plumbing from every service
- [ ] 5.5 Sign-off from the security team and from each of the two prospective European-region tenants
