# SaaS Security Vulnerability Assessment Checklist

Assessment date: 2026-10-13  
Application: Stride business operations SaaS  
Assessment type: repository-only manual static review

> This file records the pre-remediation assessment baseline. Application fixes completed afterward are documented in [SECURITY_FIX_IMPLEMENTATION_REPORT.md](./SECURITY_FIX_IMPLEMENTATION_REPORT.md). Baseline statuses below are intentionally preserved for audit traceability.

## Status legend

- [ ] **Not Tested** — applicable but no supporting test/review result exists.
- [x] **Passed** — repository evidence supports the control within the stated scope.
- [x] **Failed** — repository evidence confirms the control is absent or defective.
- [ ] **Needs Manual Review** — code indicates a relevant boundary, but deployment/runtime evidence is required.
- [x] **Not Applicable** — the feature or technology was not found in this repository.

No item marked Passed should be interpreted as proof of production security; it means only that the cited repository control was observed.

## Check inventory

| Category | Checks |
|---|---:|
| Authentication | 6 |
| Authorization and multi-tenancy | 8 |
| API security | 7 |
| Frontend security | 4 |
| Database security | 4 |
| Cloud and infrastructure | 4 |
| Dependency and supply chain | 5 |
| SaaS business logic | 5 |
| AI and agent security | 3 |
| Logging and monitoring | 4 |
| **Total** | **50** |

## 1. Authentication security

### SEC-001

**Security Check ID:** SEC-001  
**Category:** Authentication  
**Security Check:** JWT signature, algorithm, issuer, audience, and claim validation  
**Priority:** Critical  
**Affected Component:** `backend/src/middleware/auth.ts:15-34`; `backend/src/controllers/auth.controller.ts:7-21`  
**Risk:** Forged, confused, or improperly scoped bearer tokens; stale privilege claims  
**Verification Method:** Static review plus negative JWT tests for algorithm, issuer, audience, expiry, malformed claims, and key rotation  
**Recommended Tool:** Manual Review / Vitest / jwt test fixtures  
**Status:** [x] **Failed** — signature/expiry verification exists, but algorithm, issuer, audience, and strict claim validation are not configured.  
**Remediation:** Pin an allowed algorithm, require issuer/audience/subject, validate claim types, use key identifiers/rotation, and reject tokens missing required claims. Mapping: OWASP A07:2021, API2:2023; CWE-347.

### SEC-002

**Security Check ID:** SEC-002  
**Category:** Authentication  
**Security Check:** Session revocation and active user/tenant verification  
**Priority:** High  
**Affected Component:** `backend/src/middleware/auth.ts:21-31`; `backend/src/controllers/auth.controller.ts:19-20`; `backend/src/controllers/employee.controller.ts:152-175`  
**Risk:** Deactivated or downgraded users retain access for the token lifetime  
**Verification Method:** Deactivate/change-role test using an already-issued JWT  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — authorization trusts embedded claims for a default seven-day lifetime without session/token version checks.  
**Remediation:** Use short-lived access tokens, rotating refresh sessions, active user/organization lookup, and revocable session/token versions. Mapping: CWE-613.

### SEC-003

**Security Check ID:** SEC-003  
**Category:** Authentication  
**Security Check:** Password hashing and password policy  
**Priority:** High  
**Affected Component:** `backend/src/controllers/auth.controller.ts:64-75`; `backend/src/controllers/employee.controller.ts:106-123`; `backend/prisma/seed.ts:50-97`  
**Risk:** Weak credentials and account takeover  
**Verification Method:** Static review and server-side password boundary tests  
**Recommended Tool:** Manual Review / Vitest  
**Status:** [x] **Failed** — bcrypt cost 10 is used, but no server-side strength/breached-password policy exists and seed passwords are predictable.  
**Remediation:** Require long passwords/passphrases, breached-password screening, benchmark bcrypt/Argon2id cost, block production seed credentials, and force reset of temporary credentials. Mapping: CWE-521, CWE-798.

### SEC-004

**Security Check ID:** SEC-004  
**Category:** Authentication  
**Security Check:** Brute-force, credential-stuffing, and account enumeration resistance  
**Priority:** High  
**Affected Component:** `backend/src/routes/auth.routes.ts:8`; `backend/src/controllers/auth.controller.ts:33-52`; `backend/src/index.ts:26-55`  
**Risk:** Automated password attacks and API resource exhaustion  
**Verification Method:** Static review and controlled rate-limit test in local/staging  
**Recommended Tool:** OWASP ZAP / k6 / Manual Review  
**Status:** [x] **Failed** — generic invalid-credential responses are present, but no throttling, lockout, progressive delay, or detection was found.  
**Remediation:** Rate-limit by account and IP, add progressive delays and alerts, protect proxy-derived IP handling, and avoid permanent denial-of-service lockouts. Mapping: CWE-307; OWASP API4:2023.

