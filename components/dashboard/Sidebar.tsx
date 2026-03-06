"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
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
  const router = useRouter();
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
        <button 
          onClick={handleLogout}
          className="sidebar-logout-btn"
          style={{
            width: "100%",
            padding: "12px 20px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
          }}
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
