import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Explore Stride workspace plans and find the right starting point for your organization.",
};

const plans = [
  { name: "FREE", title: "Start with Stride", description: "Explore a connected workspace and bring essential operations into one place.", featured: false },
  { name: "STARTER", title: "Organize your team", description: "A workspace tier for teams building consistent day-to-day operations.", featured: false },
  { name: "GROWTH", title: "Scale your operations", description: "A tier for organizations coordinating more teams, projects, and workflows.", featured: true },
  { name: "ENTERPRISE", title: "Fit your organization", description: "Discuss an organization-wide setup with your Stride administrator.", featured: false },
];

const capabilities = [
  "Projects, tickets, boards, and time tracking",
  "Employee directory and organization chart",
  "Attendance and company policy settings",
  "Expense approvals and income tracking",
  "GitHub and GitLab repository connections",
  "Audit history and reversible supported actions",
];

const questions = [
  { question: "How much does each plan cost?", answer: "Stride does not currently publish price amounts in the application. Ask your organization administrator or Stride representative for current pricing." },
  { question: "What changes between plan tiers?", answer: "The application stores an organization plan label, but does not currently define public feature limits or a plan comparison policy. Confirm the commercial terms with your administrator before choosing a tier." },
  { question: "Can I change plans later?", answer: "A Super Admin can update an organization’s plan assignment in the Admin Console. Contact your organization’s platform administrator to discuss a change." },
  { question: "Does every plan include the listed features?", answer: "The listed items describe capabilities in the product. The current application does not enforce tier-specific access to these capabilities, so this page does not assign them to particular plans." },
];

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Stride home"><span>S</span>Str<strong>ide</strong></Link>
        <nav aria-label="Main navigation"><Link href="/">Home</Link><Link href="/docs">Documentation</Link><Link href="/login" className={styles.signIn}>Sign in</Link></nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>STRAIGHTFORWARD PLANS</p>
        <h1>One workspace.<br /><em>A plan that fits.</em></h1>
        <p className={styles.lead}>Start with the tier that matches your organization today. Get current pricing and plan terms from your Stride administrator.</p>
        <a className={styles.jumpLink} href="#plans">Explore the plans <span aria-hidden="true">↓</span></a>
      </section>

      <section className={styles.plans} id="plans" aria-labelledby="plans-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>Workspace plans</span><h2 id="plans-title">Choose your starting point</h2></div>
          <p>Pricing amounts and tier-specific limits are not configured in the current product. We’ve kept the comparison focused on the available plan names and the shared platform.</p>
        </div>
        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <article key={plan.name} className={`${styles.planCard} ${plan.featured ? styles.featured : ""}`}>
              {plan.featured && <span className={styles.popular}>GROWING TEAMS</span>}
              <p className={styles.planName}>{plan.name}</p>
              <h3>{plan.title}</h3>
              <p className={styles.planDescription}>{plan.description}</p>
              <div className={styles.price}><strong>Let’s talk</strong><span>Pricing on request</span></div>
              <Link href="/login" className={plan.featured ? styles.primaryButton : styles.secondaryButton}>Sign in to your workspace <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
        <p className={styles.disclosure}>Plan labels are managed by a platform administrator. Pricing, billing cadence, seats, usage limits, taxes, and contractual terms must be confirmed separately.</p>
      </section>

      <section className={styles.included}>
        <div className={styles.includedIntro}><span className={styles.kicker}>The Stride platform</span><h2>Keep your operations connected.</h2><p>Stride brings core workflows into one organization workspace. Access remains governed by user roles and organization settings.</p><Link href="/docs">Read the product guide <span aria-hidden="true">→</span></Link></div>
        <ul>{capabilities.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>Common questions</span><h2>Before you choose</h2></div><p>For current prices, billing, and plan terms, contact your organization administrator.</p></div>
        <div className={styles.faqList}>{questions.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className={styles.cta}><span className={styles.kicker}>Ready to get oriented?</span><h2>See how Stride works.</h2><p>Explore the workflows and options available in your workspace.</p><Link href="/docs" className={styles.primaryButton}>Explore documentation <span aria-hidden="true">→</span></Link></section>

      <footer className={styles.footer}><Link href="/" className={styles.brand}><span>S</span>Str<strong>ide</strong></Link><div><Link href="/">Home</Link><Link href="/docs">Documentation</Link><Link href="/login">Sign in</Link></div><small>© {new Date().getFullYear()} Stride</small></footer>
    </main>
  );
}
