"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "../../lib/useCurrentUser";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useRouter } from "next/navigation";

interface FounderEntry {
  userId: string;
  firstName: string;
  lastName: string;
  joinedAt: Date;
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  totalBonusEarned: number;
  slotNumber?: number;
}

export default function FoundingWallPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [founders, setFounders] = useState<FounderEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalFounders: 0,
    totalReferrals: 0,
    totalBonusDistributed: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchFounders();
    }
  }, [user]);

  const fetchFounders = async () => {
    try {
      setDataLoading(true);

      // Query all founders, ordered by join date
      const q = query(
        collection(db, "users"),
        where("role", "==", "founder"),
        orderBy("subscription.lifetimeActivatedAt", "desc")
      ) as any;

      const snapshot = await getDocs(q);
      const foundersList: FounderEntry[] = [];
      let totalReferrals = 0;
      let totalBonus = 0;
      let slotCounter = 1;

      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        const referralStats = data.referralStats || {};

        foundersList.push({
          userId: doc.id,
          firstName: data.firstName || "Founder",
          lastName: data.lastName || "",
          joinedAt: data.subscription?.lifetimeActivatedAt?.toDate() || new Date(),
          referralCode: data.referralCode || "",
          totalReferrals: referralStats.totalReferrals || 0,
          completedReferrals: referralStats.completedReferrals || 0,
          totalBonusEarned: referralStats.totalBonusEarned || 0,
          slotNumber: slotCounter,
        });

        totalReferrals += referralStats.totalReferrals || 0;
        totalBonus += referralStats.totalBonusEarned || 0;
        slotCounter++;
      });

      setFounders(foundersList);
      setStats({
        totalFounders: foundersList.length,
        totalReferrals,
        totalBonusDistributed: totalBonus,
      });
    } catch (error) {
      console.error("Error fetching founders:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "0.5rem" }}>
          🏛️ Founding Wall of Honor
        </h1>
        <p style={{ color: "#666", fontSize: "16px", marginBottom: "2rem" }}>
          Meet the Founding Members who built StackTrackPro
        </p>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#f0f9ff",
              padding: "1.5rem",
              borderRadius: "8px",
              border: "1px solid #10b3f0",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#10b3f0" }}>
              {stats.totalFounders}
            </div>
            <div style={{ color: "#666", fontSize: "14px", marginTop: "0.5rem" }}>
              Total Founding Members
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#f0f9f0",
              padding: "1.5rem",
              borderRadius: "8px",
              border: "1px solid #10b340",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#10b340" }}>
              {stats.totalReferrals}
            </div>
            <div style={{ color: "#666", fontSize: "14px", marginTop: "0.5rem" }}>
              Referrals Made
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#fff9f0",
              padding: "1.5rem",
              borderRadius: "8px",
              border: "1px solid #ff9800",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ff9800" }}>
              {formatCurrency(stats.totalBonusDistributed)}
            </div>
            <div style={{ color: "#666", fontSize: "14px", marginTop: "0.5rem" }}>
              Bonuses Earned
            </div>
          </div>
        </div>
      </div>

      {/* Founders Table */}
      {dataLoading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          Loading Founding Members...
        </div>
      ) : founders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          No Founding Members yet. Be the first!
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "2rem",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Slot
                </th>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Founder
                </th>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Joined
                </th>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Referrals
                </th>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Bonus Earned
                </th>
                <th
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Referral Code
                </th>
              </tr>
            </thead>
            <tbody>
              {founders.map((founder, idx) => (
                <tr
                  key={founder.userId}
                  style={{
                    borderBottom: "1px solid #eee",
                    backgroundColor: idx % 2 === 0 ? "white" : "#fafafa",
                  }}
                >
                  <td
                    style={{
                      padding: "1rem",
                      color: "#666",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    #{founder.slotNumber}/50
                  </td>
                  <td style={{ padding: "1rem", color: "#333", fontSize: "14px" }}>
                    <div style={{ fontWeight: "500" }}>
                      {founder.firstName} {founder.lastName}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "1rem",
                      color: "#666",
                      fontSize: "14px",
                    }}
                  >
                    {formatDate(founder.joinedAt)}
                  </td>
                  <td
                    style={{
                      padding: "1rem",
                      color: "#333",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {founder.completedReferrals}
                  </td>
                  <td
                    style={{
                      padding: "1rem",
                      color: "#ff9800",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {formatCurrency(founder.totalBonusEarned)}
                  </td>
                  <td style={{ padding: "1rem", textAlign: "center" }}>
                    <button
                      onClick={() => copyReferralCode(founder.referralCode)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: copiedCode === founder.referralCode ? "#10b340" : "#f0f0f0",
                        color: copiedCode === founder.referralCode ? "white" : "#333",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "bold",
                        transition: "all 0.2s",
                      }}
                    >
                      {copiedCode === founder.referralCode
                        ? "✓ Copied"
                        : founder.referralCode}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* How It Works */}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "2rem",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          borderTop: "3px solid #10b3f0",
        }}
      >
        <h3 style={{ marginBottom: "1rem", fontSize: "18px" }}>
          ⭐ Referral Program Benefits
        </h3>

        <div style={{ marginBottom: "1rem" }}>
          <strong>How to Earn:</strong>
          <ol style={{ margin: "0.5rem 0 0 1.5rem", color: "#666", lineHeight: "1.6" }}>
            <li>Share your exclusive referral code with friends</li>
            <li>When they become Founding Members, you earn $50 store credit</li>
            <li>Use store credit toward future purchases</li>
          </ol>
        </div>

        <div>
          <strong>Founder Exclusive Perks:</strong>
          <ul style={{ margin: "0.5rem 0 0 1.5rem", color: "#666", lineHeight: "1.6" }}>
            <li>✓ Lifetime access to all features</li>
            <li>✓ Early access to new features</li>
            <li>✓ Exclusive "Founding Member" badge</li>
            <li>✓ Priority support (lifetime)</li>
            <li>✓ Earn $50 per referral</li>
            <li>✓ Featured on Founding Wall</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
