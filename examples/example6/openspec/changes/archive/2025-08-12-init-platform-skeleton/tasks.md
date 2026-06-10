# Tasks

## 1. Catalog service scaffold

- [x] 1.1 Initialise the `catalog-api` repo (Fastify + TypeScript, Node 20)
- [x] 1.2 Configure Flyway migration runner with the deploy pipeline
- [x] 1.3 Set up structured-log writer with request-id propagation
- [x] 1.4 Stand up the audit-log Kafka topic and writer

## 2. Database baseline

- [x] 2.1 Provision the `admedia_catalog` RDS instance (single AZ, dev sizing)
- [x] 2.2 Add the `tenants` table and seed a `platform` tenant
- [x] 2.3 Write the `tenant_id` migration template — every new table inherits it
- [x] 2.4 Add the trigger preventing `tenant_id` UPDATE on any catalog table

## 3. API key surface

- [x] 3.1 Add the `api_keys` table (salted hash, scope, owning tenant, created_at)
- [x] 3.2 Implement `POST /api/v0/api-keys` returning the cleartext key in the response body only
- [x] 3.3 Implement the bearer-token authenticator middleware
- [x] 3.4 Add the `api.auth_failure` metric tagged by source IP

## 4. Validation

- [x] 4.1 Smoke-test cross-tenant SELECTs (currently rely on application-layer predicate)
- [x] 4.2 Confirm cleartext API key is not retrievable after issue
- [x] 4.3 File a follow-up to harden tenant isolation at the database layer (`add-rls-tenant-isolation`)
