"use client";

import AppShell from "@/components/AppShell";
import FolderCard from "@/components/FolderCard";

export default function CataloguePage() {
  return (
    <AppShell>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, rgba(124, 45, 18, 0.2), rgba(15, 23, 42, 1), rgba(30, 58, 138, 0.3))",
        padding: "1rem",
        borderRadius: 20
      }}>
      <h1 className="page-title">📁 My Catalogue</h1>
      
      <p style={{ fontSize: "1.2rem", marginBottom: 40, opacity: 0.9 }}>
        Organize your collection by game, type, or custom folders
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: 30
      }}>
        <FolderCard title="Pokemon" subtitle="Water types collection" />
        <FolderCard title="Magic: The Gathering" subtitle="Red & Blue deck" />
        <FolderCard title="Yu-Gi-Oh!" subtitle="Dragon archetype" />
        <FolderCard title="Sports Cards" subtitle="Basketball legends" />
        <FolderCard title="Rare Finds" subtitle="PSA 10 graded cards" />
        <FolderCard title="Trade Binder" subtitle="Cards for trade" />
      </div>

      <button 
        className="cta-green" 
        style={{ marginTop: 40 }}
        onClick={() => alert("Create new folder functionality coming soon!")}
      >
        ➕ Create New Folder
      </button>
      </div>
    </AppShell>
  );
}
