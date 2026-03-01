"use client";

import { useState, useEffect } from "react";
import styles from "./notifications.module.css";
import {
  getUnreadNotifications,
  markNotificationAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  Notification,
  NotificationPreferences,
} from "../../lib/retention";
import { useCurrentUser } from "../../lib/useCurrentUser";

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadNotifications();
      loadPreferences();
    }
  }, [user?.uid]);

  const loadNotifications = async () => {
    try {
      if (user?.uid) {
        const notifs = await getUnreadNotifications(user.uid);
        setNotifications(notifs);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      if (user?.uid) {
        const prefs = await getNotificationPreferences(user.uid);
        setPreferences(prefs);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (user?.uid) {
      await markNotificationAsRead(user.uid, notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || !user?.uid) return;

    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await updateNotificationPreferences(user.uid, updated);
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "deal_alert":
        return "🎯";
      case "recommendation":
        return "💡";
      case "auction_ending":
        return "⏰";
      case "price_drop":
        return "📉";
      case "outbid":
        return "💥";
      case "watchlist_activity":
        return "❤️";
      default:
        return "🔔";
    }
  };

  const getNotificationTypeLabel = (type: Notification["type"]) => {
    return type
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading notifications...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🔔 Notifications</h1>
        <p>Stay updated on your auctions, deals, and recommendations</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${!showPreferences ? styles.active : ""}`}
          onClick={() => setShowPreferences(false)}
        >
          Notifications ({notifications.length})
        </button>
        <button
          className={`${styles.tab} ${showPreferences ? styles.active : ""}`}
          onClick={() => setShowPreferences(true)}
        >
          Preferences
        </button>
      </div>

      {!showPreferences ? (
        <div className={styles.notificationsSection}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>
              <p>No new notifications</p>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className={styles.notificationsList}>
              {notifications.map(notif => (
                <div key={notif.id} className={styles.notificationItem}>
                  <div className={styles.notifIcon}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className={styles.notifContent}>
                    <div className={styles.notifHeader}>
                      <h3>{notif.title}</h3>
                      <span className={styles.notifType}>
                        {getNotificationTypeLabel(notif.type)}
                      </span>
                    </div>
                    <p className={styles.notifMessage}>{notif.message}</p>
                    <div className={styles.notifFooter}>
                      <span className={styles.notifTime}>
                        {Math.round((Date.now() - notif.createdAt.toMillis()) / (1000 * 60))} min ago
                      </span>
                      {notif.actionUrl && (
                        <a href={notif.actionUrl} className={styles.notifAction}>
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    className={styles.dismissBtn}
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.preferencesSection}>
          {preferences && (
            <>
              <div className={styles.prefGroup}>
                <h3>Notification Types</h3>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.dealAlerts}
                      onChange={(e) => handleTogglePreference("dealAlerts", e.target.checked)}
                    />
                    <span>Deal Alerts</span>
                  </label>
                  <p>Get notified when great deals appear</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.recommendations}
                      onChange={(e) => handleTogglePreference("recommendations", e.target.checked)}
                    />
                    <span>Recommendations</span>
                  </label>
                  <p>Personalized item recommendations based on your interests</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.auctionEnding}
                      onChange={(e) => handleTogglePreference("auctionEnding", e.target.checked)}
                    />
                    <span>Auction Ending</span>
                  </label>
                  <p>Reminders for auctions you're bidding on or watching</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.priceDrops}
                      onChange={(e) => handleTogglePreference("priceDrops", e.target.checked)}
                    />
                    <span>Price Drops</span>
                  </label>
                  <p>Alert when items on your watchlist drop in price</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.outbidNotifications}
                      onChange={(e) => handleTogglePreference("outbidNotifications", e.target.checked)}
                    />
                    <span>Outbid Notifications</span>
                  </label>
                  <p>Get notified when you're outbid on an auction</p>
                </div>
              </div>

              <div className={styles.prefGroup}>
                <h3>Delivery Method</h3>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.pushNotifications}
                      onChange={(e) => handleTogglePreference("pushNotifications", e.target.checked)}
                    />
                    <span>In-App Notifications</span>
                  </label>
                  <p>See alerts when you're using the app</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications}
                      onChange={(e) => handleTogglePreference("emailNotifications", e.target.checked)}
                    />
                    <span>Email Notifications</span>
                  </label>
                  <p>Receive alerts via email</p>
                </div>
                <div className={styles.prefOption}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.dailyDigest}
                      onChange={(e) => handleTogglePreference("dailyDigest", e.target.checked)}
                    />
                    <span>Daily Digest</span>
                  </label>
                  <p>Receive a summary of all notifications at</p>
                  {preferences.dailyDigest && (
                    <input
                      type="time"
                      value={preferences.digestTime}
                      onChange={(e) => handleTogglePreference("digestTime", e.target.value as any)}
                      className={styles.timeInput}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