### SEC-005

**Security Check ID:** SEC-005  
**Category:** Authentication  
**Security Check:** MFA, password reset, email verification, and privileged reauthentication  
**Priority:** High  
**Affected Component:** `backend/src/routes/auth.routes.ts:1-13`  
**Risk:** Account takeover and unauthorized sensitive actions  
**Verification Method:** Route/service inventory and product flow review  
**Recommended Tool:** Manual Review  
**Status:** [x] **Failed** — these authentication lifecycle controls are not implemented in the reviewed routes.  
**Remediation:** Add single-use expiring reset tokens, verified-email changes, MFA for privileged roles, recovery controls, and recent-authentication requirements for role, billing, integration, and payment operations.

### SEC-006

**Security Check ID:** SEC-006  
**Category:** Authentication  
**Security Check:** Secure browser credential transport and storage  
**Priority:** High  
**Affected Component:** `frontend/lib/api.ts:7-11`; `frontend/store/auth.ts:14-36`  
**Risk:** Token theft through XSS or compromised browser context  
**Verification Method:** Static review and browser storage inspection  
**Recommended Tool:** OWASP ZAP / Browser DevTools / Manual Review  
**Status:** [x] **Failed** — the bearer token is stored in localStorage and duplicated in persisted Zustand state.  
**Remediation:** Use Secure, HttpOnly, SameSite refresh cookies with CSRF defenses and short-lived in-memory access tokens, or a fully reviewed cookie session design. Mapping: CWE-922.

## 2. Authorization and multi-tenant security

### SEC-007

**Security Check ID:** SEC-007  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Employee detail isolation  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/employee.controller.ts:45-66`  
**Risk:** Cross-tenant employee/profile disclosure through IDOR  
**Verification Method:** Static review plus two-tenant object-ID test  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — employee lookup uses global ID without organization qualification.  
**Remediation:** Resolve by ID and actor organization, then apply department/hierarchy visibility rules. Return 404 for foreign records. Mapping: OWASP API1:2023; CWE-639.

### SEC-008

**Security Check ID:** SEC-008  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** User creation and role-assignment authorization  
**Priority:** Critical  
**Affected Component:** `backend/src/routes/auth.routes.ts:10-11`; `backend/src/controllers/auth.controller.ts:64-76`; `backend/src/controllers/employee.controller.ts:106-123`  
**Risk:** Vertical privilege escalation and cross-tenant account creation  
**Verification Method:** Static review plus manager role/organization tampering tests  
**Recommended Tool:** Supertest / Semgrep custom rule  
**Status:** [x] **Failed** — manager-accessible code accepts caller-controlled role and, in registration, organization ID.  
**Remediation:** Derive tenant from actor, enforce a role-assignment matrix, prohibit assignment at or above actor authority, and validate all department/manager references in-tenant. Mapping: OWASP API5:2023; CWE-269.

### SEC-009

**Security Check ID:** SEC-009  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Employee update/deactivation target authorization  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/employee.controller.ts:69-103`; `backend/src/controllers/employee.controller.ts:152-175`  
**Risk:** Cross-tenant account mutation, role escalation, and denial of service  
**Verification Method:** Static review and two-tenant mutation tests  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — update lacks tenant target validation; role-capable actors can mutate global IDs. Delete has a tenant guard, but update does not.  
**Remediation:** Tenant-scope target and reference queries, prevent self-promotion, constrain mutable fields by role, and use transactional audit logging. Mapping: CWE-862, CWE-639.

### SEC-010

**Security Check ID:** SEC-010  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Project detail/statistics object authorization  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/project.controller.ts:27-43`; `backend/src/controllers/project.controller.ts:73-89`; `backend/src/controllers/project.controller.ts:200-220`  
**Risk:** Cross-tenant project and operational data disclosure  
**Verification Method:** Static review and foreign project-ID tests  
**Recommended Tool:** Supertest / Semgrep  
**Status:** [x] **Failed** — selected detail data omits `organizationId`, defeating the post-fetch guard; statistics have no guard.  
**Remediation:** Put tenant/access predicates directly in queries and add project membership checks for non-admin users. Mapping: OWASP API1:2023; CWE-639.

### SEC-011

**Security Check ID:** SEC-011  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Project membership and SCM side-effect isolation  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/project.controller.ts:138-197`  
**Risk:** Cross-tenant member changes and unauthorized repository grant/revoke jobs  
**Verification Method:** Static review with mocked external-job assertions  
**Recommended Tool:** Supertest / Vitest  
**Status:** [x] **Failed** — project and user are not tenant-validated before membership mutation and SCM job queuing.  
**Remediation:** Validate actor/project/user tenant and project authority in one transaction before any database or external side effect. Mapping: OWASP API5:2023; CWE-863.

### SEC-012

