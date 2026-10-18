import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Stride Documentation — Product & Administration Guide",
  description: "End-to-end guidance for using, configuring, and operating Stride.",
};

const navigation = [
  ["start", "Start here"], ["access", "Roles & access"], ["dashboard", "Dashboard"],
  ["work", "Projects & tickets"], ["people", "People & attendance"], ["finance", "Finance"],
  ["developer", "Developer tools"], ["governance", "Audit & recovery"],
  ["configuration", "Configuration"], ["admin", "SaaS administration"],
  ["technical", "Technical reference"], ["help", "Troubleshooting"],
];

const modules = [
  {
    title: "Dashboard", route: "/dashboard", audience: "All roles",
    summary: "A role-aware operating overview. Leadership sees portfolio, delivery, people, and financial indicators; finance sees income, spend, and approvals; managers see team delivery; employees see their assigned work and expenses.",
    actions: ["Open metric cards to move directly to their source module", "Review project progress and ticket-resolution charts", "Act on pending expense approvals where your role permits", "Use recent-ticket and recent-expense lists as work queues"],
  },
  {
    title: "Tickets", route: "/tickets and /board", audience: "All roles; write access is permission-scoped",
    summary: "Create and deliver bugs, features, tasks, and improvements in list or Kanban form.",
    actions: ["Search, filter, group, sort, and paginate tickets", "Set OPEN, IN_PROGRESS, IN_REVIEW, or CLOSED status", "Set LOW, MEDIUM, HIGH, or CRITICAL priority", "Assign people, due dates, estimates, parent tickets, links, and comments", "Bulk-change status, priority, or assignment", "Log time and review the ticket activity history", "Soft-delete a ticket and restore it when authorized", "Drag cards between columns on the board"],
  },
  {
    title: "Projects", route: "/projects", audience: "All roles; Founder and Manager administer",
    summary: "Keep initiatives, membership, delivery health, repositories, and related work together.",
    actions: ["Create projects and set PLANNING, ACTIVE, ON_HOLD, COMPLETED, or CANCELLED status", "Define dates, description, and project members with project-specific roles", "Open a project-scoped board and ticket list", "Review ticket statistics and activity", "Link GitHub or GitLab repositories", "Synchronize a repository and inspect member access grants", "Retry failed access grants or unlink a repository"],
  },
  {
    title: "Timesheets", route: "/timesheets", audience: "All roles",
    summary: "A weekly view of time logged against tickets and projects.",
    actions: ["Move between weeks or return to the current week", "Log additional time against eligible work", "Review daily and weekly totals", "Filter the visible employee or project where access allows", "Use summaries to compare tracked effort across the selected period"],
  },
  {
    title: "Employees", route: "/employees", audience: "All can view; Founder, CPO, HR, and Manager can add",
    summary: "The organization directory and each employee’s operational profile.",
    actions: ["Search by name or email; filter by department, role, and status", "Add an employee with an initial role and reporting context", "Open a profile to view projects, direct reports, and recent tickets", "Update role, department, manager, and active status when permitted", "Deactivate an employee without erasing historical records", "Connect or disconnect the employee’s GitHub/GitLab identity"],
  },
  {
    title: "Organization chart", route: "/org", audience: "All can view; configured roles can edit",
    summary: "A visual reporting hierarchy based on employee-manager relationships.",
    actions: ["Expand the hierarchy and inspect reporting relationships", "Add a direct report from a manager node", "Reassign an employee to another manager", "Use company settings to choose which roles may change reporting lines"],
  },
  {
    title: "Attendance", route: "/attendance", audience: "All roles; team visibility is permission-scoped",
    summary: "Daily presence, check-in/out, leave, and attendance history governed by company policy.",
    actions: ["Check in and check out", "Record leave", "Review today’s status and personal statistics", "Review team presence if your role has permission", "Fill unrecorded absences through the supported workflow", "Apply workday thresholds, WFH, and location requirements configured by administrators"],
  },
  {
    title: "Expenses", route: "/expenses", audience: "All submit; approvals depend on role",
    summary: "Expense submission with proof files, two-level approvals, and payment tracking.",
    actions: ["Create or edit an expense in TRAVEL, MEALS, EQUIPMENT, SOFTWARE, TRAINING, OFFICE, or OTHER", "Attach a protected invoice or receipt", "Move records through DRAFT, SUBMITTED, L1_APPROVED, APPROVED, REJECTED, and PAID states", "Managers perform eligible first-level approval", "Founder/CFO perform finance approval and mark payment", "Revoke a payment, finance approval, or L1 approval with a recorded reason", "Review pending approvals and financial summaries where authorized"],
  },
  {
    title: "Income", route: "/income", audience: "Visibility and write actions are role-scoped",
    summary: "Record incoming revenue with source details, status, date, notes, and supporting proof.",
    actions: ["Create, search, filter, and inspect income records", "Edit title, amount, category, status, date, and notes", "Replace or open a protected proof document", "Review period totals and category summaries", "Delete an income record as Founder; the action is audit logged"],
  },
  {
    title: "Global search", route: "⌘/Ctrl + K", audience: "All roles",
    summary: "Fast keyboard access to records the signed-in user is allowed to see.",
    actions: ["Press Command K on macOS or Control K elsewhere", "Search across supported workspace entities", "Select a result to open its detail page", "Close the palette with Escape"],
  },
];

