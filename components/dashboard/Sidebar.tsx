"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { isAdminEmail } from "../../lib/adminAccess";

const navItems = [
  { icon: "🏠", label: "Dashboard", href: "/dashboard" },
  { icon: "📷", label: "Scan Card", href: "/dashboard/scan" },
  { icon: "📂", label: "Collection", href: "/dashboard/collection" },
  { icon: "🛒", label: "Marketplace", href: "/dashboard/marketplace" },
  { icon: "🔥", label: "Auctions", href: "/auctions/live" },
  { icon: "📈", label: "Price Trends", href: "/dashboard/market" },
  { icon: "⭐", label: "Watchlist", href: "/dashboard/watchlist" },
  { icon: "⚙", label: "Settings", href: "/dashboard/settings" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user } = useCurrentUser();
  const pathname = usePathname();
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

  const isActiveLink = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/dashboard/scan") {
      return pathname === "/dashboard/scan" || pathname === "/dashboard/collection/add";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {isOpen && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`dashboard-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <img src="/stacktrack-logo.png" alt="StackTrack" className="brand-logo" />
        </div>
        <div>
          <p className="brand-title">StackTrack</p>
          <p className="brand-subtitle">Collector OS</p>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </div>
      <nav className="sidebar-nav">
        {[
          ...navItems,
          ...(isAdminEmail(user?.email)
            ? [{ icon: "🛠", label: "Admin", href: "/dashboard/admin" }]
            : []),
        ].map((item) => {
          const showBadge = item.href === "/dashboard/inbox" && inboxUnread > 0;
          return (
            <Link
              key={item.href}
              className={`sidebar-link ${isActiveLink(item.href) ? "active" : ""}`}
              href={item.href}
              onClick={onClose}
            >
              <span className="sidebar-link-content">
                <span className="sidebar-link-text">
                  <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </span>
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
        >
          Log Out
        </button>
      </div>
      </aside>
    </>
  );
}