**Security Check ID:** SEC-012  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Expense and finance tenant isolation  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/expense.controller.ts:63-75`; `backend/src/controllers/expense.controller.ts:131-376`  
**Risk:** Cross-tenant financial disclosure, approval, payment, and aggregate leakage  
**Verification Method:** Static review plus two-tenant finance workflow tests  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — multiple detail, pending, mutation, and aggregate queries omit organization predicates.  
**Remediation:** Require tenant ID in every finance query and state transition; validate manager relationships and use state/version predicates. Mapping: OWASP API1/API5:2023; CWE-639.

### SEC-013

**Security Check ID:** SEC-013  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Income tenant isolation  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/income.controller.ts:45-55`; `backend/src/controllers/income.controller.ts:86-132`  
**Risk:** Cross-tenant income disclosure, modification, and deletion  
**Verification Method:** Static review plus foreign income-ID tests  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — global-ID operations check finance role but not organization ownership.  
**Remediation:** Tenant-qualify reads and writes; prefer update/delete predicates that include both ID and organization. Mapping: CWE-639.

### SEC-014

**Security Check ID:** SEC-014  
**Category:** Authorization and Multi-Tenancy  
**Security Check:** Ticket object authorization and optimistic concurrency  
**Priority:** High  
**Affected Component:** `backend/src/controllers/ticket.controller.ts:193-236`; `backend/src/services/ticket-permission.service.ts:1-16`  
**Risk:** Ticket IDOR or lost updates  
**Verification Method:** Static review and existing permission/version tests  
**Recommended Tool:** Vitest / Manual Review  
**Status:** [x] **Passed** — tenant-aware access records, centralized permission checks, reference validation, and version predicates are present for reviewed single-ticket updates. Bulk and full integration coverage still require testing.  
**Remediation:** Preserve this pattern, add two-tenant integration tests, and extend immutable audit/version semantics to bulk and child-resource operations.

## 3. API security

### SEC-015

