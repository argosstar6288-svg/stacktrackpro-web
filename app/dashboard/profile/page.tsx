"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AppShell from "@/components/AppShell";

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserName(user.displayName || "User");
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 60 }}>
          <h2>Loading...</h2>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, rgba(124, 45, 18, 0.2), rgba(15, 23, 42, 1), rgba(30, 58, 138, 0.3))",
        padding: "1rem",
        borderRadius: 20
      }}>
        {/* HERO SECTION */}
        <div style={{
          background: "#0a2f5e",
          padding: 40,
          borderRadius: 20,
          marginBottom: 40,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
        }}>
          <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: 0, marginBottom: 15 }}>
            👤 {userName}
          </h1>
          <p style={{ fontSize: "1.2rem", opacity: 0.9, margin: "5px 0" }}>
            ⭐ Free User
          </p>
          <p style={{ fontSize: "1.1rem", opacity: 0.8, margin: "5px 0" }}>
            📍 Lives in Alberta, Canada
          </p>
          <p style={{ fontSize: "1rem", opacity: 0.7, marginTop: 15 }}>
            📧 {auth.currentUser?.email}
          </p>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div style={{ display: "flex", gap: 40, marginBottom: 40 }}>
          <div className="glass-panel" style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 20 }}>
              ⭐ Collection Favorites
            </h3>
            <div style={{ display: "grid", gap: 15 }}>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                padding: 15,
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span>🎴 Pokemon Cards</span>
                <span style={{ color: "var(--neon)" }}>127 items</span>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                padding: 15,
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span>🃏 Magic: The Gathering</span>
                <span style={{ color: "var(--neon)" }}>89 items</span>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.05)",
                padding: 15,
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span>🦸 Yu-Gi-Oh!</span>
                <span style={{ color: "var(--neon)" }}>43 items</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 20 }}>
              ⭐ Reviews & Ratings
            </h3>
            <div style={{ textAlign: "center", marginBottom: 25 }}>
              <div style={{ fontSize: "4rem", marginBottom: 10 }}>⭐</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--neon)" }}>4.8</div>
              <div style={{ opacity: 0.7 }}>Based on 47 reviews</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>⭐⭐⭐⭐⭐</span>
                <span>38 reviews</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>⭐⭐⭐⭐</span>
                <span>7 reviews</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>⭐⭐⭐</span>
                <span>2 reviews</span>
              </div>
            </div>
          </div>
        </div>

        {/* STATS SECTION */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          <div className="glass-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", color: "var(--blue)" }}>50</div>
            <div style={{ opacity: 0.8 }}>Total Items</div>
          </div>
          <div className="glass-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", color: "var(--orange)" }}>8</div>
            <div style={{ opacity: 0.8 }}>Active Auctions</div>
          </div>
          <div className="glass-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", color: "var(--neon)" }}>12</div>
            <div style={{ opacity: 0.8 }}>Purchases</div>
          </div>
          <div className="glass-panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", color: "var(--pink)" }}>5</div>
            <div style={{ opacity: 0.8 }}>Sales</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
