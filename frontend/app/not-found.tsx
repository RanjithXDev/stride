import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Stride home">
          <span className={styles.mark}>S</span>
          <span>Str<span>ide</span></span>
        </Link>
        <Link href="/docs" className={styles.docsLink}>Documentation <span aria-hidden="true">↗</span></Link>
      </header>

      <section className={styles.content} aria-labelledby="not-found-title">
        <div className={styles.art} aria-hidden="true">
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          <span className={styles.errorCode}>404</span>
          <span className={styles.star}>✳</span>
          <span className={styles.dot} />
        </div>
        <p className={styles.eyebrow}>PAGE NOT FOUND</p>
        <h1 id="not-found-title">Looks like this path<br />took a wrong turn.</h1>
        <p className={styles.description}>The page may have moved, or the address may be incorrect. Let’s get you back to somewhere useful.</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>Back to home <span aria-hidden="true">→</span></Link>
          <Link href="/login" className={styles.secondary}>Sign in</Link>
        </div>
        <p className={styles.help}>Looking for help? <Link href="/docs">Browse the Stride guide</Link></p>
      </section>

      <footer className={styles.footer}><span>© {new Date().getFullYear()} Stride</span><span>One connected place to move work forward.</span></footer>
    </main>
  );
}
