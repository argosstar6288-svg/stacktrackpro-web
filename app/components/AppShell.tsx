"use client";

import Link from "next/link";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>

      {/* Sidebar */}
      <aside style={{
        width: 90,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 20,
        gap: 30
      }}>
        <div style={{ fontWeight: 800, fontSize: "1.5rem" }}>📦</div>
        <Link href="/dashboard/profile" style={{ fontSize: "1.5rem" }}>👤</Link>
        <Link href="/notifications" style={{ fontSize: "1.5rem" }}>🔔</Link>
        <Link href="/inbox" style={{ fontSize: "1.5rem" }}>✉️</Link>
        <Link href="/catalogue" style={{ fontSize: "1.5rem" }}>📁</Link>
        <Link href="/scan" style={{ fontSize: "1.5rem" }}>📷</Link>
        <Link href="/auction" style={{ fontSize: "1.5rem" }}>⚖️</Link>
        <Link href="/" style={{ fontSize: "1.5rem", marginTop: "auto", marginBottom: 20 }}>↩️</Link>
      </aside>

      <div style={{ flex: 1 }}>

        {/* Top bar */}
        <div style={{
          background: "#000",
          padding: "15px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid rgba(255, 255, 255, 0.1)"
        }}>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem" }}>StackTrack</h2>
          <input
            placeholder="Search auctions, cards..."
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              width: 300,
              fontFamily: "'Baloo 2', cursive",
              fontSize: "1rem"
            }}
          />
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: "50%", 
            background: "var(--blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold"
          }}>
            U
          </div>
        </div>

        <div style={{ padding: 40 }}>
          {children}
        </div>

      </div>
    </div>
  );
}
