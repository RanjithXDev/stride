# Security Testing Tools and Commands

These commands are tailored to this TypeScript/Next.js/Express/Prisma repository. Run from the workspace root unless specified. Review output before enabling CI blocking. The commands below are non-destructive; OWASP ZAP should target an authorized local or staging instance only.

## Baseline prerequisites

- Node.js 20+, npm, Docker (for containerized scanners), and Git.
- Install project dependencies with `npm ci` in both `backend/` and `frontend/`.
- Never pass production credentials to scanners. Use a disposable database and test accounts.

## npm audit — Node dependency advisories

```bash
npm --prefix backend audit --omit=dev
npm --prefix frontend audit --omit=dev
npm --prefix backend audit
npm --prefix frontend audit
```

Expected output: advisory count by severity, affected dependency paths, and available fixes. Treat results as unverified until the vulnerable code path and deployed version are confirmed. `npm audit fix --force` is intentionally not recommended because it mutates dependencies and may introduce breaking changes.

## OSV-Scanner — lockfile vulnerability scan

Prerequisite: install OSV-Scanner from its official release/package instructions, or use its official container.

```bash
osv-scanner scan source -r backend
osv-scanner scan source -r frontend
```

Expected output: package, installed version, advisory/OSV ID, fixed version, and dependency location. Export SARIF in CI if supported by the installed version.

## Semgrep — TypeScript/JavaScript SAST

Prerequisite: `python3 -m pip install semgrep` or the official Semgrep container.

```bash
semgrep scan --config p/typescript --config p/nodejs --config p/expressjs --config p/owasp-top-ten backend/src frontend
semgrep scan --config auto backend/src frontend
```

Expected output: source-level findings with rule IDs and file/line evidence. Add project rules that flag tenant-owned Prisma calls lacking `organizationId`, role/organization fields copied from `req.body`, and public file-serving routes.

## Gitleaks — current tree and Git history

Prerequisite: install Gitleaks or use `zricethezav/gitleaks` official image.

```bash
gitleaks dir . --redact --no-banner
gitleaks git frontend --redact --no-banner
```

Expected output: secret type, redacted location, commit (for history mode), and fingerprint. The workspace root/backend has no detected Git metadata in this checkout, so history coverage is limited to `frontend/`. Do not paste discovered secret values into tickets or reports; revoke and rotate first.

## Trivy — filesystem, secret, and misconfiguration scan

Prerequisite: install Trivy or use the official Aqua Security image.

```bash
trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --ignore-unfixed .
trivy fs --scanners vuln --format sarif --output trivy.sarif .
```

Expected output: dependency vulnerabilities, secret candidates, and supported configuration findings. No Dockerfile is present, so image scanning becomes applicable only after a container image exists.

## Checkov — IaC and workflow review

Prerequisite: `python3 -m pip install checkov` or the official Bridgecrew container.

```bash
checkov -d . --framework github_actions --compact
```

Expected output: passed/failed policy IDs for GitHub Actions. Terraform/Kubernetes/Docker checks are currently not applicable because those files were not found; extend the framework list when IaC is added.

## Prisma and TypeScript safety checks

```bash
npm --prefix backend run db:generate
npx --prefix backend prisma validate
npm --prefix backend run build
npx --prefix frontend tsc --noEmit
```

Expected output: schema validation and clean compilation. These are correctness checks, not vulnerability scans.

## OWASP ZAP baseline — authorized DAST only

Prerequisites: run the application locally with disposable data, create dedicated test users for each role/tenant, and install Docker. The passive baseline does not authenticate API routes by itself.

```bash
docker run --rm --network host -v "$PWD/docs/security:/zap/wrk/:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:3000 -r zap-frontend.html
```

For the API, first export an OpenAPI document; none is currently present. Then use `zap-api-scan.py` against the local/staging API specification. Expected output: passive header/cookie/content findings and crawler coverage. Do not use active scan mode against production without explicit written authorization.

## Safe manual authorization suite

Use an integration-test runner such as Vitest/Supertest against a disposable database. Create tenant A and tenant B fixtures and exercise every ID-bearing route with same-role foreign-tenant tokens. Expected output is 404/403 and zero database/external side effects. Highest-priority targets:

```text
GET/PUT/DELETE /api/v1/employees/:id
POST           /api/v1/auth/register
GET            /api/v1/projects/:id
POST/DELETE    /api/v1/projects/:id/members
GET            /api/v1/projects/:id/stats
GET/PUT/POST   /api/v1/expenses/:id/*
GET/PUT/DELETE /api/v1/incomes/:id
GET            /api/v1/dashboard
GET            /uploads/:file
```

## Suggested CI order

1. Secret scan.
2. Lockfile integrity via `npm ci`.
3. Typecheck, tests, and Prisma validation.
4. Semgrep and custom tenant-scope rules.
5. npm audit/OSV and Trivy filesystem scan.
6. Build artifacts.
7. ZAP baseline against an ephemeral deployed test environment.

Store SARIF/HTML reports as access-controlled artifacts with short retention; scanner output can contain internal paths and metadata.
