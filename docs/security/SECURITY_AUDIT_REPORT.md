# Security Vulnerability Assessment Report

Assessment date: 2026-10-13  
Scope: local repository only; no production systems or active exploitation  
Method: manual static review of application code, Prisma schema/migrations, configuration, CI workflow, package manifests, and environment-variable names. Secret values were not recorded. Dependency CVE scans and dynamic tests were not run.

> This report is the pre-remediation snapshot. See [SECURITY_FIX_IMPLEMENTATION_REPORT.md](./SECURITY_FIX_IMPLEMENTATION_REPORT.md) for implemented fixes, verification results, dependency scan outcomes, and residual work.

## Executive summary

Stride is a multi-tenant business operations SaaS application. The frontend is Next.js 16/React 19 with Ant Design, TanStack Query, Axios, and Zustand. The backend is Express 5/TypeScript using PostgreSQL 16 through Prisma 7. Authentication uses signed bearer JWTs. Major domains include organizations, employees, projects, tickets, attendance, timesheets, expenses, income, audit/reversal history, and GitHub/GitLab OAuth integrations. Uploaded financial proofs are stored on local disk and served by Express.

The review confirms systemic tenant-isolation weaknesses in employee, project, expense, income, and dashboard paths. The most severe issue is that manager-level users can submit arbitrary role and organization values while creating or updating users. Several object lookups use globally unique IDs without including `organizationId`, allowing authenticated users with the expected role to read or mutate another tenant's records if an identifier is obtained. These are code-confirmed defects; exploitability was not tested against a running deployment.

## Architecture and trust boundaries

| Area | Observed implementation | Security relevance |
|---|---|---|
| Browser | Next.js App Router, Axios, Zustand | JWT is persisted in browser `localStorage`; XSS would expose it. |
| API | Express routes under `/api/v1` | Route middleware uses JWT claims for authorization; no global rate limiter was found. |
| Identity | Email/password, bcrypt, JWT | Seven-day default bearer token; no refresh rotation, MFA, reset flow, or server-side revocation. |
| Tenancy | Nullable `organizationId` columns and controller query filters | Isolation is application-enforced and inconsistent; PostgreSQL RLS was not found. |
| Database | PostgreSQL with Prisma | ORM parameterization reduces SQL injection risk; DB grants, TLS, backups, and encryption at rest are deployment concerns requiring verification. |
| Files | Multer local-disk uploads, public `/uploads` static route | Proof files are not authorization-gated; MIME is trusted without content inspection. |
| Integrations | GitHub/GitLab OAuth and background access jobs | Tokens use AES-256-GCM at rest; tenant-configurable GitLab host introduces an SSRF boundary. |
| CI/CD | GitHub Actions, Node 20, PostgreSQL service | Typecheck/build/tests run; no SAST, SCA, secret, IaC, or container scan. Actions use mutable major tags. |
| Billing | Plan enum and admin plan update only | No payment gateway/webhook implementation was found; plan enforcement was not found. |
| AI | None found | No LLM, agent, vector database, or knowledge-base code was identified. |

## Confirmed findings

### F-001 — User-management tenant isolation and privilege escalation

- Severity: Critical
- Status: Failed (confirmed by static code evidence)
- Mapping: OWASP A01:2021 Broken Access Control; OWASP API1:2023 BOLA; OWASP API5:2023 BFLA; CWE-639; CWE-269
- Evidence:
  - `backend/src/routes/auth.routes.ts:10-11` permits managers to call registration.
  - `backend/src/controllers/auth.controller.ts:64-76` accepts caller-controlled `role` and `organizationId` and creates the user without binding either value to the authenticated actor.
  - `backend/src/controllers/employee.controller.ts:69-103` updates a globally addressed user and permits manager-class roles to change role/status without verifying the target organization.
  - `backend/src/controllers/employee.controller.ts:106-123` accepts arbitrary roles during employee creation.
  - `backend/src/controllers/employee.controller.ts:45-66` reads an employee by global ID without tenant scoping.
