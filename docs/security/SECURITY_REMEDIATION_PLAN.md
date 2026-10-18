# Security Remediation Plan

## P0 — Containment before any production exposure (0–48 hours)

1. Fix user administration: tenant-bind all target records and references, remove caller-controlled organization assignment, implement an explicit role-assignment matrix, and prevent self-promotion. Add two-tenant tests for every user endpoint.
2. Fix project authorization: tenant-scope detail, statistics, membership, and repository side effects; validate that added users and referenced departments belong to the same tenant.
3. Fix financial isolation: add organization predicates to every expense/income detail, mutation, approval, payment, pending list, dashboard, and aggregate query.
4. Disable or firewall public deployments until items 1–3 pass negative authorization tests. Rotate any real credentials if demo seed data was ever used outside a disposable local database.
5. Remove direct public access to uploaded proofs. Temporarily require authentication through a download controller while private object storage is implemented.

Exit criteria: automated integration tests prove that actors from tenant A receive 404/403 and produce no side effects for every tenant B object; manager cannot assign a role equal to or above their authority; finance aggregates contain only the actor's tenant.

## P1 — Identity and abuse resistance (first week)

1. Replace seven-day self-contained authorization with short-lived access tokens plus rotated refresh sessions. Validate algorithm, issuer, audience, subject, active user, active organization, and token/session version.
2. Move refresh credentials to Secure, HttpOnly, SameSite cookies; keep access tokens in memory or use a complete cookie/CSRF design. Remove duplicate localStorage persistence.
3. Add login/account rate limits, progressive delays, alerting, and endpoint quotas. Configure Express `trust proxy` only for known proxies.
4. Enforce password length and breached-password controls server-side. Add secure password reset, MFA for privileged roles, reauthentication for role/integration/payment actions, and session management.
5. Make demo seeding environment-safe and remove printed/default passwords.

Exit criteria: deactivation and role downgrade invalidate existing sessions; brute-force tests are throttled; privileged users enroll MFA; password policy tests execute in CI.

## P1 — Upload and integration hardening (first week)

1. Move proofs to private object storage with tenant-scoped authorization and short-lived signed downloads.
2. Validate magic bytes, extension, size, page/image constraints, and malware; set safe download headers and retention/deletion behavior.
3. Restrict GitLab hosts to an approved HTTPS allowlist or build robust SSRF controls with DNS/IP validation and egress restrictions.
4. Store OAuth state in a shared TTL store for multi-instance reliability; bind it to the initiating session and use PKCE where supported.
5. Minimize GitHub/GitLab OAuth scopes and document token rotation/revocation procedures.

## P2 — Defense in depth and assurance (weeks 2–3)

1. Introduce centralized tenant-aware repository/service functions and prohibit unscoped access to tenant-owned models through code review and Semgrep rules.
2. Evaluate PostgreSQL row-level security as a second isolation layer; use a non-owner runtime role and separate migration role.
3. Expand immutable audit logging to all privileged, financial, integration, file-access, and identity events. Add request IDs and security alerts.
4. Add CSP, Permissions-Policy, Referrer-Policy validation, and automated header tests at both Next.js and reverse proxy layers.
5. Add CI gates for Semgrep, dependency audit/OSV, Gitleaks, Trivy, and Checkov where IaC appears. Pin GitHub Actions by commit SHA.
6. Add authorization matrix tests, property-based validation tests, file-upload tests, and non-destructive ZAP baseline scans in staging.

## P3 — SaaS governance and resilience (weeks 3–6)

1. Define and enforce plan entitlements server-side before introducing billing. Build idempotent, signed, replay-resistant webhook handling when a payment provider is selected.
2. Establish database encryption, backup encryption, restore testing, retention, deletion/export, and key-rotation procedures.
3. Document incident response, tenant breach notification, audit retention, access review, dependency patch SLAs, and disaster recovery objectives.
4. Add security ownership, threat modeling, release sign-off, and quarterly tenant-isolation regression exercises.

## Verification strategy

- Build a two-tenant fixture with one actor per role and distinct projects, users, tickets, expenses, income records, files, and integrations.
- For every object endpoint, test own tenant/allowed role, own tenant/disallowed role, foreign tenant/same role, unauthenticated access, stale token, disabled user, and disabled organization.
- Assert both response and side effects: database state, audit event, integration job, external call mock, and file access.
- Do not close a remediation item based solely on a UI restriction; authorization must be enforced in backend queries and transactions.
