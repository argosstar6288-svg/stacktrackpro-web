import Link from "next/link";

export default function LegalHome() {
  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: "1.6" }}>
      <h1>Legal Documents & Policies</h1>
      <p style={{ fontSize: "18px", color: "#666", marginBottom: "40px" }}>
        Welcome to StackTrackPro's legal center. Here you'll find all the policies and agreements that govern our Platform.
      </p>

      <style>{`
        .legal-card {
          padding: 24px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background-color: #f9f9f9;
          cursor: pointer;
          transition: all 0.2s ease;
          height: 100%;
          text-decoration: none;
          display: block;
        }
        .legal-card:hover {
          background-color: #f0f7ff;
          border-color: #0066cc;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .legal-card h3 {
          margin-top: 0;
          color: #0066cc;
        }
        .legal-card p {
          color: #666;
          font-size: 14px;
          margin-bottom: 12px;
        }
        .legal-card-link {
          color: #0066cc;
          font-size: 14px;
          font-weight: bold;
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "40px" }}>
        <Link href="/legal/terms" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Terms of Service</h3>
            <p>
              Our complete terms governing your use of StackTrackPro, including auction rules, prohibited activities, and your rights and responsibilities.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>

        <Link href="/legal/privacy" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Privacy Policy</h3>
            <p>
              How we collect, use, and protect your personal information. Includes your privacy rights under GDPR, CCPA, and other regulations.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>

        <Link href="/legal/community-guidelines" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Community Guidelines</h3>
            <p>
              Standards for respectful and ethical community participation, including prohibited conduct, dispute resolution, and enforcement policies.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>

        <Link href="/legal/refund-dispute" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Refund & Dispute Policy</h3>
            <p>
              Complete guide to returns, refunds, and dispute resolution for both Buyers and Sellers, including timeframes and procedures.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>

        <Link href="/legal/payout" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Seller Payout Policy</h3>
            <p>
              How Seller earnings are calculated, when payouts are released, fee structures by tier, and handling of disputes or holds.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>

        <Link href="/legal/founding-member" style={{ textDecoration: "none" }}>
          <div className="legal-card">
            <h3>Founding Member Agreement</h3>
            <p>
              Exclusive benefits and terms for members who join during launch phase, including lifetime discounts and premium features.
            </p>
            <p className="legal-card-link">Read More →</p>
          </div>
        </Link>
      </div>

      <section style={{ marginTop: "60px", padding: "40px", backgroundColor: "#f0f7ff", borderRadius: "8px", border: "1px solid #0066cc" }}>
        <h2>Important Information</h2>
        <div style={{ columns: 2, columnGap: "40px" }}>
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ color: "#0066cc", marginTop: 0 }}>Effective Date</h3>
            <p>All policies are effective as of February 21, 2026 and apply to all users accessing StackTrackPro.</p>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ color: "#0066cc", marginTop: 0 }}>Updates</h3>
            <p>We may update these policies periodically. Material changes will be announced via email with at least 30 days notice.</p>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ color: "#0066cc", marginTop: 0 }}>Your Rights</h3>
            <p>You have the right to review these policies at any time. Continued use of StackTrackPro indicates acceptance of current terms.</p>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ color: "#0066cc", marginTop: 0 }}>Disputes</h3>
            <p>Disputes about these policies are resolved through our standard dispute resolution and arbitration process as outlined in our Terms.</p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "40px", padding: "40px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
        <h2>Contact Our Legal Team</h2>
        <p>If you have questions about any of our policies, please contact us:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px" }}>
          <div>
            <h3 style={{ color: "#333", marginTop: 0 }}>Email</h3>
            <p style={{ margin: 0 }}>
              <a href="mailto:legal@stacktrackpro.com" style={{ color: "#0066cc", textDecoration: "none" }}>
                legal@stacktrackpro.com
              </a>
            </p>
          </div>
          <div>
            <h3 style={{ color: "#333", marginTop: 0 }}>Phone</h3>
            <p style={{ margin: 0 }}>
              <a href="tel:+15551234567" style={{ color: "#0066cc", textDecoration: "none" }}>
                +1 (555) 123-4567
              </a>
            </p>
          </div>
          <div>
            <h3 style={{ color: "#333", marginTop: 0 }}>Mailing Address</h3>
            <p style={{ margin: 0 }}>
              StackTrackPro, Inc.<br />
              123 Trading Plaza<br />
              San Francisco, CA 94105
            </p>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: "60px", textAlign: "center", borderTop: "1px solid #e0e0e0", paddingTop: "40px", color: "#666", fontSize: "14px" }}>
        <p>© 2026 StackTrackPro, Inc. All rights reserved.</p>
        <p>Last updated: February 21, 2026</p>
      </footer>
    </div>
  );
}