- Impact: A manager could create a founder account, create an account in another organization, or alter another tenant's user if an ID is known. This can lead to tenant takeover and broad data access.
- Recommendation: Centralize user-management policy; derive `organizationId` exclusively from the authenticated actor; use an explicit role-assignment matrix; prohibit self-promotion; scope every target/reference query to the tenant; require recent reauthentication for privileged role changes; add negative cross-tenant tests.

### F-002 — Project IDOR and cross-tenant membership mutation

- Severity: Critical
- Status: Failed (confirmed by static code evidence)
- Mapping: OWASP A01:2021; OWASP API1:2023; CWE-639; CWE-862
- Evidence:
  - `backend/src/controllers/project.controller.ts:27-43` omits `organizationId` from the selected project shape.
  - `backend/src/controllers/project.controller.ts:73-89` reads by global ID, then checks a missing `organizationId` property, making the intended guard ineffective.
  - `backend/src/controllers/project.controller.ts:138-168` and `171-197` add/remove members without tenant validation for either project or user.
  - `backend/src/controllers/project.controller.ts:200-220` returns project statistics with no access or tenant check.
- Impact: Authenticated users can potentially read project details/statistics across tenants. Authorized managers can mutate membership and trigger external repository grants/revocations for foreign projects.
- Recommendation: Resolve projects with `{ id, organizationId: actor.organizationId }`; validate membership visibility; validate the target user belongs to the same tenant; enforce project-level authorization before statistics and SCM side effects.

### F-003 — Cross-tenant expense disclosure and financial state changes

- Severity: Critical
- Status: Failed (confirmed by static code evidence)
- Mapping: OWASP A01:2021; OWASP API1/API5:2023; CWE-639
- Evidence:
  - `backend/src/controllers/expense.controller.ts:63-75` lacks tenant enforcement for non-employee readers.
  - `backend/src/controllers/expense.controller.ts:131-189` approves globally addressed expenses without tenant/team ownership checks.
  - `backend/src/controllers/expense.controller.ts:211-218` returns pending expenses globally to finance roles.
  - `backend/src/controllers/expense.controller.ts:224-317` revokes approvals/payments or marks paid by global ID without tenant filters.
  - `backend/src/controllers/expense.controller.ts:320-376` calculates financial summaries without `organizationId` filters.
- Impact: Finance users may view or change another tenant's financial records and aggregated financial data.
- Recommendation: Make `organizationId` mandatory on financial records; include it in all reads, updates, aggregates, approvals, and related user lookups; enforce manager-to-submitter relationships within the same tenant; use transactions with state/version predicates.

### F-004 — Cross-tenant income record IDOR

- Severity: Critical
- Status: Failed (confirmed by static code evidence)
- Mapping: OWASP A01:2021; OWASP API1:2023; CWE-639
- Evidence: `backend/src/controllers/income.controller.ts:45-55`, `86-117`, and `120-132` read, update, and delete income by global ID without `organizationId` constraints.
- Impact: A founder/CFO can access or modify financial records belonging to another organization if an ID is known.
- Recommendation: Use tenant-qualified `findFirst`/`updateMany`/`deleteMany` predicates and return 404 for foreign objects; add cross-tenant integration tests.

### F-005 — JWT authorization trusts stale embedded claims

- Severity: High
- Status: Failed (confirmed design weakness)
- Mapping: OWASP A07:2021 Identification and Authentication Failures; OWASP API2:2023; CWE-613
- Evidence: `backend/src/controllers/auth.controller.ts:7-20` embeds role, tenant, and super-admin state for a default seven days. `backend/src/middleware/auth.ts:15-31` verifies the signature but does not reload active status, tenant status, role, or a token/session version.
- Impact: Deactivated users and users whose privileges are reduced may retain their prior authority until token expiry. No logout revocation mechanism exists.
- Recommendation: Use short-lived access tokens, refresh-token rotation, server-side session/token version checks, explicit issuer/audience/algorithm validation, and active user/organization verification for every privileged request.

