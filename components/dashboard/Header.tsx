"use client";

import { useCurrentUser } from "../../lib/useCurrentUser";

export default function Header() {
  const { user } = useCurrentUser();
  
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <header className="dashboard-header">
      <div>
        <p className="header-eyebrow">Dashboard</p>
        <h1 className="header-title">Welcome back, {displayName}</h1>
      </div>
      <div className="header-actions">
        <button className="header-button" type="button">
          Generate Report
        </button>
        <button className="header-button header-button-secondary" type="button">
          New Auction
        </button>
      </div>
    </header>
  );
}
