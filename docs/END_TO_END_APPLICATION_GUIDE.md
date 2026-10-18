# Stride — End-to-End Application Guide

**Audience:** Users, organization administrators, SaaS operators, developers, QA, support, and security teams  
**Public guide:** `/docs`

## 1. Product overview

Stride is a multi-tenant SaaS business-operations platform. It connects projects, tickets, employees, reporting lines, attendance, timesheets, expenses, income, source-control activity, integrations, and audit history inside an isolated organization workspace.

The interface adapts to the signed-in user, but the API remains the security boundary: authentication establishes user and tenant context, and server-side authorization controls records and actions.

| Layer | Implementation |
|---|---|
| Web | Next.js 16 App Router, React 19, TypeScript |
| UI/state | Ant Design 6, TanStack Query 5, Zustand 5, Day.js |
| API | Node.js, Express 5, TypeScript |
| Data | PostgreSQL 16, Prisma ORM 7 |
| Authentication | Short-lived JWT in HttpOnly cookie with CSRF protection |
| Integrations | GitHub, GitLab, project-management connection services |

## 2. Start here

1. Sign in at `/login` with an organization account.
2. Use **Forgot password** for a time-limited reset flow. Its response does not reveal whether an account exists.
3. Begin at **Dashboard**, which is tailored to the user’s role.
4. Use the sidebar for modules, the mobile drawer on small screens, and **Command/Control + K** for global search.
5. Use the theme button for light/dark mode and the profile menu to sign out.

Administrators should configure company details, attendance rules, active roles, and integrations before onboarding the full team.

## 3. Roles and access

| Role | Primary responsibility |
|---|---|
| `FOUNDER` | Full organization administration, projects, people, finance, settings, audit, and sensitive actions |
| `CPO` | People leadership, organization administration, settings, delivery visibility, and audit |
| `CFO` | Finance administration, final expense approval/payment, settings, and audit |
| `HR` | Employee administration, reporting structure, and selected settings |
| `MANAGER` | Team/project administration, onboarding, delivery, and L1 expense approval |
| `TEAM_LEAD` | Team delivery coordination within authorized scope |
| `EMPLOYEE` | Personal work, attendance, time, expenses, and permitted organization views |
| Super Admin | Cross-tenant SaaS administration; additive to the organization role |

Visibility does not imply edit authority. Canonical role keys remain fixed even when administrators customize labels and colors. Attendance-wide visibility and org-chart editors are separately configurable.

## 4. Dashboard

**Route:** `/dashboard` — all authenticated users.

- Founder sees company-wide people, portfolio, ticket, income, expense, net, and approval indicators.
- CFO sees monthly/yearly financial totals, pending L2 approvals, and spend by category.
- Manager sees team size, projects, open tickets, team expenses, and L1 approvals.
- Employees see personal tickets, projects, expenses, and project progress.

Metric cards link to their source modules. Use source modules for editing and complete detail.

## 5. Tickets and boards

**Routes:** `/tickets`, `/tickets/:id`, `/board`, `/projects/:id/board`

| Field | Options |
|---|---|
| Type | `BUG`, `FEATURE`, `TASK`, `IMPROVEMENT` |
| Priority | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Status | `OPEN`, `IN_PROGRESS`, `IN_REVIEW`, `CLOSED` |
| Links | `RELATES_TO`, `BLOCKS`, `BLOCKED_BY`, `DUPLICATES` |

Users can search, filter, group, sort, paginate, and bulk-change authorized tickets. Ticket detail supports title/description, project, assignment, dates, estimate, parent, comments, links, time logs, and activity history. The board changes status by moving cards between columns and can filter by project or assignee.

Deletion is soft-delete. Authorized users can restore a deleted ticket. History remains available; restoring does not erase the delete event.

## 6. Projects

**Routes:** `/projects`, `/projects/:id`, `/projects/:id/board`