### F-006 — No brute-force/rate limiting on authentication or high-cost endpoints

- Severity: High
- Status: Failed (control absent in reviewed API bootstrap)
- Mapping: OWASP A07:2021; OWASP API4:2023 Unrestricted Resource Consumption; CWE-307; CWE-770
- Evidence: `backend/src/routes/auth.routes.ts:8` exposes login; `backend/src/index.ts:26-55` configures Helmet, CORS, logging, JSON parsing, and routes but no rate-limiting or abuse-control middleware.
- Impact: Credential stuffing, password guessing, OAuth initiation abuse, upload abuse, and resource exhaustion are not throttled at application level.
- Recommendation: Add per-IP and per-account login throttling with progressive delay, generic responses, trusted-proxy configuration, and endpoint-specific quotas for uploads, searches, bulk actions, OAuth, and job creation.

### F-007 — Bearer token persisted in browser localStorage

- Severity: High
- Status: Failed (confirmed implementation)
- Mapping: OWASP A07:2021; CWE-922; CWE-1004
- Evidence: `frontend/lib/api.ts:7-11` reads the token from `localStorage`; `frontend/store/auth.ts:20-32` stores the token both directly and through persisted Zustand state.
- Impact: Any successful same-origin XSS can steal a long-lived bearer token. Duplicate persistence increases exposure.
- Recommendation: Prefer Secure, HttpOnly, SameSite cookies with CSRF protection, or hold short-lived access tokens only in memory with rotated refresh tokens in HttpOnly cookies. Apply a strict CSP and reduce token lifetime.

### F-008 — Financial proof files are publicly served and weakly validated

- Severity: High
- Status: Failed (confirmed implementation)
- Mapping: OWASP A01:2021; OWASP A05:2021 Security Misconfiguration; OWASP API8:2023; CWE-434; CWE-200
- Evidence:
  - `backend/src/lib/upload.ts:8-23` trusts the client-supplied MIME type and preserves the original extension; no magic-byte validation, malware scan, or safe re-encoding is present.
  - `backend/src/index.ts:47-50` exposes the whole upload directory through an unauthenticated static route.
  - `backend/src/controllers/expense.controller.ts:84-94` and `backend/src/controllers/income.controller.ts:69-80` persist direct public URLs.
- Impact: Anyone with a URL can access financial evidence. Crafted uploads can bypass intended type checks, consume storage, or be served with unsafe content semantics.
- Recommendation: Store private objects outside the web root; authorize every download by tenant/object; issue short-lived signed URLs; validate file signatures and extensions; rename to a safe fixed extension/content type; scan malware; set `Content-Disposition: attachment`, `nosniff`, quotas, retention, and deletion cleanup.

### F-009 — Tenant-configurable GitLab host creates SSRF exposure

- Severity: High
- Status: Needs Manual Review (dangerous data flow confirmed; exploitability not tested)
- Mapping: OWASP A10:2021 SSRF; OWASP API7:2023 SSRF; CWE-918
- Evidence: `backend/src/controllers/integration.controller.ts:49-74` stores a caller-supplied GitLab host. The host is passed to the GitLab provider at `backend/src/controllers/integration.controller.ts:194-201`, `222-225`, and `278-294`, which performs server-side HTTP requests.
- Impact: An organization admin may be able to direct backend requests toward internal services or cloud metadata endpoints, depending on provider URL normalization and network egress controls.
- Recommendation: Allowlist approved public HTTPS hosts or validate resolved IPs on every request; reject loopback, private, link-local, and metadata ranges; prevent DNS rebinding and redirects to disallowed addresses; enforce egress firewall rules.

### F-010 — Dashboard/financial aggregates are not consistently tenant-scoped