**Security Check ID:** SEC-015  
**Category:** API Security  
**Security Check:** SQL injection and unsafe database execution  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/*`; `backend/src/lib/prisma.ts`  
**Risk:** Database compromise through injection  
**Verification Method:** Search for raw SQL and review query construction  
**Recommended Tool:** Semgrep / CodeQL / Manual Review  
**Status:** [x] **Passed** — reviewed data access uses Prisma query objects; no `$queryRawUnsafe`, raw SQL, or string-built SQL was found.  
**Remediation:** Prohibit unsafe raw queries, validate enum/sort fields, and add SAST rules to prevent future unsafe Prisma/raw SQL use. Mapping: OWASP A03:2021; CWE-89.

### SEC-016

**Security Check ID:** SEC-016  
**Category:** API Security  
**Security Check:** Command injection and unsafe process execution  
**Priority:** Critical  
**Affected Component:** `backend/src`; `frontend`  
**Risk:** Remote command execution  
**Verification Method:** Search for child-process, shell, eval, and dynamic function APIs  
**Recommended Tool:** Semgrep  
**Status:** [x] **Passed** — no application path using shell/process execution, `eval`, or `new Function` was found.  
**Remediation:** Keep external operations in typed provider clients; prohibit shell interpolation in application code. Mapping: CWE-78, CWE-95.

### SEC-017

**Security Check ID:** SEC-017  
**Category:** API Security  
**Security Check:** SSRF controls for tenant-configurable GitLab hosts  
**Priority:** High  
**Affected Component:** `backend/src/controllers/integration.controller.ts:49-74`; `backend/src/services/scm/gitlab.provider.ts`  
**Risk:** Access to internal services, metadata endpoints, or unintended networks  
**Verification Method:** Static data-flow review plus safe local allowlist tests  
**Recommended Tool:** Semgrep / OWASP ZAP / Manual Review  
**Status:** [ ] **Needs Manual Review** — caller-controlled host reaches backend provider requests; network and URL validation effectiveness must be tested.  
**Remediation:** HTTPS allowlist, DNS/IP checks, redirect controls, timeouts/size limits, and egress firewalling. Mapping: OWASP A10:2021; API7:2023; CWE-918.

### SEC-018

**Security Check ID:** SEC-018  
**Category:** API Security  
**Security Check:** Request rate limiting and resource quotas  
**Priority:** High  
**Affected Component:** `backend/src/index.ts:26-55`; all routes, especially auth, search, upload, bulk, OAuth, and integration jobs  
**Risk:** Denial of service, brute force, storage exhaustion, and external API abuse  
**Verification Method:** Middleware inventory and controlled load test  
**Recommended Tool:** k6 / OWASP ZAP / Manual Review  
**Status:** [x] **Failed** — no rate-limit or quota middleware was found.  
**Remediation:** Add global and endpoint-specific limits, concurrency controls, pagination caps, storage quotas, timeouts, and backpressure. Mapping: OWASP API4:2023; CWE-770.

### SEC-019

**Security Check ID:** SEC-019  
**Category:** API Security  
**Security Check:** Consistent schema-based input validation and mass-assignment prevention  
**Priority:** High  
**Affected Component:** `backend/src/validation/ticket.validation.ts`; `backend/src/controllers/auth.controller.ts`; employee/project/expense/income/integration controllers  
**Risk:** Invalid states, privilege escalation, oversized data, and mass assignment  
**Verification Method:** Compare body handling across controllers and fuzz boundary values  
**Recommended Tool:** Semgrep / fast-check / Vitest  
**Status:** [x] **Failed** — tickets use explicit parsers, but many other controllers directly destructure or cast unvalidated request bodies and roles/statuses.  
**Remediation:** Adopt one schema validator for every request, reject unknown fields, validate lengths/formats/enums/numbers/dates, and keep authorization fields server-derived. Mapping: OWASP API3:2023; CWE-20, CWE-915.

### SEC-020

**Security Check ID:** SEC-020  
**Category:** API Security  
**Security Check:** CORS and CSRF posture  
**Priority:** Medium  
**Affected Component:** `backend/src/index.ts:28-31`; `frontend/lib/api.ts:7-11`  
**Risk:** Cross-origin data access or forged state-changing requests  
**Verification Method:** Header review at runtime for approved and unapproved origins  
**Recommended Tool:** curl / OWASP ZAP  
**Status:** [ ] **Needs Manual Review** — exact-origin CORS configuration is present and bearer headers reduce classic CSRF, but deployed values/proxy behavior are unknown; cookie migration would require CSRF controls.  
**Remediation:** Validate strict production origins, disallow reflection/null origins, minimize methods/headers, and add CSRF tokens/origin checks if credentials move to cookies. Mapping: CWE-942, CWE-352.

### SEC-021

**Security Check ID:** SEC-021  
**Category:** API Security  
**Security Check:** Error and sensitive response handling  
**Priority:** Medium  
**Affected Component:** `backend/src/lib/api-error.ts:9-14`; provider/controller error logging  
**Risk:** Stack traces, tokens, internal details, or PII exposed in responses/logs  
**Verification Method:** Static review plus malformed-request tests  
**Recommended Tool:** OWASP ZAP / Vitest  
**Status:** [ ] **Needs Manual Review** — generic unexpected responses are implemented, but provider errors are logged and log redaction is not centralized.  
**Remediation:** Add structured redacted logging, stable public error codes, correlation IDs, and tests ensuring secrets/provider payloads never reach clients or logs. Mapping: CWE-209, CWE-532.

## 4. Frontend security

### SEC-022

**Security Check ID:** SEC-022  
**Category:** Frontend Security  
**Security Check:** DOM/reflected/stored XSS sinks  
**Priority:** High  
**Affected Component:** `frontend/app`; `frontend/components`  
**Risk:** Script execution and bearer-token theft  
**Verification Method:** Search for unsafe sinks plus runtime payload tests on user/provider content  
**Recommended Tool:** Semgrep / OWASP ZAP  
**Status:** [ ] **Needs Manual Review** — no `dangerouslySetInnerHTML`, `innerHTML`, or eval sink was found, and React escaping is used; dynamic third-party/user fields still require DAST.  
**Remediation:** Preserve contextual escaping, sanitize any future rich text, validate URLs, and add XSS regression tests. Mapping: OWASP A03:2021; CWE-79.

### SEC-023

**Security Check ID:** SEC-023  
**Category:** Frontend Security  
**Security Check:** Content Security Policy and browser hardening headers  
**Priority:** High  
**Affected Component:** `frontend/next.config.ts:1-7`; `backend/src/index.ts:28`  
**Risk:** Increased impact of XSS, framing, data exfiltration, and browser feature abuse  
**Verification Method:** Deployed-header inspection  
**Recommended Tool:** OWASP ZAP / curl / Mozilla Observatory  
**Status:** [ ] **Needs Manual Review** — backend Helmet exists, but frontend-specific CSP/header configuration is absent and reverse-proxy behavior is unknown.  
**Remediation:** Deploy nonce/hash-based CSP, frame restrictions, Referrer-Policy, Permissions-Policy, HSTS at TLS edge, and automated header tests.

### SEC-024

**Security Check ID:** SEC-024  
**Category:** Frontend Security  
**Security Check:** Client-exposed secrets and public environment variables  
**Priority:** High  
**Affected Component:** `frontend/.env.local`; `frontend/lib/api.ts:3-5`; all `NEXT_PUBLIC_*` usage  
**Risk:** Accidental credential disclosure in browser bundles  
**Verification Method:** Inspect variable names and production bundles without recording values  
**Recommended Tool:** Gitleaks / Trivy / Manual Review  
**Status:** [x] **Passed** — only `NEXT_PUBLIC_API_URL` was identified in the frontend environment file and usage; no frontend secret variable was found.  
**Remediation:** Keep all credentials server-side and add bundle/secret scanning in CI.

### SEC-025

**Security Check ID:** SEC-025  
**Category:** Frontend Security  
**Security Check:** Third-party links/images and untrusted URL schemes  
**Priority:** Medium  
**Affected Component:** `frontend/app/(dashboard)/projects/[id]/page.tsx:484,570`; proof/avatar rendering paths  
**Risk:** Phishing, `javascript:` URLs, tracking, or unsafe embedded content  
**Verification Method:** URL-scheme validation review and runtime malicious-provider payload tests  
**Recommended Tool:** Semgrep / OWASP ZAP  
**Status:** [ ] **Needs Manual Review** — external URLs are rendered from provider/database content; new-tab links use `noreferrer`, but server-side URL allowlisting is not evident.  
**Remediation:** Permit only expected HTTPS provider/object-storage hosts and safe schemes; proxy or sanitize remote media where appropriate.

## 5. Database security

### SEC-026

**Security Check ID:** SEC-026  
**Category:** Database Security  
**Security Check:** Runtime database least privilege and separation from migration role  
**Priority:** High  
**Affected Component:** `backend/src/lib/prisma.ts`; `backend/prisma.config.ts`; deployment environment  
**Risk:** Full database compromise after application compromise  
**Verification Method:** Inspect PostgreSQL roles/grants in the deployed environment  
**Recommended Tool:** psql / Manual Review  
**Status:** [ ] **Needs Manual Review** — repository contains one `DATABASE_URL`; role privileges are not represented.  
**Remediation:** Separate migration/runtime/read-only roles, deny ownership/superuser/public schema creation to runtime, and rotate credentials.

### SEC-027

**Security Check ID:** SEC-027  
**Category:** Database Security  
**Security Check:** Database TLS and encryption at rest  
**Priority:** High  
**Affected Component:** `backend/src/lib/prisma.ts`; deployment database configuration  
**Risk:** Credential/data interception and storage disclosure  
**Verification Method:** Inspect connection parameters, certificates, cloud settings, and disk/KMS configuration  
**Recommended Tool:** psql / cloud provider tools / Manual Review  
**Status:** [ ] **Needs Manual Review** — deployment controls are outside the repository.  
**Remediation:** Require verified TLS, managed encryption at rest, restricted network paths, KMS rotation, and documented exceptions.

### SEC-028

**Security Check ID:** SEC-028  
**Category:** Database Security  
**Security Check:** Tenant isolation at database layer  
**Priority:** Critical  
**Affected Component:** `backend/prisma/schema.prisma`; Prisma migrations  
**Risk:** A missed application predicate exposes another tenant's data  
**Verification Method:** Schema/migration review and database policy inspection  
**Recommended Tool:** Manual Review / psql  
**Status:** [x] **Failed** — tenant IDs are nullable on several models and no PostgreSQL row-level security policies were found; confirmed controller omissions demonstrate the risk.  
**Remediation:** Make tenant ownership non-null where applicable, use composite tenant-aware constraints, centralized query helpers, and evaluate RLS with per-request tenant context. Mapping: CWE-284.

### SEC-029

**Security Check ID:** SEC-029  
**Category:** Database Security  
**Security Check:** Backup encryption, restore testing, retention, and tenant deletion  
**Priority:** High  
**Affected Component:** Deployment/operations (no repository implementation found)  
**Risk:** Data loss, unrecoverable incidents, or retained customer data  
**Verification Method:** Review backup policies, restore evidence, retention schedules, and deletion runbooks  
**Recommended Tool:** Cloud provider tools / Manual Review  
**Status:** [ ] **Needs Manual Review**  
**Remediation:** Encrypt backups, restrict restore privileges, test restores, define RPO/RTO, and ensure deletion/retention requirements include backups.

## 6. Cloud and infrastructure security

### SEC-030

**Security Check ID:** SEC-030  
**Category:** Cloud and Infrastructure Security  
**Security Check:** Production IAM and service-account least privilege  
**Priority:** Critical  
**Affected Component:** Deployment environment; no IAM/IaC files found  
**Risk:** Cloud account or resource takeover  
**Verification Method:** Cloud IAM/access-key review  
**Recommended Tool:** Cloud provider tools / Prowler / ScoutSuite  
**Status:** [ ] **Needs Manual Review**  
**Remediation:** Use workload identities, least-privilege roles, short-lived credentials, MFA for operators, and periodic access reviews.

### SEC-031

**Security Check ID:** SEC-031  
**Category:** Cloud and Infrastructure Security  
**Security Check:** Network exposure, TLS, reverse proxy, and trusted proxy configuration  
**Priority:** High  
**Affected Component:** `backend/src/index.ts`; `README.md:88-95`; deployment edge  
**Risk:** Cleartext traffic, spoofed client IPs, exposed database/API, and ineffective throttling  
**Verification Method:** External port/TLS/header review with written authorization  
**Recommended Tool:** testssl.sh / nmap / curl / Manual Review  
**Status:** [ ] **Needs Manual Review** — README recommends TLS proxying, but no deployment configuration exists.  
**Remediation:** Expose only TLS edge, isolate database/private services, configure trusted proxies explicitly, enforce modern TLS/HSTS, and add WAF/rate controls where appropriate.

### SEC-032

**Security Check ID:** SEC-032  
**Category:** Cloud and Infrastructure Security  
**Security Check:** Container image and runtime hardening  
**Priority:** Medium  
**Affected Component:** Repository deployment assets  
**Risk:** Vulnerable or overprivileged runtime containers  
**Verification Method:** Container/IaC inventory  
**Recommended Tool:** Trivy / Dockle  
**Status:** [x] **Not Applicable** — no Dockerfile, compose file, Kubernetes manifest, or container image definition was found.  
**Remediation:** When containers are added, use pinned minimal images, non-root users, read-only filesystems, dropped capabilities, health checks, and image signing/scanning.

### SEC-033

**Security Check ID:** SEC-033  
**Category:** Cloud and Infrastructure Security  
**Security Check:** Secret manager use and encryption-key rotation  
**Priority:** Critical  
**Affected Component:** `backend/.env`; `backend/src/lib/encrypt.ts:5-9`; deployment configuration  
**Risk:** JWT, database, OAuth, or encryption-key compromise  
**Verification Method:** Review variable names, secret storage, access policy, rotation, and incident process without exposing values  
**Recommended Tool:** Gitleaks / Trivy / cloud secret manager  
**Status:** [ ] **Needs Manual Review** — local secret-bearing environment files exist; production custody and rotation are unknown.  
**Remediation:** Use a managed secret store, separate environments, restrict access, support key versions/rotation, and never commit or log values.

## 7. Dependency and supply-chain security

### SEC-034

**Security Check ID:** SEC-034  
**Category:** Dependency and Supply Chain Security  
**Security Check:** Known vulnerable npm dependencies  
**Priority:** High  
**Affected Component:** `backend/package-lock.json`; `frontend/package-lock.json`  
**Risk:** Exploitation of known package vulnerabilities  
**Verification Method:** Advisory scan of lockfiles  
**Recommended Tool:** npm audit / OSV-Scanner / Trivy  
**Status:** [ ] **Not Tested** — no advisory lookup was executed during this assessment.  
**Remediation:** Run production and full dependency scans, triage reachability, patch by SLA, and record accepted risk with expiry. Add CVEs only after scanner confirmation.

### SEC-035

**Security Check ID:** SEC-035  
**Category:** Dependency and Supply Chain Security  
**Security Check:** Reproducible installation and lockfile integrity  
**Priority:** Medium  
**Affected Component:** `.github/workflows/ci.yml:29-55`; both lockfiles  
**Risk:** Unreviewed or non-reproducible dependency changes  
**Verification Method:** CI workflow review  
**Recommended Tool:** npm ci  
**Status:** [x] **Passed** — both CI jobs use `npm ci` with committed lockfile cache paths.  
**Remediation:** Protect lockfile changes with review/automated updates and provenance where available.

### SEC-036

**Security Check ID:** SEC-036  
**Category:** Dependency and Supply Chain Security  
**Security Check:** Secret detection in current tree and Git history  
**Priority:** Critical  
**Affected Component:** Entire workspace; `backend/.env`; `frontend/.env.local`; `frontend/.git`  
**Risk:** Credential disclosure and persistent compromise through history  
**Verification Method:** Redacted secret scan of tree and available history  
**Recommended Tool:** Gitleaks / Trivy  
**Status:** [ ] **Not Tested** — values were deliberately not inspected or scanned; full-root Git history is unavailable in this checkout.  
**Remediation:** Scan with redaction, revoke before removal, purge history where required, and add pre-commit/CI secret scanning.

### SEC-037

**Security Check ID:** SEC-037  
**Category:** Dependency and Supply Chain Security  
**Security Check:** CI action pinning and workflow permissions  
**Priority:** High  
**Affected Component:** `.github/workflows/ci.yml:1-55`  
**Risk:** Compromised mutable action tags or excessive token permissions  
**Verification Method:** Workflow review and policy scan  
**Recommended Tool:** Checkov / zizmor  
**Status:** [x] **Failed** — actions are pinned to mutable major tags and workflow-level least-privilege `permissions` is absent.  
**Remediation:** Pin actions by full commit SHA, set `permissions: contents: read`, harden pull-request trust boundaries, and scan workflows.

### SEC-038

**Security Check ID:** SEC-038  
**Category:** Dependency and Supply Chain Security  
**Security Check:** Automated SAST/SCA/secret/container security gates  
**Priority:** High  
**Affected Component:** `.github/workflows/ci.yml:28-55`  
**Risk:** Security regressions reach deployment undetected  
**Verification Method:** CI job inventory  
**Recommended Tool:** Semgrep / CodeQL / OSV / Gitleaks / Trivy  
**Status:** [x] **Failed** — CI runs migrations, typechecks, tests, and builds but no dedicated security scanner.  
**Remediation:** Add staged security jobs, SARIF upload, severity policy, reviewable suppressions, and scheduled scans.

## 8. SaaS business-logic security

### SEC-039

**Security Check ID:** SEC-039  
**Category:** SaaS Business Logic Security  
**Security Check:** Subscription plan entitlement enforcement  
**Priority:** High  
**Affected Component:** `backend/prisma/schema.prisma:395-400`; organization/project/employee feature routes  
**Risk:** Plan-limit and paid-feature bypass  
**Verification Method:** Trace plan value from organization to server-side feature checks  
**Recommended Tool:** Manual Review / integration tests  
**Status:** [x] **Failed** — a plan enum exists, but no server-side quota or feature-entitlement enforcement was found.  
**Remediation:** Centralize entitlements and quotas, enforce them transactionally on backend mutations, meter usage, and audit overrides. Mapping: CWE-840.

### SEC-040

**Security Check ID:** SEC-040  
**Category:** SaaS Business Logic Security  
**Security Check:** Payment gateway and webhook signature/replay validation  
**Priority:** Critical  
**Affected Component:** Repository-wide payment/webhook inventory  
**Risk:** Forged payments, subscription activation, or replay  
**Verification Method:** Route/dependency search  
**Recommended Tool:** Manual Review  
**Status:** [x] **Not Applicable** — no payment processor, billing webhook, or checkout implementation was found.  
**Remediation:** Before adding billing, verify provider signatures over raw bodies, enforce timestamp tolerance/idempotency, store event IDs, and derive entitlements only from verified server events.

### SEC-041

**Security Check ID:** SEC-041  
**Category:** SaaS Business Logic Security  
**Security Check:** Organization invitation and membership acceptance security  
**Priority:** High  
**Affected Component:** `backend/src/routes/auth.routes.ts:10-11`; employee creation routes  
**Risk:** Unauthorized tenant membership and privilege assignment  
**Verification Method:** Feature inventory and role-tampering tests  
**Recommended Tool:** Manual Review / Supertest  
**Status:** [x] **Failed** — no invitation lifecycle exists; direct account creation accepts privileged role fields and can accept organization ID in registration.  
**Remediation:** Use single-use hashed invitation tokens bound to tenant/email/role, expiry, inviter authority, acceptance audit, and safe role ceilings.

### SEC-042

**Security Check ID:** SEC-042  
**Category:** SaaS Business Logic Security  
**Security Check:** Expense approval segregation of duties and tenant/team ownership  
**Priority:** Critical  
**Affected Component:** `backend/src/controllers/expense.controller.ts:131-189`; approval/revocation/payment functions  
**Risk:** Self/foreign approval and fraudulent financial state transitions  
**Verification Method:** State-machine, submitter/manager, duplicate, race, and cross-tenant tests  
**Recommended Tool:** Supertest / Manual Review  
**Status:** [x] **Failed** — approval roles/status are checked, but tenant/team ownership and robust separation of duties are not consistently enforced.  
**Remediation:** Define a formal state machine, disallow submitter self-approval, require in-tenant manager relationships, use unique approval constraints/version predicates, and audit every transition. Mapping: CWE-841.

### SEC-043

**Security Check ID:** SEC-043  
**Category:** SaaS Business Logic Security  
**Security Check:** Reversible action integrity and audit authorization  
**Priority:** High  
**Affected Component:** `backend/src/services/audit.service.ts`; `backend/src/services/audit-reversal.ts`; `backend/src/controllers/audit.controller.ts`  
**Risk:** Unauthorized rollback, history tampering, or overwrite of newer state  
**Verification Method:** Static review plus concurrent/replay/foreign-tenant reversal tests  
**Recommended Tool:** Vitest / Supertest  
**Status:** [ ] **Needs Manual Review** — append-only reversal events, tenant queries, permissions, expiry, and optimistic versions are present; full database integration and concurrency tests are not.  
**Remediation:** Add integration tests, database constraints for immutable audit records, request IDs, actor/reason policy, and security monitoring for reversals.

## 9. AI and agent security

### SEC-044

**Security Check ID:** SEC-044  
**Category:** AI and Agent Security  
**Security Check:** Prompt injection and untrusted model output handling  
**Priority:** High  
**Affected Component:** Repository-wide AI/LLM inventory  
**Risk:** Model manipulation and unsafe output execution  
**Verification Method:** Dependency/code search  
**Recommended Tool:** Manual Review  
**Status:** [x] **Not Applicable** — no LLM or AI model integration was found.  
**Remediation:** Reassess before introducing AI features.

### SEC-045

**Security Check ID:** SEC-045  
**Category:** AI and Agent Security  
**Security Check:** Agent tool authorization and excessive agency  
**Priority:** Critical  
**Affected Component:** Repository-wide agent/tool inventory  
**Risk:** Unauthorized autonomous actions  
**Verification Method:** Dependency/code search  
**Recommended Tool:** Manual Review  
**Status:** [x] **Not Applicable** — no agent runtime or tool-execution framework was found.  
**Remediation:** If introduced, enforce per-user/tenant tool authorization, confirmation for destructive actions, allowlists, budgets, and complete audit trails.

### SEC-046

**Security Check ID:** SEC-046  
**Category:** AI and Agent Security  
**Security Check:** Vector store, knowledge-base, model memory, and tenant isolation  
**Priority:** Critical  
**Affected Component:** Repository-wide storage/integration inventory  
**Risk:** Cross-tenant retrieval and sensitive-data leakage  
**Verification Method:** Schema/dependency/code search  
**Recommended Tool:** Manual Review  
**Status:** [x] **Not Applicable** — no vector database, RAG knowledge base, or agent memory store was found.  
**Remediation:** Require tenant-scoped indexes, metadata filters enforced server-side, deletion propagation, and retrieval isolation tests if added.

## 10. Logging and monitoring

### SEC-047

**Security Check ID:** SEC-047  
**Category:** Logging and Monitoring  
**Security Check:** Immutable security audit event coverage  
**Priority:** High  
**Affected Component:** `backend/prisma/schema.prisma:259-286`; `backend/src/services/audit.service.ts`; privileged controllers  
**Risk:** Inability to investigate identity, finance, integration, and tenant-security incidents  
**Verification Method:** Map sensitive actions to audit writes  
**Recommended Tool:** Manual Review / integration tests  
**Status:** [x] **Failed** — ticket audit/reversal exists, but authentication, role, organization, SCM, financial, file, and project membership events are not centrally audited.  
**Remediation:** Emit immutable tenant-scoped events for all sensitive actions, including outcome, actor, target, source, request ID, and safe change metadata. Mapping: OWASP A09:2021; CWE-778.

### SEC-048

**Security Check ID:** SEC-048  
**Category:** Logging and Monitoring  
**Security Check:** Sensitive-data and token redaction in logs  
**Priority:** High  
**Affected Component:** `backend/src/index.ts:30`; `backend/src/lib/api-error.ts:13`; OAuth/provider catch blocks and worker logs  
**Risk:** Credentials, tokens, PII, or provider responses written to logs  
**Verification Method:** Trigger safe failures with synthetic secrets and inspect captured logs  
**Recommended Tool:** Manual Review / unit tests  
**Status:** [ ] **Needs Manual Review** — Morgan's default format does not log bodies, but arbitrary errors are logged without a centralized redactor.  
**Remediation:** Use structured allowlisted logging, recursive redaction, correlation IDs, controlled retention/access, and tests containing canary secrets. Mapping: CWE-532.

### SEC-049

**Security Check ID:** SEC-049  
**Category:** Logging and Monitoring  
**Security Check:** Suspicious activity detection and security alerting  
**Priority:** High  
**Affected Component:** Authentication, authorization, finance, audit reversal, upload, and integration flows  
**Risk:** Attacks continue without timely detection  
**Verification Method:** Review alert rules, metrics, and incident routing in deployed environment  
**Recommended Tool:** SIEM/APM / Manual Review  
**Status:** [x] **Failed** — no application security detection or alerting logic was found.  
**Remediation:** Alert on login bursts, foreign-object denials, privilege changes, seed/default logins, finance/reversal anomalies, OAuth failures, job failures, upload abuse, and tenant-volume deviations.

### SEC-050

**Security Check ID:** SEC-050  
**Category:** Logging and Monitoring  
**Security Check:** Incident response, audit retention, backup evidence, and breach readiness  
**Priority:** High  
**Affected Component:** Operational documentation (not found)  
**Risk:** Delayed containment, incomplete evidence, and regulatory/customer impact  
**Verification Method:** Tabletop exercise and runbook/evidence review  
**Recommended Tool:** Manual Review  
**Status:** [ ] **Needs Manual Review**  
**Remediation:** Define ownership, severity/notification criteria, credential/token revocation, tenant communication, forensic log retention, recovery, legal escalation, and annual tabletop exercises.

## Immediate review order

1. SEC-008, SEC-009 — user/role/tenant takeover paths.
2. SEC-010 through SEC-013 — project and financial cross-tenant access.
3. SEC-001, SEC-002, SEC-004, SEC-006 — identity/session and abuse controls.
4. SEC-017, SEC-018, SEC-019 — SSRF, quotas, and validation.
5. SEC-028, SEC-033, SEC-036 — database isolation and secret governance.
