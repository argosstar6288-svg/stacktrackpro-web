"use client";

import Link from "next/link";
import styles from "./auction-rules.module.css";

export default function AuctionRulesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/auction" className={styles.backLink}>← Back to Auctions</Link>
          <h1 className={styles.title}>Auction Rules &amp; Guidelines</h1>
          <p className={styles.subtitle}>Last Updated: February 25, 2026</p>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Age Requirement</h2>
            <div className={styles.important}>
              <strong>18+ ONLY:</strong> You must be at least 18 years of age to participate in auctions on StackTrack Pro. By bidding or creating an auction, you confirm that you meet this age requirement.
            </div>
          </section>

          <section className={styles.section}>
            <h2>1. General Auction Rules</h2>
            <h3>1.1 Eligibility</h3>
            <ul>
              <li>Must be 18 years or older</li>
              <li>Must have a verified StackTrack Pro account</li>
              <li>Must comply with all applicable laws and regulations</li>
              <li>Accounts in good standing only (no suspension or ban history)</li>
            </ul>

            <h3>1.2 Account Responsibility</h3>
            <ul>
              <li>You are responsible for all activity under your account</li>
              <li>Keep your login credentials secure</li>
              <li>Report any unauthorized access immediately</li>
              <li>One account per person</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>2. Seller Guidelines</h2>
            <h3>2.1 Creating Auctions</h3>
            <ul>
              <li>Provide accurate descriptions of all items</li>
              <li>Use clear, authentic photos (no stock images unless noted)</li>
              <li>Set realistic starting bids and reserve prices</li>
              <li>Include card condition, year, brand, and relevant details</li>
              <li>Disclose any flaws, damage, or alterations</li>
            </ul>

            <h3>2.2 Prohibited Items</h3>
            <ul>
              <li>Counterfeit or fake cards</li>
              <li>Stolen merchandise</li>
              <li>Items obtained through fraud</li>
              <li>Cards from unauthorized sources</li>
              <li>Items violating intellectual property rights</li>
            </ul>

            <h3>2.3 Seller Obligations</h3>
            <ul>
              <li>Honor all successful bids</li>
              <li>Ship items within 3 business days of payment</li>
              <li>Provide tracking information</li>
              <li>Package items securely to prevent damage</li>
              <li>Respond to buyer inquiries within 24 hours</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Buyer Guidelines</h2>
            <h3>3.1 Bidding Rules</h3>
            <ul>
              <li>All bids are binding commitments to purchase</li>
              <li>Cannot retract bids except in exceptional circumstances</li>
              <li>Bid increments must meet minimum requirements</li>
              <li>Sniping (last-second bidding) is allowed</li>
              <li>Proxy bidding available for convenience</li>
            </ul>

            <h3>3.2 Payment</h3>
            <ul>
              <li>Payment must be made within 48 hours of auction end</li>
              <li>Accepted payment methods: Credit card, PayPal, Stripe</li>
              <li>All transactions processed through secure platform</li>
              <li>Buyer protection applies to all purchases</li>
            </ul>

            <h3>3.3 Buyer Responsibilities</h3>
            <ul>
              <li>Read item descriptions carefully before bidding</li>
              <li>Ask questions before auction ends</li>
              <li>Complete payment promptly</li>
              <li>Leave feedback after receiving item</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Auction Format &amp; Timing</h2>
            <h3>4.1 Duration</h3>
            <ul>
              <li>Minimum auction duration: 1 day</li>
              <li>Maximum auction duration: 14 days</li>
              <li>Auctions cannot be extended by sellers</li>
              <li>Anti-sniping: 2-minute automatic extensions if bid in final 2 minutes</li>
            </ul>

            <h3>4.2 Reserve Prices</h3>
            <ul>
              <li>Sellers may set reserve prices (minimum acceptable bid)</li>
              <li>Reserve not met = no obligation to sell</li>
              <li>Reserve prices are hidden from bidders</li>
              <li>Notification when reserve is met</li>
            </ul>

            <h3>4.3 Buy It Now</h3>
            <ul>
              <li>Optional instant purchase price</li>
              <li>Removes auction and completes sale immediately</li>
              <li>Disabled once bidding reaches 50% of BIN price</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Fees &amp; Commissions</h2>
            <h3>5.1 Platform Fees</h3>
            <ul>
              <li>Listing fee: Free for first 10 auctions/month</li>
              <li>Success fee: 15% of final sale price</li>
              <li>Payment processing: 2.9% + $0.30 per transaction</li>
              <li>Featured listings: $5 per auction</li>
            </ul>

            <h3>5.2 Fee Collection</h3>
            <ul>
              <li>Fees deducted from seller payout automatically</li>
              <li>Buyers pay no additional fees</li>
              <li>Refunds include proportional fee refund</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Dispute Resolution</h2>
            <h3>6.1 Item Not as Described</h3>
            <ul>
              <li>Open dispute within 48 hours of delivery</li>
              <li>Provide evidence (photos, documentation)</li>
              <li>StackTrack Pro will mediate</li>
              <li>Possible outcomes: Full refund, partial refund, or no refund</li>
            </ul>

            <h3>6.2 Non-Payment</h3>
            <ul>
              <li>Sellers can file non-payment claim after 48 hours</li>
              <li>Buyer account may be suspended</li>
              <li>Seller can relist item with no additional fees</li>
            </ul>

            <h3>6.3 Non-Delivery</h3>
            <ul>
              <li>File claim if item not received within expected timeframe</li>
              <li>Seller must provide tracking information</li>
              <li>Buyer protection covers lost/stolen packages</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Prohibited Conduct</h2>
            <h3>7.1 Shill Bidding</h3>
            <p>Using multiple accounts or colluding with others to artificially inflate bid prices is strictly prohibited and will result in immediate account termination.</p>

            <h3>7.2 Bid Manipulation</h3>
            <ul>
              <li>No bid shielding (having accomplices bid to deter others)</li>
              <li>No fake bids or false bidding activity</li>
              <li>No circumventing platform safeguards</li>
            </ul>

            <h3>7.3 Contact Outside Platform</h3>
            <ul>
              <li>All communication must remain on platform until sale complete</li>
              <li>No direct payment outside platform</li>
              <li>No sharing personal contact information in listings</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>8. Enforcement &amp; Penalties</h2>
            <h3>8.1 Violations</h3>
            <ul>
              <li>First offense: Warning</li>
              <li>Second offense: Temporary suspension (7-30 days)</li>
              <li>Third offense: Permanent ban</li>
              <li>Serious violations: Immediate permanent ban</li>
            </ul>

            <h3>8.2 Appeals</h3>
            <p>You may appeal enforcement actions by contacting support@stacktrackpro.com with relevant documentation within 14 days.</p>
          </section>

          <section className={styles.section}>
            <h2>9. Shipping &amp; Delivery</h2>
            <h3>9.1 Seller Requirements</h3>
            <ul>
              <li>Use trackable shipping methods for items over $50</li>
              <li>Insurance recommended for items over $250</li>
              <li>Packaging must protect item adequately</li>
              <li>Signature confirmation for items over $1,000</li>
            </ul>

            <h3>9.2 Shipping Costs</h3>
            <ul>
              <li>Buyers pay shipping costs as listed</li>
              <li>Sellers must ship to buyer's verified address</li>
              <li>International shipping allowed (sellers discretion)</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>10. Legal &amp; Compliance</h2>
            <h3>10.1 Taxes</h3>
            <ul>
              <li>Sellers responsible for reporting income</li>
              <li>Platform provides transaction records</li>
              <li>Sales tax collected where applicable</li>
            </ul>

            <h3>10.2 Privacy</h3>
            <ul>
              <li>See our <Link href="/legal/privacy">Privacy Policy</Link> for data handling</li>
              <li>User information shared only as necessary for transactions</li>
            </ul>

            <h3>10.3 Terms of Service</h3>
            <ul>
              <li>These rules supplement our <Link href="/legal/terms">Terms of Service</Link></li>
              <li>Must comply with <Link href="/legal/community-guidelines">Community Guidelines</Link></li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>11. Platform Rights</h2>
            <p>StackTrack Pro reserves the right to:</p>
            <ul>
              <li>Remove any auction at any time for any reason</li>
              <li>Suspend or terminate accounts for violations</li>
              <li>Update these rules with 30 days notice</li>
              <li>Refuse service to anyone</li>
              <li>Intervene in disputes as final arbiter</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Contact &amp; Support</h2>
            <p>Questions about auction rules? Contact us:</p>
            <ul>
              <li>Email: <a href="mailto:auctions@stacktrackpro.com">auctions@stacktrackpro.com</a></li>
              <li>Help Center: <Link href="/dashboard/help">dashboard/help</Link></li>
              <li>Support Hours: Monday-Friday, 9am-5pm EST</li>
            </ul>
          </section>

          <div className={styles.agreement}>
            <p><strong>By participating in auctions on StackTrack Pro, you acknowledge that you have read, understood, and agree to comply with these Auction Rules &amp; Guidelines.</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
