"use client";

import AppShell from "@/components/AppShell";

export default function AuctionRules() {
  return (
    <AppShell>
      <div style={{
        textAlign: "center",
        maxWidth: 900,
        margin: "0 auto",
        padding: "60px 20px"
      }}>
        <h1 style={{ 
          fontSize: "3rem", 
          fontWeight: 800,
          marginBottom: 30,
          lineHeight: 1.2
        }}>
          🔨 Auction Rules & User Agreement
        </h1>

        <div style={{
          background: "rgba(0,0,0,0.6)",
          padding: 40,
          borderRadius: 20,
          marginBottom: 40,
          textAlign: "left",
          lineHeight: 1.8,
          fontSize: "1.1rem"
        }}>
          <p style={{ marginBottom: 20 }}>
            By creating, bidding on, or participating in an auction on StackTrack, you agree to the following terms and conditions:
          </p>

          <h3 style={{ marginTop: 30, marginBottom: 15, fontSize: "1.5rem" }}>1. Auction Integrity</h3>
          <p>All auctions must be conducted in good faith. Shill bidding, bid manipulation, and fraudulent activity are strictly prohibited and will result in permanent account termination.</p>

          <h3 style={{ marginTop: 30, marginBottom: 15, fontSize: "1.5rem" }}>2. Binding Commitments</h3>
          <p>When you place a bid, you are entering into a legally binding contract to purchase the item if you win. Failure to complete payment within 48 hours may result in negative feedback and account penalties.</p>

          <h3 style={{ marginTop: 30, marginBottom: 15, fontSize: "1.5rem" }}>3. Seller Responsibilities</h3>
          <p>Sellers must accurately describe items, ship within 3 business days of payment, and provide tracking information. Misrepresentation of condition or authenticity will result in account suspension.</p>

          <h3 style={{ marginTop: 30, marginBottom: 15, fontSize: "1.5rem" }}>4. Payment & Fees</h3>
          <p>StackTrack charges a 5% final value fee on all successful auctions. Payment must be processed through our secure platform. Buyers are responsible for shipping costs unless otherwise stated.</p>

          <h3 style={{ marginTop: 30, marginBottom: 15, fontSize: "1.5rem" }}>5. Disputes</h3>
          <p>All disputes must be filed within 14 days of delivery. Our mediation team will review evidence and make a binding decision. Repeated frivolous claims may result in account restrictions.</p>
        </div>

        <button 
          className="cta-green"
          onClick={() => alert("Agreement accepted!")}
          style={{
            marginTop: 20,
            fontSize: "1.2rem"
          }}
        >
          ✅ Agree and Continue
        </button>

        <p style={{ marginTop: 20, opacity: 0.6, fontSize: "0.9rem" }}>
          Last updated: February 21, 2026
        </p>
      </div>
    </AppShell>
  );
}
