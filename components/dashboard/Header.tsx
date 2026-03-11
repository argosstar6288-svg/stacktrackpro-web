"use client";

import Link from "next/link";
import { useCurrentUser } from "../../lib/useCurrentUser";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useCurrentUser();

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <header className="dashboard-topbar">
      <div className="topbar-left">
        <button className="topbar-menu" onClick={onMenuToggle} aria-label="Open menu">
          ☰
        </button>
        <div className="topbar-search-wrap">
          <input className="topbar-search" placeholder="Search cards..." />
        </div>
      </div>

      <div className="topbar-right">
        <button className="topbar-action" aria-label="Notifications">
          Notifications 🔔
        </button>
        <Link className="topbar-scan" href="/dashboard/scan">
          Scan Card 📷
        </Link>
        <div className="topbar-profile">{displayName}</div>
      </div>
    </header>
  );
}
