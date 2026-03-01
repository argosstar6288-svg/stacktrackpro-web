"use client";

import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.column}>
            <h3 className={styles.heading}>StackTrack Pro</h3>
            <p className={styles.description}>
              The premier platform for sports card trading, auctions, and collection management.
            </p>
          </div>

          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Platform</h4>
            <Link href="/dashboard" className={styles.link}>Dashboard</Link>
            <Link href="/auction" className={styles.link}>Auctions</Link>
            <Link href="/dashboard/market" className={styles.link}>Market</Link>
            <Link href="/dashboard/help" className={styles.link}>Help Center</Link>
          </div>

          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Legal</h4>
            <Link href="/legal/terms" className={styles.link}>Terms of Service</Link>
            <Link href="/legal/privacy" className={styles.link}>Privacy Policy</Link>
            <Link href="/legal/auction-rules" className={styles.link}>Auction Rules</Link>
            <Link href="/legal/community-guidelines" className={styles.link}>Community Guidelines</Link>
          </div>

          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Support</h4>
            <a href="mailto:support@stacktrackpro.com" className={styles.link}>Email Support</a>
            <Link href="/dashboard/help" className={styles.link}>FAQ</Link>
            <Link href="/legal/refund-dispute" className={styles.link}>Refunds & Disputes</Link>
            <Link href="/legal/payout" className={styles.link}>Payout Policy</Link>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.copyright}>
            © 2026 StackTrack Pro. All rights reserved.
          </div>
          <div className={styles.ageNotice}>
            🔞 Auctions are restricted to users 18 years and older.
          </div>
        </div>
      </div>
    </footer>
  );
}