Statuses are `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, and `CANCELLED`.

- Create/edit project name, description, dates, and status.
- Review delivery statistics, tickets, timeline, and activity.
- Add/remove members and give each a project-specific role label.
- Open the project ticket list and project board.
- Link tracked GitHub/GitLab repositories, synchronize them, and inspect access grants.
- Retry failed access grants or unlink repositories.
- Founder can delete projects; Founder and Manager administer ordinary project state.

## 7. Timesheets

**Route:** `/timesheets`

Navigate by week, return to today, review daily/weekly totals, log time against eligible tickets, and switch employee/project context where permitted. Timesheets represent application work logs; they are not automatically payroll records.

## 8. Employees and organization

### Employees — `/employees`, `/employees/:id`

- Search name/email and filter department, role, or active state.
- Founder, CPO, HR, and Manager can add employees under current route policy.
- Profiles show department, manager, projects, direct reports, and recent tickets.
- Authorized users can update role, department, manager, and active status.
- Deactivation preserves historical data but removes access; users cannot deactivate themselves through the list action.
- Employees can connect/disconnect GitHub and GitLab identities.
- Founder can create departments.

### Organization chart — `/org`

The chart visualizes employee-manager relationships. Configured editor roles can add direct reports and reassign managers. Reassignment changes the reporting line, not the employee’s canonical organization role.

## 9. Attendance

**Route:** `/attendance`

Users can check in, check out, mark leave, view today/history/statistics, and fill supported absences. Team-wide visibility follows role configuration.

Administrators define half-day/full-day minute thresholds, workday start/end, WFH allowance, check-in location requirement, and roles allowed to see all attendance. A background worker performs scheduled attendance maintenance, so the API process must remain running.

## 10. Expenses

**Routes:** `/expenses`, `/expenses/:id`

Categories: `TRAVEL`, `MEALS`, `EQUIPMENT`, `SOFTWARE`, `TRAINING`, `OFFICE`, `OTHER`.  
States: `DRAFT`, `SUBMITTED`, `L1_APPROVED`, `APPROVED`, `REJECTED`, `PAID`.

Typical flow:

1. Employee creates an expense and optional proof.
2. The expense is submitted.
3. An eligible manager performs L1 approval.
4. Founder/CFO performs final approval.
5. Founder/CFO marks it paid.

Payment, final approval, and L1 approval have explicit revocation workflows. These preserve the decision trail. Proof files use validated uploads and authenticated delivery instead of a public uploads folder.

## 11. Income

**Routes:** `/income`, `/income/:id`

Create, search, filter, summarize, inspect, and edit income records with title, amount, category, status, date, notes, and proof. Proof uses authenticated file delivery. Founder can delete a record; deletion is audit logged, and business restoration may require an intentional compensating record.

## 12. Developer workspace

**Routes:** `/scm`, `/scm/repos/:id`

| Tab | Functions |
|---|---|
| Overview | Open PRs, pipeline health, commits, repositories, contributors, recent activity |
| Repositories | Track/untrack repositories and manage webhook state |
| Pull Requests | Review repository, author, branch, status, age, and external link |
| Pipelines | Passing, failing, running, and total pipeline activity |
| Activity | Synchronized commits, PRs, pipelines, and provider events |
| Analytics | Commit/PR totals, open PRs, average age, contributors, per-repo breakdown |

Repository detail includes branches, activity, members, and access management. Authorized users can grant/revoke repository access. GitHub/GitLab webhook ingress verifies provider signatures using the raw request body.

## 13. Connections and integrations

**Routes:** `/connections`, `/settings` Integrations tab

Implemented: GitHub OAuth, GitLab OAuth (including allowed self-managed hosts), organization provider connections, user identities, and project-management connection APIs. Slack, Microsoft Teams, Google Workspace, and Notion are displayed as **Coming Soon**, not active features.

Setup order:

1. Configure OAuth client ID, secret, and exact callback/redirect URI.
2. Connect the organization provider account.
3. Track repositories.
4. Register webhooks when near-real-time sync is needed.
5. Link repositories to projects.
6. Connect employee identities for access mapping.

Leaving an existing secret blank preserves it. Clearing provider configuration removes dependent connections and is a consequential administrative action.

## 14. Company settings

**Route:** `/settings` — shown to Founder, CPO, CFO, and HR.

| Tab | Options |
|---|---|
| General | Company name, logo URL, timezone |
| Attendance | Day thresholds, workday hours, WFH, location requirement |
| Roles | Active roles, display labels/colors, org-chart editors, attendance viewers |
| Integrations | GitHub/GitLab OAuth configuration and connected accounts |

Settings apply only to the current organization. Test permission changes with a non-admin account before broad rollout.

## 15. Audit log and reversibility

**Route:** `/audit-log` — Founder, CPO, CFO.

Entries record actor, action, resource, source, timestamp, and safe metadata. To reverse a supported event:

1. Locate it and request **reversal preview**.
2. Confirm the current state is compatible.
3. Enter a reason and submit.
4. Verify the record and the new reversal audit event.

Reversal never deletes the original history. Not all events are safely reversible. Later conflicting edits and external side effects may require manual correction. Prefer module-native restore/revoke workflows where available.

## 16. Super Admin console

**Route:** `/admin` — Super Admin only.

View tenant/plan statistics, create an organization with its first administrator, update company name/plan/status, and deactivate/reactivate tenants without deleting their records. Plan values are `FREE`, `STARTER`, `GROWTH`, and `ENTERPRISE`. Plan storage does not by itself prove that every commercial limit is enforced. Public plan information is available at `/pricing`; price amounts and tier-specific limits are not configured in the application.

## 17. API map

All main APIs use `/api/v1`.

| Prefix | Responsibility |
|---|---|
| `/auth` | Login/logout/current user/Founder registration/password reset |
| `/dashboard` | Role-aware summaries |
| `/tickets` | Tickets, bulk updates, restore, comments, time, links, audit |
| `/projects` | Projects, membership, stats, repositories, Git activity |
| `/employees` | Directory, profiles, departments, organization tree |
| `/attendance`, `/timesheets` | Presence and work-time records |
| `/expenses`, `/incomes` | Finance records, approvals, payment, summaries |
| `/scm` | Repositories, webhooks, activity, PRs, pipelines, analytics, access |
| `/integrations`, `/pm` | OAuth/provider and project-management connections |
| `/org` | Organization settings and Super Admin tenant lifecycle |
| `/audit-events` | Audit list, reversal preview, reversal |
| `/search`, `/files` | Tenant search and protected file delivery |

`GET /health` returns API service status and timestamp.

## 18. Security behavior

- Login and API requests are rate limited; uploads have additional limits.
- The JWT is in an HttpOnly cookie, and state-changing authenticated requests use CSRF protection.
- JWT issuer, audience, expiry, and secret configuration are validated.
- Passwords are hashed; CORS is limited to the configured frontend; Helmet supplies headers.
- Upload type/size is validated and files require authenticated tenant/record access.
- Integration credentials are encrypted at rest; webhooks verify signatures.
- Controlled API errors avoid returning raw internals.

See `docs/security/` for evidence, residual deployment controls, and scan commands.

## 19. Local development

Prerequisites: Node.js 20+, npm, and PostgreSQL 16+.

```bash
# backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev

