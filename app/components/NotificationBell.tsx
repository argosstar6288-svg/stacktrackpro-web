"use client";

import { useState, useEffect } from "react";
import styles from "./notification-bell.module.css";
import { getUnreadNotifications, Notification } from "../lib/retention";
import { useCurrentUser } from "../lib/useCurrentUser";
import Link from "next/link";

export function NotificationBell() {
  const { user } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000); // Refresh every 30 seconds

      loadNotifications();
      return () => clearInterval(interval);
    }
  }, [user?.uid]);

  const loadNotifications = async () => {
    if (!user?.uid) return;
    try {
      const notifs = await getUnreadNotifications(user.uid);
      setUnreadCount(notifs.length);
      setRecentNotifications(notifs.slice(0, 3)); // Show last 3
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  return (
    <div className={styles.notificationBell}>
      <button
        className={styles.bellButton}
        onClick={() => setShowDropdown(!showDropdown)}
        title={`${unreadCount} unread notifications`}
      >
        🔔
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>Notifications</h3>
            {unreadCount > 0 && <span className={styles.count}>{unreadCount} new</span>}
          </div>

          {recentNotifications.length === 0 ? (
            <div className={styles.empty}>No new notifications</div>
          ) : (
            <div className={styles.notificationsList}>
              {recentNotifications.map(notif => (
                <div key={notif.id} className={styles.notifItem}>
                  <div className={styles.notifTitle}>{notif.title}</div>
                  <div className={styles.notifMessage}>{notif.message}</div>
                </div>
              ))}
            </div>
          )}

          <Link href="/dashboard/notifications" className={styles.viewAllLink}>
            View All Notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
