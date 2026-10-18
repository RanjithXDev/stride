# Security Remediation Implementation Report

Implementation date: 2026-10-14  
Baseline: `SECURITY_AUDIT_REPORT.md` and the 50 checks in `SECURITY_CHECKLIST.md`  
Scope: repository-remediable application controls. No production cloud account, live database, DNS/TLS endpoint, backup system, SIEM, or secret manager was available.

## Executive result

The confirmed cross-tenant and direct privilege-escalation paths identified in the original assessment have been remediated in source code. Authentication now uses short-lived HttpOnly cookies with CSRF protection, current user/organization state is loaded on every authenticated request, uploads are no longer public, GitLab hosts are allowlisted, rate limits are present, critical security actions receive audit events, and vulnerable frontend production dependencies were upgraded.

This report does **not** claim that every possible security risk is eliminated. MFA, password recovery, distributed rate limiting, PostgreSQL RLS, private cloud object storage/malware scanning, production IAM/TLS/backups, complete security-event coverage, billing entitlements, and incident response require additional product or deployment work. Those items are explicitly listed under Residual Work.

## Implemented controls

### 1. Authentication and session security

Implemented in:

- `backend/src/controllers/auth.controller.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/csrf.ts`
- `backend/src/lib/security-config.ts`
- `frontend/lib/api.ts`
- `frontend/store/auth.ts`
- `frontend/app/login/page.tsx`

Changes:

1. JWTs are restricted to HS256 and require configured issuer and audience values.
2. Default access-token lifetime was reduced from seven days to 15 minutes.
3. Every authenticated request reloads the current user role, tenant, super-admin flag, active status, and organization active status from PostgreSQL. Deactivation, tenant deactivation, and role reduction therefore take effect immediately for subsequent requests.
4. Browser authentication moved from localStorage bearer tokens to `HttpOnly`, `Secure` in production, `SameSite=Strict` cookies.
5. A cryptographically random double-submit CSRF token is set separately and required for unsafe cookie-authenticated requests using a timing-safe comparison.
6. Logout clears both session and CSRF cookies.
7. JWT secrets shorter than 32 bytes fail configuration validation. Production also requires HTTPS frontend configuration and a valid 32-byte encryption key.
8. Login email values are normalized and login input lengths are bounded.
9. Server-side password length is now 12–128 characters and bcrypt cost was raised from 10 to 12 for new/changed provisioning paths.
10. Known demo credentials were removed from the UI and README. Demo seeding now fails unless explicitly enabled for a non-production disposable environment and no longer prints passwords.

Deployment notes:

