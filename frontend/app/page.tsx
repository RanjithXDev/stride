import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Stride — One operating system for your team",
  description: "Bring people, projects, attendance, time, and expenses into one connected workspace.",
};

const capabilities = [
  { icon: "◇", title: "Projects that stay on course", text: "Plan work, assign ownership, and move every ticket from idea to done without losing context.", tone: "blue" },
  { icon: "◎", title: "People, clearly organised", text: "Build your reporting structure, manage departments, and keep responsibilities visible as your team grows.", tone: "violet" },
  { icon: "◷", title: "Time without the busywork", text: "Connect attendance and timesheets to real project work for a clearer picture of where effort goes.", tone: "mint" },
  { icon: "₹", title: "Expenses with accountability", text: "Submit proof, route approvals, and give finance a clean view of every decision and payment.", tone: "amber" },
];

const workflow = [
  { number: "01", title: "Create your workspace", text: "Set up the company, departments, roles, and working policies that match the way you operate." },
  { number: "02", title: "Bring your team in", text: "Add people, connect reporting lines, and give each role exactly the access it needs." },
  { number: "03", title: "Run work in one place", text: "Projects, tickets, attendance, time, and expenses become one connected operating rhythm." },
];

const pricingPlans = [
  { name: "FREE", title: "Start with Stride", detail: "Explore the core workspace." },
  { name: "STARTER", title: "Organize your team", detail: "Bring everyday operations together." },
  { name: "GROWTH", title: "Scale your operations", detail: "Coordinate teams, projects, and workflows." },
  { name: "ENTERPRISE", title: "Fit your organization", detail: "Discuss an organization-wide setup." },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand} aria-label="Stride home">
            <span className={styles.brandMark}>S</span>
            <span>Str<span className={styles.brandAccent}>ide</span></span>
          </Link>

          <div className={styles.navLinks}>
            <a href="#platform">Platform</a>
            <a href="#workflow">How it works</a>
            <a href="#teams">For teams</a>
            <a href="#pricing">Pricing</a>
            <Link href="/docs">Docs</Link>
          </div>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.textLink}>Sign in</Link>
            <Link href="/docs" className={styles.navButton}>Read the guide <span>↗</span></Link>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.shell}>
          <div className={styles.heroCopy}>
            <div className={styles.announcement}>
              <span>New</span>
              A calmer way to run your company
              <i>→</i>
            </div>
            <h1>Your team&apos;s work.<br /><em>Finally in sync.</em></h1>
            <p>
              Stride brings projects, people, attendance, time, and expenses
              into one beautifully connected workspace.
            </p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.primaryButton}>Open workspace <span>→</span></Link>
              <a href="#platform" className={styles.secondaryButton}><span className={styles.play}>▶</span> See how it works</a>
            </div>
            <div className={styles.heroProof}>
              <span><b>✓</b> No credit card</span>
              <span><b>✓</b> Complete product guide</span>
              <span><b>✓</b> Ready in minutes</span>
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className={styles.contextStrip} aria-label="Product areas">
        <div className={styles.shell}>
          <p>One workspace across your entire operation</p>
          <div className={styles.contextItems}>
            <span>People</span><i />
            <span>Projects</span><i />
            <span>Attendance</span><i />
            <span>Time</span><i />
            <span>Expenses</span>
          </div>
        </div>
      </section>

      <section className={styles.platform} id="platform">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>The platform</span>
            <h2>Less operational noise.<br />More meaningful progress.</h2>
            <p>Every module shares the same people, projects, and permissions—so your team stops reconciling tools and starts moving work forward.</p>
          </div>

          <div className={styles.capabilityGrid}>
            {capabilities.map((item) => (
              <article className={styles.capabilityCard} key={item.title}>
                <div className={`${styles.capabilityIcon} ${styles[item.tone]}`}>{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link href="/docs">Read the guide <span>→</span></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.workSection} id="teams">
        <div className={styles.shell}>
          <div className={styles.workGrid}>
            <div className={styles.workVisual}>
              <div className={styles.ticketWindow}>
                <div className={styles.windowTop}><span /><span /><span /><small>SPRINT 08 · PRODUCT</small></div>
                <div className={styles.boardColumns}>
                  <BoardColumn title="To do" count="3" items={["Employee onboarding flow", "Expense export", "Mobile navigation"]} />
                  <BoardColumn title="In progress" count="2" active items={["Git repository mapping", "Attendance insights"]} />
                  <BoardColumn title="In review" count="2" items={["Role permissions", "Quarterly report"]} />
                </div>
              </div>
              <div className={styles.floatingCard}>
                <div className={styles.avatarStack}><span>AK</span><span>PM</span><span>RS</span></div>
                <div><strong>Everyone is aligned</strong><small>7 teammates active today</small></div>
                <b>+18%</b>
              </div>
            </div>

            <div className={styles.workCopy}>
              <span className={styles.kicker}>Work, connected</span>
              <h2>From company strategy to the next task.</h2>
              <p>Give every role a view that makes sense—from leadership summaries to the ticket an employee needs to finish today.</p>
              <ul>
                <li><span>01</span><div><strong>One source of truth</strong><p>Projects, people, and activity stay linked instead of drifting across spreadsheets.</p></div></li>
                <li><span>02</span><div><strong>Permissions with purpose</strong><p>Role-aware views keep sensitive company and financial data in the right hands.</p></div></li>
                <li><span>03</span><div><strong>Decisions with context</strong><p>See workload, time, attendance, and spending before deciding what comes next.</p></div></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workflow} id="workflow">
        <div className={styles.shell}>
          <div className={styles.workflowHeading}>
            <div><span className={styles.kicker}>Simple by design</span><h2>Start organised.<br />Stay organised.</h2></div>
            <p>Stride grows around your operating model, not the other way around. Set the foundation once and keep every workflow connected.</p>
          </div>
          <div className={styles.steps}>
            {workflow.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing" aria-labelledby="pricing-title">
        <div className={styles.shell}>
          <div className={styles.pricingHead}>
            <div><span className={styles.kicker}>Plans for every stage</span><h2 id="pricing-title">Find your place to start.</h2></div>
            <p>Choose from the workspace tiers available in Stride. Ask your administrator for current pricing and plan terms.</p>
          </div>
          <div className={styles.pricingGrid}>
            {pricingPlans.map((plan) => (
              <article className={`${styles.pricingCard} ${plan.name === "GROWTH" ? styles.pricingFeatured : ""}`} key={plan.name}>
                {plan.name === "GROWTH" && <span className={styles.pricingBadge}>GROWING TEAMS</span>}
                <span className={styles.pricingName}>{plan.name}</span>
                <h3>{plan.title}</h3>
                <p>{plan.detail}</p>
                <strong className={styles.pricingRate}>Pricing on request</strong>
                <Link href="/pricing" className={styles.pricingLink}>View plan details <span>→</span></Link>
              </article>
            ))}
          </div>
          <p className={styles.pricingNote}>Prices and tier-specific feature limits are not published in the current application.</p>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.ctaOrbOne} /><div className={styles.ctaOrbTwo} />
        <div className={styles.shell}>
          <span className={styles.ctaKicker}>Your next chapter, organised</span>
          <h2>Build a company that<br />moves as one.</h2>
          <p>Read the full guide, then step inside your workspace and put connected operations to work.</p>
          <Link href="/docs" className={styles.ctaButton}>Explore the documentation <span>→</span></Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div>
              <Link href="/" className={styles.brand}><span className={styles.brandMark}>S</span><span>Str<span className={styles.brandAccent}>ide</span></span></Link>
              <p>One calm, connected place to run the work behind your business.</p>
            </div>
            <div className={styles.footerLinks}>
              <div><strong>Product</strong><a href="#platform">Platform</a><a href="#workflow">How it works</a><Link href="/pricing">Pricing</Link><Link href="/docs">Documentation</Link></div>
              <div><strong>Workspace</strong><a href="#teams">For teams</a><Link href="/login">Sign in</Link></div>
            </div>
          </div>
          <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Stride</span><span>Built for teams that care how work feels.</span></div>
        </div>
      </footer>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className={styles.previewWrap} aria-label="Stride dashboard preview">
      <div className={styles.previewGlow} />
      <div className={styles.dashboardWindow}>
        <aside className={styles.previewSidebar}>
          <div className={styles.miniBrand}>S</div>
          {["▦", "◇", "✓", "◷", "◎"].map((icon, index) => <span className={index === 0 ? styles.activeIcon : ""} key={icon}>{icon}</span>)}
          <span className={styles.sidebarAvatar}>AK</span>
        </aside>
        <div className={styles.previewMain}>
          <header><div><small>MONDAY, 29 SEPTEMBER</small><strong>Good morning, Arjun</strong></div><div className={styles.previewUser}>⌕ <span>AK</span></div></header>
          <div className={styles.previewStats}>
            <Metric label="Active projects" value="12" delta="+3 this month" color="blue" />
            <Metric label="Open tickets" value="38" delta="82% on track" color="violet" />
            <Metric label="Team today" value="46" delta="4 working remotely" color="mint" />
          </div>
          <div className={styles.previewContent}>
            <div className={styles.chartCard}>
              <div className={styles.cardTitle}><div><strong>Team momentum</strong><small>Completed work · last 7 days</small></div><span>This week⌄</span></div>
              <div className={styles.chart}>
                {[42, 58, 46, 76, 66, 89, 72].map((height, index) => <i key={index} style={{ height: `${height}%` }}><b /></i>)}
              </div>
              <div className={styles.chartLabels}><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
            </div>
            <div className={styles.activityCard}>
              <div className={styles.cardTitle}><div><strong>Recent activity</strong><small>Across your workspace</small></div></div>
              <div className={styles.activity}><span className={styles.personBlue}>PM</span><p><b>Priya</b> moved a ticket<small>2 min ago</small></p></div>
              <div className={styles.activity}><span className={styles.personGreen}>RS</span><p><b>Rahul</b> logged 3h 20m<small>18 min ago</small></p></div>
              <div className={styles.activity}><span className={styles.personPurple}>NK</span><p><b>Neha</b> submitted an expense<small>1 hour ago</small></p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) {
  return <div className={styles.metric}><div className={`${styles.metricDot} ${styles[color]}`} /><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>;
}

function BoardColumn({ title, count, items, active = false }: { title: string; count: string; items: string[]; active?: boolean }) {
  return <div className={styles.boardColumn}><div><strong>{title}</strong><span>{count}</span></div>{items.map((item, index) => <article className={active && index === 0 ? styles.activeTicket : ""} key={item}><small>STR-{24 + index}</small><p>{item}</p><footer><i className={index === 1 ? styles.priorityAmber : ""} /><span>{["AK", "PM", "RS"][index]}</span></footer></article>)}</div>;
}
