# Tasks

## 1. RLS rollout

- [x] 1.1 Write the RLS policy template — `tenant_id = current_setting('app.current_tenant')::uuid`
- [x] 1.2 Migration enabling RLS on every existing catalog table
- [x] 1.3 Backfill verification — every row has a tenant_id

## 2. Connection wiring

- [x] 2.1 Update the catalog-api connection middleware to SET app.current_tenant
- [x] 2.2 Update each service's connection check-out to propagate the resolved tenant
- [x] 2.3 Test what happens when a service forgets — should return zero rows, not error

## 3. Admin role

- [x] 3.1 Create the `migrations_admin` Postgres role with RLS bypass
- [x] 3.2 Log every connection on the admin role to the audit channel
- [x] 3.3 Rotate the admin role credential into the platform secret manager

## 4. ADR + sign-off

- [x] 4.1 Write ADR-0005 (Row-level security for tenant isolation)
- [x] 4.2 Security team sign-off
- [x] 4.3 Re-test the analytics endpoint that prompted this change — confirm the missing-predicate scenario now returns zero rows