# frontend (another terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`. The UI starts at `http://localhost:3000`; API at `http://localhost:4000`.

Only seed a disposable local database:

```bash
ALLOW_INSECURE_DEMO_SEED=true npx prisma db seed
```

Never enable the demo seed in production or against valuable data.

## 20. Environment and deployment

Use `.env.example` files as the variable inventory. Main categories are database URL; JWT secret/expiry/issuer/audience; encryption key; frontend/API origins; port/runtime/proxy settings; upload storage; and SCM host/webhook configuration.

Production requirements:

1. Keep secrets in a managed secret store and enable TLS.
2. Set production runtime values and narrow proxy trust.
3. Run `npx prisma migrate deploy` before the new API version.
4. Use durable private upload storage and encrypted, tested database backups.
5. Centralize monitored application/audit logs.
6. Use a shared rate-limit store for multiple API replicas.
7. Run CI and security scans before release.

## 21. Tests

```bash
cd backend && npm test && npm run test:coverage && npm run build
cd ../frontend && npm test && npm run test:coverage && npm run lint
cd ../frontend && npx tsc --noEmit && npm run build
```

A passing test count is not proof of complete coverage. Review reports and test tenant isolation, authorization, state transitions, reversal conflicts, uploads, and integration failures.

## 22. Troubleshooting

| Symptom | Check |
|---|---|
| Cannot sign in | API health, API URL, user/tenant active state, CORS/cookies, rate limit |
| Missing action | Role, configurable policy, record ownership, tenant scope |
| Empty dashboard | Source records, organization, date period, role-specific query |
| Upload fails | Type/size, rate limit, storage permissions/persistence |
| File will not open | Session, tenant/record authorization, storage object exists |
| OAuth fails | Credentials, exact callback URL, public origins, allowed host policy |
| Repository stale | Connection, tracked state, webhook/signature, worker logs |
| Access grant fails | Employee identity, provider scopes, repository permission; then retry |
| Reversal unavailable | Event support, later changes, authorization, external side effects |
| Database startup error | URL, PostgreSQL health, migrations, generated Prisma client |

## 23. Documentation maintenance

For every feature change, update this guide and `/docs`, state exact roles/fields/statuses, describe destructive and reversible behavior, mark incomplete integrations honestly, update route/environment references, add tests, and refresh security documentation when a trust boundary changes.
