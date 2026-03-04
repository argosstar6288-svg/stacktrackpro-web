"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { isAdminEmail } from "../../lib/adminAccess";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Live Auctions", href: "/auctions/live" },
  { label: "Collection", href: "/dashboard/collection" },
  { label: "Market", href: "/dashboard/market" },
  { label: "Marketplace", href: "/dashboard/marketplace" },
  { label: "Pricing", href: "/dashboard/pricing" },
  { label: "Inbox", href: "/dashboard/inbox" },
  { label: "Watchlist", href: "/dashboard/watchlist" },
  { label: "Help", href: "/dashboard/help" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default function Sidebar() {
  const { user } = useCurrentUser();
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setInboxUnread(0);
      return;
    }

    const messagesRef = collectionGroup(db, "messages");
    const unreadQuery = query(
      messagesRef,
      where("recipientId", "==", user.uid),
      where("readAt", "==", null)
    );

    const unsubscribe = onSnapshot(
      unreadQuery,
      (snapshot) => {
        setInboxUnread(snapshot.size);
      },
      (error) => {
        console.error("Error loading inbox unread count:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <img src="/stacktrack-logo.png" alt="StackTrack" className="brand-logo" />
        </div>
        <div>
          <p className="brand-title">StackTrack</p>
          <p className="brand-subtitle">Pro Dashboard</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {[
          ...navItems,
          ...(isAdminEmail(user?.email)
            ? [{ label: "Admin", href: "/dashboard/admin" }]
            : []),
        ].map((item) => {
          const showBadge = item.href === "/dashboard/inbox" && inboxUnread > 0;
          return (
            <Link key={item.href} className="sidebar-link" href={item.href}>
              <span className="sidebar-link-content">
                {item.label}
                {showBadge && (
                  <span className="sidebar-link-badge">
                    {inboxUnread > 99 ? "99+" : inboxUnread}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <p className="sidebar-user">Logged in as</p>
        <p className="sidebar-user-name">Alex Morgan</p>
      </div>
    </aside>
  );
}
