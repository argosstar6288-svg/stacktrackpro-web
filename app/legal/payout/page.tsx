export default function PayoutPolicy() {
  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: "1.6" }}>
      <h1>Seller Payout Policy</h1>
      <p><em>Last Updated: February 21, 2026</em></p>

      <h2>1. Payout Overview</h2>
      <p>StackTrackPro maintains a transparent payout system for Sellers. This policy outlines how earnings are calculated, when payments are released, and how holds are handled.</p>

      <h2>2. Payout Eligibility</h2>
      <h3>2.1 Account Requirements</h3>
      <p>To receive payouts, you must:</p>
      <ul>
        <li>Be at least 18 years old</li>
        <li>Have a verified bank account or payment method</li>
        <li>Have completed identity verification</li>
        <li>Have no active account restrictions or suspensions</li>
        <li>Have agreed to all Terms of Service and policies</li>
        <li>Maintain a Seller Rating of 85% or higher</li>
      </ul>

      <h3>2.2 Payout Eligibility Timeline</h3>
      <ul>
        <li><strong>New Seller Account:</strong> First payout available after 14 days (to verify account legitimacy)</li>
        <li><strong>Low Feedback:</strong> Payouts withheld if fewer than 5 feedback ratings</li>
        <li><strong>High Dispute Rate:</strong> Payouts held if disputes exceed 5% of sales</li>
      </ul>

      <h2>3. Earnings Calculation</h2>
      <h3>3.1 What You Earn</h3>
      <p>For each successful sale, your earnings = Hammer Price (final bid price)</p>

      <h3>3.2 Deductions</h3>
      <p>StackTrackPro deducts the following from your earnings:</p>
      <ul>
        <li><strong>Final Value Fee:</strong> 8-15% based on Seller Tier (see tier table below)</li>
        <li><strong>Payment Processing Fee:</strong> 2.9% + $0.30</li>
        <li><strong>Listing Fee:</strong> Already paid upfront (non-refundable usually)</li>
        <li><strong>Returns/Refunds:</strong> Full hammer price refunded, fees not refunded</li>
        <li><strong>Chargebacks:</strong> Full amount + $15 chargeback fee deducted</li>
        <li><strong>Taxes:</strong> Sales tax collected from Buyer, payable to tax authorities</li>
      </ul>

      <h3>3.3 Example Calculation</h3>
      <p>Item sells for $100 (hammer price)</p>
      <table style={{ marginTop: "10px", marginBottom: "10px", width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
        <tbody>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Hammer Price</td>
            <td style={{ padding: "10px" }}>$100.00</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Final Value Fee (10% for Silver Tier)</td>
            <td style={{ padding: "10px" }}>-$10.00</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Payment Processing Fee (2.9% + $0.30)</td>
            <td style={{ padding: "10px" }}>-$3.20</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Sales Tax Collected (7% - varies by location)</td>
            <td style={{ padding: "10px" }}>-$7.00</td>
          </tr>
          <tr style={{ fontWeight: "bold", backgroundColor: "#f0f7ff", borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Your Net Payout</td>
            <td style={{ padding: "10px" }}>$79.80</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Seller Tier System</h2>
      <h3>4.1 Tier Benefits</h3>
      <table style={{ marginTop: "10px", marginBottom: "10px", width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
        <tbody>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Tier</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Requirements</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Final Value Fee</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Listing Fee Discount</td>
            <td style={{ padding: "10px", fontWeight: "bold" }}>Payout Speed</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Bronze</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>New seller, &lt;10 ratings</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>15%</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>None</td>
            <td style={{ padding: "10px" }}>7 days</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Silver</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>10+ ratings, 90%+ positive</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>10%</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>10%</td>
            <td style={{ padding: "10px" }}>5 days</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Gold</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>100+ ratings, 95%+ positive, $10k+ sales</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>8%</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>20%</td>
            <td style={{ padding: "10px" }}>2 days</td>
          </tr>
          <tr>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Platinum</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>500+ ratings, 97%+ positive, $100k+ sales</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>6%</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>50%</td>
            <td style={{ padding: "10px" }}>Next day</td>
          </tr>
        </tbody>
      </table>

      <h3>4.2 Tier Maintenance</h3>
      <p>To maintain your tier:</p>
      <ul>
        <li><strong>Minimum Feedback Rating:</strong> Drop below tier requirement = downgrade to lower tier</li>
        <li><strong>Dispute Rate:</strong> Disputes over 5% = automatic downgrade</li>
        <li><strong>Inactivity:</strong> No sales in 90 days = downgrade one tier</li>
        <li><strong>Terms Violation:</strong> Any violation = immediate downgrade to Bronze</li>
      </ul>

      <h2>5. Payout Timing</h2>
      <h3>5.1 Standard Schedule</h3>
      <ul>
        <li>Auctions end → Payment captured and verified (24 hours)</li>
        <li><strong>Bronze:</strong> Released to your account on day 7</li>
        <li><strong>Silver:</strong> Released to your account on day 5</li>
        <li><strong>Gold:</strong> Released to your account on day 2</li>
        <li><strong>Platinum:</strong> Released to your account next business day</li>
      </ul>

      <h3>5.2 Hold Period Rationale</h3>
      <p>The hold period allows StackTrackPro to:</p>
      <ul>
        <li>Verify payment authenticity and prevent fraud</li>
        <li>Process and settle any disputes that arise quickly</li>
        <li>Handle potential chargebacks before funds are released</li>
        <li>Provide buyer protection during this period</li>
      </ul>

      <h3>5.3 Processing Times by Method</h3>
      <table style={{ marginTop: "10px", marginBottom: "10px", width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
        <tbody>
          <tr style={{ borderBottom: "1px solid #ccc", backgroundColor: "#f0f7ff" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Payout Method</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc", fontWeight: "bold" }}>Transfer Time After Release</td>
            <td style={{ padding: "10px", fontWeight: "bold" }}>Fee</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Stripe Bank Transfer (ACH)</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>1-3 business days</td>
            <td style={{ padding: "10px" }}>None</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Wire Transfer</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>1 business day</td>
            <td style={{ padding: "10px" }}>$15</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Check (Physical)</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>5-10 business days</td>
            <td style={{ padding: "10px" }}>$5</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>PayPal</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>1 business day</td>
            <td style={{ padding: "10px" }}>2%</td>
          </tr>
          <tr>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Platform Credits</td>
            <td style={{ padding: "10px", borderRight: "1px solid #ccc" }}>Immediate</td>
            <td style={{ padding: "10px" }}>None</td>
          </tr>
        </tbody>
      </table>

      <h2>6. Payout Holds and Restrictions</h2>
      <h3>6.1 Automatic Holds</h3>
      <p>Payouts are automatically held when:</p>
      <ul>
        <li><strong>High Dispute Rate:</strong> 5%+ of sales in dispute</li>
        <li><strong>Multiple Chargebacks:</strong> 2+ chargebacks in 30 days = 45-day hold</li>
        <li><strong>Fraud Suspicion:</strong> Pattern matching fraud indicators</li>
        <li><strong>Restricted Item Sales:</strong> Any prohibited item sales trigger investigation</li>
        <li><strong>Account Violation:</strong> Terms of Service violation detected</li>
        <li><strong>Legal/Tax Issues:</strong> Pending legal matter or unresolved tax status</li>
      </ul>

      <h3>6.2 Hold Investigation</h3>
      <p>When payouts are held:</p>
      <ol>
        <li>Seller receives notification email explaining reason</li>
        <li>StackTrackPro team reviews transactions and account (5-10 business days)</li>
        <li>Seller can submit evidence to support payout release</li>
        <li>Decision: Release funds, continue hold, or recommend account suspension</li>
      </ol>

      <h3>6.3 Hold Duration</h3>
      <ul>
        <li><strong>Minor Issues:</strong> Hold for duration of investigation (typically 7-14 days)</li>
        <li><strong>Moderate Risk:</strong> Hold for 30 days or until pattern changes</li>
        <li><strong>High Risk:</strong> Hold indefinitely pending resolution or account closure</li>
      </ul>

      <h3>6.4 Appealing a Hold</h3>
      <p>To appeal a payout hold:</p>
      <ol>
        <li>Log into your StackTrackPro account</li>
        <li>Go to Payouts section and select "View Hold Details"</li>
        <li>Click "Appeal Hold"</li>
        <li>Provide evidence explaining the situation</li>
        <li>Team reviews within 5 business days</li>
        <li>Decision is final and binding</li>
      </ol>

      <h2>7. Taxes and Tax Reporting</h2>
      <h3>7.1 Your Tax Responsibility</h3>
      <p>Sellers are responsible for:</p>
      <ul>
        <li>Reporting all income from auction sales to tax authorities</li>
        <li>Paying income taxes on earnings</li>
        <li>Tracking expenses and deductions</li>
        <li>Filing appropriate tax forms (1099-K, Schedule C, etc.)</li>
        <li>Paying estimated quarterly taxes if required</li>
      </ul>

      <h3>7.2 StackTrackPro Tax Reporting</h3>
      <ul>
        <li><strong>1099-K:</strong> Issued to Sellers earning $20,000+ AND (100+ transactions OR $20k+, depending on law)</li>
        <li><strong>Tax Report:</strong> Available in your account dashboard year-round</li>
        <li><strong>Reporting Period:</strong> Calendar year (Jan 1 - Dec 31)</li>
        <li><strong>Reporting Deadline:</strong> 1099-K issued by Jan 31 of following year</li>
      </ul>

      <h3>7.3 Sales Tax Collection</h3>
      <ul>
        <li>StackTrackPro may collect sales tax on Buyer's behalf (varies by state/country)</li>
        <li>Tax is collected from Buyer and passed to Seller initially</li>
        <li>StackTrackPro remits taxes to appropriate authorities</li>
        <li>Seller receives tax liability information on 1099-K</li>
      </ul>

      <h2>8. Reserve and Minimum Balance</h2>
      <h3>8.1 Reserve Policy</h3>
      <p>StackTrackPro may hold a percentage of payouts (typically 10-20%) for new sellers to:</p>
      <ul>
        <li>Cover potential chargebacks and refunds</li>
        <li>Protect against fraud or misrepresentation</li>
        <li>Ensure account stability</li>
      </ul>

      <h3>8.2 Reserve Release</h3>
      <ul>
        <li>Reserve held for minimum 30-90 days for new sellers</li>
        <li>After 90 days with &lt;1% dispute rate: Released to account</li>
        <li>If disputes arise: Reserve applied to cover costs</li>
        <li>Remaining reserve released when conditions are met</li>
      </ul>

      <h2>9. Payment Method Management</h2>
      <h3>9.1 Adding a Payment Method</h3>
      <p>To add or change where payouts are sent:</p>
      <ol>
        <li>Go to Account → Payout Settings</li>
        <li>Click "Add Payment Method"</li>
        <li>Select method (Bank Account, Wire, Check, etc.)</li>
        <li>Verify through micro-deposit confirmation or bank auth</li>
        <li>Set as primary method</li>
      </ol>

      <h3>9.2 Changing Payment Methods</h3>
      <ul>
        <li>Changes take effect on next payout cycle (no retroactive changes)</li>
        <li>Must have verified account to request changes</li>
        <li>Limit 5 payment method changes per calendar year</li>
      </ul>

      <h3>9.3 Failed Payouts</h3>
      <p>If a payout fails (invalid account, etc.):</p>
      <ul>
        <li>Attempted payout is returned to your StackTrackPro balance</li>
        <li>Notification email sent with retry instructions</li>
        <li>After 3 failed attempts: Account flagged and payout suspended</li>
        <li>Contact support to update payment method and re-request payout</li>
      </ul>

      <h2>10. Currency and Exchange</h2>
      <h3>10.1 Multi-Currency Payouts</h3>
      <p>StackTrackPro operates in USD. International payouts:</p>
      <ul>
        <li>All earnings converted to USD from initial transactions</li>
        <li>Exchange rate: Stripe's rate on transaction date</li>
        <li>International wire fees: $15-$50 depending on destination bank</li>
      </ul>

      <h3>10.2 Currency Risk</h3>
      <p>StackTrackPro is not responsible for:</p>
      <ul>
        <li>Exchange rate fluctuations</li>
        <li>International banking fees</li>
        <li>Currency conversion delays</li>
        <li>Payout amount differences due to currency changes</li>
      </ul>

      <h2>11. Disputes and Chargebacks</h2>
      <h3>11.1 Chargeback Impact</h3>
      <p>If a Buyer initiates a chargeback:</p>
      <ul>
        <li>Amount is deducted from your StackTrackPro balance</li>
        <li>$15 chargeback fee is also deducted</li>
        <li>Your account is flagged for investigation</li>
        <li>2 chargebacks in 30 days triggers 45-day payout hold</li>
        <li>3+ chargebacks in 6 months may result in termination</li>
      </ul>

      <h3>11.2 Disputed Transactions</h3>
      <p>Good faith disputes may not affect payouts if:</p>
      <ul>
        <li>Seller responds appropriately within dispute window</li>
        <li>Seller resolution is accepted by Buyer</li>
        <li>Dispute is resolved in Seller's favor</li>
      </ul>

      <h2>12. Refunds and Reversals</h2>
      <h3>12.1 Refund Processing</h3>
      <p>When a refund is issued to a Buyer:</p>
      <ul>
        <li>If payout released: Seller's balance goes negative (debt)</li>
        <li>Negative balance must be paid back before future payouts</li>
        <li>Can be recovered from future sales or manual payment</li>
      </ul>

      <h3>12.2 Partial Refunds</h3>
      <p>If Buyer receives partial refund:</p>
      <ul>
        <li>Payout percentage refunded proportionally</li>
        <li>Seller maintains reduced earnings from that auction</li>
      </ul>

      <h2>13. Account Suspension and Payout Impact</h2>
      <h3>13.1 Suspended Account</h3>
      <p>If your account is suspended:</p>
      <ul>
        <li>Current payouts are delayed pending investigation</li>
        <li>No new sales can be made</li>
        <li>Existing unpaid auctions remain subject to payout schedule</li>
        <li>If reinstated: Full payouts released</li>
        <li>If terminated: See policy below</li>
      </ul>

      <h3>13.2 Terminated Account</h3>
      <p>If your account is terminated:</p>
      <ul>
        <li>Outstanding payouts held for 90+ days pending dispute resolution</li>
        <li>Used to cover chargebacks, refunds, or damages</li>
        <li>Remaining balance released after 180 days if no complications</li>
        <li>Can be withheld indefinitely if legal dispute pending</li>
      </ul>

      <h2>14. Minimum Payout Threshold</h2>
      <h3>14.1 Minimum Amount</h3>
      <ul>
        <li>Bank Transfer (ACH): Minimum $10</li>
        <li>Wire Transfer: Minimum $100 (plus $15 fee)</li>
        <li>Check: Minimum $20 (plus $5 fee)</li>
        <li>Platform Credit: No minimum (can use immediately)</li>
      </ul>

      <h3>14.2 Below Minimum</h3>
      <p>If balance is below minimum:</p>
      <ul>
        <li>Funds remain in your StackTrackPro account</li>
        <li>Accumulate until minimum is reached or converted to store credit</li>
        <li>Request manual payout if waiting not feasible (contact support)</li>
      </ul>

      <h2>15. Monthly Payout Statement</h2>
      <h3>15.1 Available Information</h3>
      <p>Your monthly statement shows:</p>
      <ul>
        <li>Total sales and gross revenue</li>
        <li>Listing fees paid</li>
        <li>Final value fees deducted</li>
        <li>Payment processing fees</li>
        <li>Refunds and chargebacks</li>
        <li>Hold amounts and reasons</li>
        <li>Net payout amount</li>
        <li>Payout scheduled date</li>
      </ul>

      <h3>15.2 Accessing Statements</h3>
      <p>Go to Account → Payout History → Select Month → View/Download Statement</p>

      <h2>16. Policy Changes</h2>
      <p>StackTrackPro reserves the right to modify this policy with 30 days notice. Material changes to fee structure or timing will be announced via email.</p>

      <h2>17. Contact for Payout Questions</h2>
      <p>
        <strong>Seller Support - Payouts</strong><br />
        Email: seller-support@stacktrackpro.com<br />
        Phone: +1 (555) 123-4567<br />
        Hours: Monday-Friday, 9 AM - 6 PM PT
      </p>

      <p style={{ marginTop: "40px", fontStyle: "italic", color: "#666" }}>
        © 2026 StackTrackPro, Inc. All rights reserved.
      </p>
    </div>
  );
}