const roleRows = [
  ["Founder", "Full organization administration, projects, people, finance, settings, audit, and destructive business actions."],
  ["CPO", "People/organization administration, company settings, delivery visibility, and audit access."],
  ["CFO", "Finance administration, company settings, final expense approval/payment, and audit access."],
  ["HR", "Employee administration, organization operations, and selected company settings."],
  ["Manager", "Team and project administration, employee onboarding, delivery management, and L1 expense approval."],
  ["Team Lead", "Delivery coordination and team work visibility within server-enforced scope."],
  ["Employee", "Personal work, attendance, time, expenses, and permitted organization views."],
  ["Super Admin", "Platform-level organization onboarding, plan/status management, and tenant statistics; additive to an organization role."],
];

export default function DocumentationPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}><span>S</span>Str<strong>ide</strong></Link>
        <nav aria-label="Documentation actions"><Link href="/">Home</Link><Link href="/pricing">Pricing</Link><Link href="/login" className={styles.signIn}>Open workspace</Link></nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>STRIDE DOCUMENTATION</p>
          <h1>Run your workspace<br /><em>with confidence.</em></h1>
          <p className={styles.lead}>The complete guide to Stride’s projects, people, time, finance, developer integrations, permissions, audit history, and administration.</p>
          <div className={styles.heroActions}><a href="#start">Start learning <span>↓</span></a><Link href="/login">Go to sign in <span>→</span></Link></div>
          <div className={styles.scope}><span>15 functional areas</span><span>7 organization roles</span><span>GitHub & GitLab</span><span>Multi-tenant SaaS</span></div>
        </div>
      </section>

      <div className={styles.docsLayout}>
        <aside className={styles.sidebar} aria-label="On this page">
          <p>ON THIS PAGE</p>
          {navigation.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
        </aside>

        <article className={styles.content}>
          <section id="start" className={styles.section}>
            <span className={styles.number}>01</span><h2>Start here</h2>
            <p>Stride is a multi-tenant business operations platform. Each organization is an isolated workspace, and the signed-in user’s role determines which records and actions are available.</p>
            <div className={styles.steps}>
              <div><b>1</b><h3>Sign in</h3><p>Use the organization account created by your administrator. If needed, select “Forgot password” and use the time-limited reset link.</p></div>
              <div><b>2</b><h3>Orient yourself</h3><p>Begin on Dashboard, use the left navigation for modules, and press ⌘/Ctrl + K for workspace search.</p></div>
              <div><b>3</b><h3>Configure first</h3><p>Organization administrators should confirm company, attendance, role, and integration settings before onboarding the full team.</p></div>
            </div>
            <div className={styles.callout}><strong>Important</strong><p>Controls shown in the interface are convenience cues; the API also enforces authentication, tenant boundaries, and role checks. If an expected action is missing, confirm your role and organization policy.</p></div>
          </section>

          <section id="access" className={styles.section}>
            <span className={styles.number}>02</span><h2>Roles and access</h2>
            <p>Organization roles are intentionally cumulative by responsibility, but permissions are action-specific. “Can view” never automatically means “can edit.”</p>
            <div className={styles.tableWrap}><table className={styles.docTable}><thead><tr><th>Role</th><th>Primary responsibility</th></tr></thead><tbody>{roleRows.map(([role, detail]) => <tr key={role}><td><strong>{role}</strong></td><td>{detail}</td></tr>)}</tbody></table></div>
            <p className={styles.note}>Custom labels, colors, active roles, org-chart editors, and attendance viewers are configurable. The canonical role keys remain unchanged for authorization.</p>
          </section>

          <section id="dashboard" className={styles.section}>
            <span className={styles.number}>03</span><h2>Dashboard and navigation</h2>
            <p>The Dashboard changes by role so each user sees the most useful indicators. Use the sidebar collapse control, mobile menu, light/dark theme switch, profile menu, and keyboard search in the header.</p>
            <ul className={styles.checkList}><li>Founder view: company-wide people, portfolio, ticket, income, expense, net, and approval indicators.</li><li>CFO view: monthly/yearly financial totals, pending L2 approvals, and spend by category.</li><li>Manager view: team size, project health, open tickets, team expenses, and L1 approvals.</li><li>Employee view: assigned tickets, projects, recent expenses, and personal project progress.</li></ul>
          </section>

          <section id="work" className={styles.section}>
            <span className={styles.number}>04</span><h2>Projects, tickets, and time</h2>
            {modules.slice(1, 4).map((module) => <ModuleCard key={module.title} {...module} />)}
          </section>

          <section id="people" className={styles.section}>
            <span className={styles.number}>05</span><h2>People and attendance</h2>
            {modules.slice(4, 7).map((module) => <ModuleCard key={module.title} {...module} />)}
          </section>

          <section id="finance" className={styles.section}>
            <span className={styles.number}>06</span><h2>Finance operations</h2>
            {modules.slice(7, 9).map((module) => <ModuleCard key={module.title} {...module} />)}
            <div className={styles.flow}><span>Draft</span><i>→</i><span>Submitted</span><i>→</i><span>L1 approved</span><i>→</i><span>Approved</span><i>→</i><span>Paid</span></div>
          </section>

          <section id="developer" className={styles.section}>
            <span className={styles.number}>07</span><h2>Developer tools and integrations</h2>
            <h3>Developer workspace <code>/scm</code></h3>
            <p>Track GitHub or GitLab repositories and review open pull requests, commits, pipeline health, recent activity, contributor analytics, branches, and repository members. Authorized users can register/remove webhooks, grant/revoke repository access, and untrack repositories.</p>
            <h3>Connections <code>/connections</code></h3>
            <p>Organization administrators first configure an OAuth app, then connect an account. GitHub and GitLab are operational; Slack, Microsoft Teams, Google Workspace, and Notion are displayed as coming soon and must not be treated as active integrations.</p>
            <h3>Project-management connections</h3>
            <p>The API supports connection records, external project discovery, and issue retrieval. Availability in the interface depends on the configured provider and connection.</p>
            <div className={styles.callout}><strong>Setup order</strong><p>Configure OAuth credentials → connect provider account → track repositories → register webhooks if desired → link repositories to projects → connect employee identities for access automation.</p></div>
          </section>

          <section id="governance" className={styles.section}>
            <span className={styles.number}>08</span><h2>Audit history and reversible actions</h2>
            <p>The Audit Log is available to Founder, CPO, and CFO roles. It records actor, action, affected resource, source, timestamp, and safe change metadata for supported organization activity.</p>
            <ul className={styles.checkList}><li>Open an event to understand what changed and who initiated it.</li><li>Request a reversal preview before committing a rollback.</li><li>Supply a reversal reason; a successful reversal creates another audit event rather than deleting history.</li><li>Expense payment and approval revocations are explicit workflows and preserve the decision trail.</li><li>Ticket deletion is soft-delete and has a dedicated restore action.</li></ul>
            <div className={`${styles.callout} ${styles.warning}`}><strong>Reversal boundaries</strong><p>Not every event is safely reversible. The preview endpoint determines support and detects invalid or stale state. External side effects—such as provider changes—may require manual correction even when the local record is restored.</p></div>
          </section>

          <section id="configuration" className={styles.section}>
            <span className={styles.number}>09</span><h2>Company configuration</h2>
            <div className={styles.optionGrid}>
              <div><h3>General</h3><p>Company name, logo URL, and organization timezone.</p></div>
              <div><h3>Attendance</h3><p>Half/full-day minute thresholds, workday start/end, WFH allowance, and check-in location requirement.</p></div>
              <div><h3>Roles</h3><p>Active role set, display labels, colors, org-chart editors, and roles allowed to view all attendance.</p></div>
              <div><h3>Integrations</h3><p>GitHub client ID/secret/callback; GitLab application ID/secret/host/redirect URI; account connection and revocation.</p></div>
            </div>
            <p className={styles.note}>Only organization administrators (Founder, CPO, CFO, HR in the current interface) can open Company Settings. Secrets are write-only: leaving a secret blank preserves the configured value.</p>
          </section>

          <section id="admin" className={styles.section}>
            <span className={styles.number}>10</span><h2>SaaS administration</h2>
            <p>Super Admin is a platform-level capability. The Admin Console shows organization and plan statistics, creates organizations with an initial administrator, and updates company name, plan, and active state.</p>
            <ul className={styles.checkList}><li>Onboard company: name, unique slug, plan, initial admin name/email, and temporary password.</li><li>Manage lifecycle: activate/deactivate an organization without deleting tenant data.</li><li>Manage plan assignment: FREE, STARTER, GROWTH, or ENTERPRISE. Plan assignment does not by itself prove feature limits are enforced.</li><li>Keep platform administration separate from ordinary organization operations.</li></ul>
          </section>

          <section id="technical" className={styles.section}>
            <span className={styles.number}>11</span><h2>Technical reference</h2>
            <div className={styles.architecture}><div><small>WEB</small><strong>Next.js 16 + React 19</strong><span>Ant Design, TanStack Query, Zustand</span></div><b>→</b><div><small>API</small><strong>Express 5 + TypeScript</strong><span>JWT cookie, CSRF, RBAC, validation</span></div><b>→</b><div><small>DATA</small><strong>PostgreSQL + Prisma 7</strong><span>Tenant-owned relational records</span></div></div>
            <h3>Local development</h3>
            <pre className={styles.codeBlock}><code>{`# backend\ncd backend && cp .env.example .env\nnpm install && npx prisma migrate deploy\nnpm run dev\n\n# frontend (new terminal)\ncd frontend && cp .env.example .env.local\nnpm install && npm run dev`}</code></pre>
            <p>The frontend defaults to <code>http://localhost:3000</code>, backend to <code>http://localhost:4000</code>, API base to <code>/api/v1</code>, and health endpoint to <code>GET /health</code>.</p>
            <h3>Required environment configuration</h3>
            <div className={styles.tableWrap}><table className={styles.docTable}><thead><tr><th>Area</th><th>Variables</th><th>Purpose</th></tr></thead><tbody><tr><td>Database</td><td><code>DATABASE_URL</code></td><td>PostgreSQL connection</td></tr><tr><td>Authentication</td><td><code>JWT_SECRET</code>, <code>JWT_EXPIRES_IN</code>, issuer, audience</td><td>Signed session token policy</td></tr><tr><td>Encryption</td><td><code>ENCRYPTION_KEY</code></td><td>Protect stored integration credentials</td></tr><tr><td>Web/API</td><td><code>FRONTEND_URL</code>, <code>NEXT_PUBLIC_API_URL</code>, <code>PORT</code></td><td>CORS and service routing</td></tr><tr><td>Operations</td><td><code>NODE_ENV</code>, optional proxy/upload/SCM host controls</td><td>Production behavior and boundaries</td></tr></tbody></table></div>
            <p>Never commit real secret values. Use <code>backend/.env.example</code> and <code>frontend/.env.example</code> as the current variable inventory.</p>
          </section>

          <section id="help" className={styles.section}>
            <span className={styles.number}>12</span><h2>Troubleshooting and safe operation</h2>
            <div className={styles.faq}>
              <details><summary>I cannot see an action or module.</summary><p>Confirm that you are signed into the correct organization and that your role is authorized. For attendance and org-chart actions, also check configurable role permissions.</p></details>
              <details><summary>A repository or provider action failed.</summary><p>Verify OAuth configuration, reconnect the provider account, confirm the repository is tracked, and inspect webhook/access status. Use Retry only for an existing failed repository access grant.</p></details>
              <details><summary>A file does not open.</summary><p>Protected proofs require an active authenticated session and access to the owning tenant record. Re-sign in, verify record access, and check that persistent upload storage is mounted.</p></details>
              <details><summary>Can I undo a change?</summary><p>Open Audit Log and use reversal preview. If the event is unsupported, use the module’s explicit revoke/restore workflow or make a compensating edit; do not alter audit records.</p></details>
              <details><summary>The API is unavailable.</summary><p>Check <code>GET /health</code>, database connectivity, backend environment validation, migrations, and that the frontend API URL points to the running service.</p></details>
            </div>
            <div className={styles.more}><h3>Repository documentation</h3><p>Operators and engineers can continue with the end-to-end Markdown guide, security audit, remediation plan, checklist, and security tool commands in the repository’s <code>docs/</code> directory.</p></div>
          </section>
        </article>
      </div>

      <footer className={styles.footer}><div><Link href="/" className={styles.brand}><span>S</span>Str<strong>ide</strong></Link><p>One connected operating system for your team.</p></div><div><a href="#start">Back to top ↑</a><Link href="/login">Open workspace →</Link></div></footer>
    </main>
  );
}

function ModuleCard({ title, route, audience, summary, actions }: (typeof modules)[number]) {
  return <section className={styles.moduleCard}><div className={styles.moduleHead}><div><h3>{title}</h3><code>{route}</code></div><span>{audience}</span></div><p>{summary}</p><h4>What you can do</h4><ul>{actions.map((action) => <li key={action}>{action}</li>)}</ul></section>;
}
