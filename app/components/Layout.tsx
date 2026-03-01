'use client';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 90,
        background: "#000",
        paddingTop: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 35,
        borderRight: "2px solid rgba(255, 255, 255, 0.1)"
      }}>
        <div style={{ fontSize: "2rem", cursor: "pointer" }} title="Profile">👤</div>
        <div style={{ fontSize: "2rem", cursor: "pointer" }} title="Notifications">🔔</div>
        <div style={{ fontSize: "2rem", cursor: "pointer" }} title="Portfolio">📁</div>
        <div style={{ fontSize: "2rem", cursor: "pointer" }} title="Gallery">📷</div>
        <div style={{ fontSize: "2rem", cursor: "pointer" }} title="Legal">⚖️</div>
        <div style={{ fontSize: "2rem", cursor: "pointer", marginTop: "auto", marginBottom: 20 }} title="Back">🔙</div>
      </aside>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: 40 }}>
        {children}
      </div>
    </div>
  );
}