- Severity: High
- Status: Failed (confirmed by static code evidence)
- Mapping: OWASP A01:2021; OWASP API1:2023; CWE-200; CWE-639
- Evidence: CFO expense queries in `backend/src/controllers/dashboard.controller.ts:65-105` construct `orgFilter` but apply it only to income queries; expense aggregates and lists omit it. Similar global expense aggregation appears in `backend/src/controllers/expense.controller.ts:320-376`.
- Impact: Organization finance dashboards can expose totals and records from all tenants.
- Recommendation: Require a tenant predicate in every aggregate and relation traversal; add query-builder helpers and regression tests using two organizations with overlapping states.

### F-011 — Seed process provisions known weak credentials and super-admin state

- Severity: High
- Status: Failed if seed is available in non-disposable environments
- Mapping: OWASP A07:2021; CWE-798; CWE-521
- Evidence: `backend/prisma/seed.ts:50-97` creates predictable accounts/passwords, including `isSuperAdmin: true`; `backend/prisma/seed.ts:129-134` prints credentials. `README.md:41-49` documents them.
- Impact: Running the seed against a reachable environment creates immediately guessable privileged credentials.
- Recommendation: Hard-block seed execution when `NODE_ENV=production`; generate one-time random credentials from a secret manager; never print passwords; force reset/MFA enrollment; clearly isolate demo data.

### F-012 — Missing centralized audit coverage for privileged/financial actions

- Severity: Medium
- Status: Failed (partial control exists)
- Mapping: OWASP A09:2021 Security Logging and Monitoring Failures; CWE-778
- Evidence: `backend/prisma/schema.prisma:259-286` and `backend/src/services/audit.service.ts` implement ticket audit events. Employee role/status changes, organization settings, SCM credentials/connections, project membership, expense approvals/payments, income mutations, and authentication events do not use this audit service.
- Impact: Critical actions cannot be reliably reconstructed or alerted on, reducing accountability and incident response capability.
- Recommendation: Add immutable, tenant-scoped audit events for authentication, authorization failures, role changes, organization settings, integrations, financial workflows, exports, and file access; include request/correlation IDs without secrets.

## Evidence-backed positive controls

- Passwords are hashed with bcrypt (`backend/src/controllers/auth.controller.ts:73`; `backend/src/controllers/employee.controller.ts:115`). Work factor 10 should be benchmarked and periodically raised.
- Generic invalid-credential responses reduce user enumeration during login (`backend/src/controllers/auth.controller.ts:39-47`).
- Helmet is enabled globally (`backend/src/index.ts:28`). Header effectiveness at the deployed edge still requires verification.
- CORS is restricted to configured `FRONTEND_URL` (`backend/src/index.ts:29`). Production value and proxy behavior require verification.
- SCM access and refresh tokens use AES-256-GCM with random 96-bit IVs (`backend/src/lib/encrypt.ts:3-17`). Key custody and rotation remain unverified.
- OAuth state values are cryptographically random, single-use, provider-bound, and expire from the in-memory map (`backend/src/controllers/integration.controller.ts:92-98`, `118-140`). Multi-instance behavior and restart handling require improvement.
- Ticket APIs have comparatively strong tenant/object authorization and optimistic locking (`backend/src/controllers/ticket.controller.ts:193-236`; `backend/src/services/ticket-permission.service.ts`).
- Unexpected errors are returned as generic messages rather than stack traces (`backend/src/lib/api-error.ts:9-14`).
- Prisma query construction is used throughout reviewed code; no raw SQL or shell execution path was found.

## Scope limitations

- No live environment, database, cloud account, DNS, TLS endpoint, reverse proxy, backups, IAM policy, container, or deployed headers were inspected.
- No credentials were validated and no secret values were copied into these reports.
- No dependency advisory lookup, SAST scanner, DAST scanner, malware scanner, Git-history secret scan, or active authorization test was executed.
- The repository has a Git history under `frontend/`, while the workspace root/backend are not part of that Git worktree. Secret-history conclusions cannot be made for the entire application.
- CVE identifiers are intentionally omitted because no advisory scan established an affected package/version. Run the commands in `SECURITY_TOOLS.md` before assigning CVEs.