- Frontend and API should use same-site HTTPS origins, such as `app.example.com` and `api.example.com`, for `SameSite=Strict` cookies.
- Set `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `FRONTEND_URL`, `BACKEND_URL`, and `ENCRYPTION_KEY` through a managed secret/configuration service.
- Existing localStorage tokens are no longer consumed and users must sign in again after deployment.
- There is currently no refresh-token flow; users sign in again after the 15-minute session expires. A rotated refresh-session implementation is residual product work.

### 2. Brute-force and resource-consumption controls

Implemented in:

- `backend/src/middleware/rate-limit.ts`
- `backend/src/index.ts`
- auth, expense, and income route files

Changes:

- Global API limit: 300 requests per 15 minutes per resolved client IP.
- Login limit: 10 attempts per 15 minutes per IP/email tuple.
- Upload limit: 30 upload attempts per hour per IP.
- Standard rate-limit and retry headers are returned.
- JSON request bodies are capped at 100 KB.
- Express identifies no trusted proxy by default; `TRUST_PROXY_HOPS` must be explicitly configured.

Limitation: the limiter is process-local. A multi-instance production deployment needs a shared Redis-compatible limiter and endpoint/business quotas.

### 3. User and role authorization

Implemented in:

- `backend/src/routes/auth.routes.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/controllers/employee.controller.ts`

Changes:

1. Generic registration is no longer manager-accessible; only founders can use it.
2. Registration derives `organizationId` from the authenticated actor instead of request input.
3. Founder accounts cannot be created through tenant registration.
4. Employee creation and update use an explicit role rank policy. Actors cannot assign roles at or above their authority, and managers cannot create founders.
5. Employee detail/update targets are tenant-scoped.
6. Department and manager references must belong to the actor's organization.
7. Non-management users cannot update another user.
8. Employee profile visibility is limited to the caller's department or self.
9. User creation, changes, and deactivation create security audit events.

### 4. Project and repository authorization

Implemented in:

- `backend/src/controllers/project.controller.ts`
- `backend/src/controllers/project-repository.controller.ts`

Changes:

- Project detail and statistics queries include tenant predicates.
- Employee project access additionally requires project membership.
- Project membership changes require the project to belong to the actor's tenant.
- Added members must be active users in the same tenant.
- SCM grant/revoke side effects occur only after tenant validation.
- Repository access status now validates that the repository belongs to both the requested project and organization.

### 5. Financial isolation and workflow integrity

Implemented in:

- `backend/src/controllers/expense.controller.ts`
- `backend/src/controllers/income.controller.ts`
- `backend/src/controllers/dashboard.controller.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261013180000_secure_expense_approvals/migration.sql`

Changes:

1. Expense and income detail, update, delete, approval, payment, reversal, pending-list, summary, and dashboard queries are tenant-scoped.
2. Managers may access/approve only their own or direct-report expenses.
3. Submitters cannot approve their own expenses.
4. Expense approval now has a database unique constraint on `(expenseId, level)` to stop concurrent duplicate decisions.
5. Amounts must be finite, positive, and below bounded maximum values; titles and income status values are validated.
6. Approval/payment actions produce security audit events.
7. Founder/CFO aggregate queries now use organization filters consistently.

Migration required:

```bash
cd backend
npx prisma migrate deploy
```

Before applying the unique index, inspect production for existing duplicate `(expenseId, level)` rows and resolve them through an approved data-repair procedure. The migration will correctly fail rather than silently delete ambiguous approval history.

### 6. Attendance, hierarchy, and timesheet isolation

Implemented in:

- `backend/src/controllers/attendance.controller.ts`
- `backend/src/controllers/timesheet.controller.ts`
- `backend/src/lib/hierarchy.ts`
- `backend/src/workers/attendance.worker.ts`

Changes:

- Attendance list, statistics, team-today, leave, and absence backfill operations include organization scope.
- Leave targets must be active users in the caller's organization.
- Organization ID is persisted on manually created leave records.
- Manager/team-lead hierarchy traversal cannot cross organizations.
- Manual absence backfill is tenant-limited; the scheduled system worker may still intentionally process all active tenants.
- Timesheets and summaries are restricted through the log owner's organization.
- Supplied project/user filters are validated against the actor's tenant.

### 7. Protected upload handling

Implemented in:

- `backend/src/lib/upload.ts`
- `backend/src/controllers/file.controller.ts`
- `backend/src/routes/file.routes.ts`
- `frontend/hooks/useSecureFile.ts`
- expense and income frontend pages

Changes:

1. The unauthenticated `/uploads` static route was removed.
2. Proof retrieval now requires an authenticated API call and tenant/object-level authorization.
3. Protected responses use private/no-store caching and `nosniff`.
4. Server-generated filenames use canonical extensions based on the accepted MIME type instead of the original extension.
5. PDF, PNG, JPEG, and WebP magic bytes are checked after upload; mismatches are deleted and rejected.
6. Files remain limited to 10 MB and upload requests are rate-limited.
7. The frontend retrieves proof files as authenticated blobs rather than direct public links.

Residual requirement: use private object storage, malware scanning, content re-encoding where practical, storage quotas, lifecycle deletion, and signed download URLs for production scale.

### 8. SSRF and OAuth integration hardening

Implemented in:

- `backend/src/lib/scm-host.ts`
- `backend/src/controllers/integration.controller.ts`
- `backend/src/services/scm/gitlab.provider.ts`

Changes:

- GitLab hosts must be HTTPS origins without credentials, paths, query strings, fragments, or non-443 ports.
- `gitlab.com` is allowed by default; self-hosted domains must be explicitly listed in `SCM_ALLOWED_HOSTS`.
- Validation occurs when configuration is saved and whenever a provider instance is constructed.
- Loopback/private targets are rejected unless an operator has explicitly allowlisted that exact hostname.

Residual requirement: enforce network egress controls and DNS/IP validation to defend against DNS rebinding and compromised allowlisted DNS.

### 9. Frontend browser hardening

Implemented in `frontend/next.config.ts`:

- Content Security Policy with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, constrained frame/image/connect sources, and form-action restriction.
- Referrer Policy.
- Permissions Policy disabling camera, microphone, payment, and USB.
- `nosniff` and frame denial.
- Express also disables `X-Powered-By` and continues using Helmet.

Limitation: the CSP currently permits inline script/style for Next.js/Ant Design compatibility. A nonce-based CSP should replace this allowance.

### 10. Dependency and CI hardening

Changes:

- Next.js upgraded from 16.3.6 to 16.4.0, remediating the reported Next.js cache, disclosure, and image-optimization SSRF advisories.
- Vitest and coverage tooling upgraded to 4.1.11, remediating reported file-read/prototype-pollution/RCE advisories in the test toolchain.
- Sharp upgraded to 0.35.5, remediating CVE-2026-96889/GHSA-wq5f-xc86-pv6w.
- Frontend production `npm audit --omit=dev` now reports **0 vulnerabilities**.
- CI now has `contents: read` permissions, Prisma validation, and high-severity npm audit gates.
- Root `.gitignore` and a redacted backend `.env.example` were added.

Remaining advisory notes:

- Frontend full audit still reports development-only findings through `eslint-config-next`/glob tooling; npm proposes a breaking downgrade incompatible with the Next.js runtime. Production dependencies are clean.
- Backend audit reports Prisma CLI/config and unused MySQL-driver transitive advisories, even with `--omit=dev`; npm proposes downgrading Prisma 7 to Prisma 6.19.3. The application uses PostgreSQL and Prisma 7 APIs, so an untested major downgrade was not applied. Track upstream patched Prisma 7/8 releases and upgrade after compatibility testing.
- GitHub Actions use mutable major tags. Pinning by full SHA remains required, but exact trusted SHAs should be selected through the organization's dependency-review process rather than guessed.

## Verification performed

### Backend

```text
Prisma client generation: passed
TypeScript build: passed
Node test suite: 32 tests passed, 0 failed
```

The suite includes JWT middleware, authorization policy, CSRF, JWT secret length, SCM host allowlisting, encryption, ticket authorization, reversal safety, input validation, and provider behavior.

### Frontend

```text
TypeScript no-emit check: passed
Vitest suite: 24 tests passed, 0 failed
Production npm audit: 0 vulnerabilities
```

The optimized Next.js build reached `Creating an optimized production build` but did not finish or emit an error after an extended wait in this environment, and was stopped. This is not recorded as a successful production build. CI should run the build in a clean runner with adequate disk/memory and a timeout.

### Not performed

- No production migration was applied.
- No production secrets, cloud account, database grants, DNS, TLS, reverse proxy, object store, backups, or SIEM were accessed.
- No active exploitation, DAST, malware upload, or destructive testing was performed.
- Gitleaks, Semgrep, Trivy, Checkov, and ZAP were not installed/run in this implementation pass.

## Residual work by original checklist

| Original checks | Current state | Required next action |
|---|---|---|
| SEC-001, SEC-002 | Substantially remediated | Add rotating refresh sessions and token/session-version revocation for stolen access tokens. |
| SEC-003 | Partially remediated | Add breached-password service, password change/reset flows, and cost benchmarking. |
| SEC-004, SEC-018 | Partially remediated | Replace process-local limits with shared distributed limits and tenant/business quotas. |
| SEC-005 | Open | Implement secure reset, verified email changes, privileged MFA, recovery, and recent reauthentication. |
| SEC-006 | Remediated | Validate production cookie behavior on final domains and TLS edge. |
| SEC-007–SEC-013 | Source remediation complete | Add database-backed two-tenant integration tests before production sign-off. |
| SEC-014–SEC-016 | Existing controls retained | Continue regression/SAST enforcement. |
| SEC-017 | Application allowlist complete | Add DNS/IP and egress-layer SSRF controls. |
| SEC-019 | Partially remediated | Migrate every remaining non-ticket controller to centralized schema validation. |
| SEC-020 | Remediated for cookie authentication | Validate CORS/CSRF at deployed frontend/API origins. |
| SEC-021–SEC-025 | Partially remediated | Add structured log redaction, nonce CSP, and strict external URL allowlists. |
| SEC-026–SEC-031 | External/manual | Configure DB least privilege/TLS/RLS/backups and cloud IAM/network/TLS controls. |
| SEC-032 | Not applicable | Apply container controls when containerization is introduced. |
| SEC-033 | Partially remediated | Move all production secrets to a managed secret store and implement rotation/versioning. |
| SEC-034 | Frontend production clean; backend toolchain residual | Track patched Prisma release and keep scheduled audits. |
| SEC-035 | Passed | Preserve lockfile review and `npm ci`. |
| SEC-036 | Not tested | Run redacted Gitleaks against all available repositories/history and rotate findings. |
| SEC-037, SEC-038 | Partially remediated | Pin actions by SHA and add Semgrep, Gitleaks, Trivy, Checkov, SARIF, and ephemeral ZAP. |
| SEC-039 | Open | Define product plan limits and enforce entitlements transactionally on the backend. |
| SEC-040 | Not applicable | Implement signed/idempotent webhook security before adding billing. |
| SEC-041 | Direct escalation fixed | Build a single-use, hashed, expiring invitation lifecycle instead of direct provisioning. |
| SEC-042 | Substantially remediated | Add integration/concurrency tests and formal state-machine/version enforcement. |
| SEC-043 | Needs integration verification | Run concurrent and cross-tenant reversal tests against PostgreSQL. |
| SEC-044–SEC-046 | Not applicable | Reassess before adding AI functionality. |
| SEC-047 | Partially remediated | Extend atomic audit writes to all organization, integration, file, income, and revocation actions. |
| SEC-048–SEC-050 | External/partial | Deploy redacted structured logs, alerts, retention, and incident-response runbooks/tabletops. |

## Required deployment sequence

1. Back up the database and verify restore procedures.
2. Identify and resolve duplicate expense approval levels before migration.
3. Configure the new environment variables from `backend/.env.example` through a secret manager.
4. Deploy database migrations with `npx prisma migrate deploy`.
5. Deploy backend and frontend together because browser authentication and proof URLs changed as one coordinated contract.
6. Force all users to sign in again; old localStorage tokens are intentionally ignored.
7. Verify cookie flags, CORS, CSRF, CSP, HSTS/TLS, proxy IP handling, protected file access, and tenant-negative cases in staging.
8. Run the tool commands in `SECURITY_TOOLS.md` and retain redacted reports.
9. Monitor login throttling, 401/403/429 rates, finance transitions, audit reversals, uploads, and integration errors during rollout.

## Acceptance criteria before production security sign-off

- Two-tenant integration suite proves no read, mutation, aggregate, file, audit, or external-job side effect crosses tenants.
- Every privileged role transition has a tested role ceiling and immutable audit event.
- Production migrations and rollback/restore are tested on a staging copy.
- Production frontend build completes on CI.
- Frontend and backend production dependency audits meet the organization's policy, with documented exceptions for unreachable toolchain-only advisories.
- Secret scan, SAST, IaC/workflow scan, and passive DAST findings are triaged.
- MFA/reset, distributed throttling, cloud IAM/TLS/backups, and incident response have named owners and deadlines.
