"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { getLastRefreshTime, needsRefresh } from "@/lib/cards";
import styles from "./RefreshCollectionButton.module.css";

export function RefreshCollectionButton() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkRefreshStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const lastRefreshTime = await getLastRefreshTime(user.uid);
        setLastRefresh(lastRefreshTime);
        
        const shouldRefresh = await needsRefresh(user.uid);
        setNeedsUpdate(shouldRefresh);
      } catch (err) {
        console.error("Error checking refresh status:", err);
      }
    };

    checkRefreshStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkRefreshStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to refresh collection values");
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/refresh-collection-values?userId=${user.uid}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        let message = "Failed to refresh collection values";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            message = errorData.error;
          }
        } catch {
        }
        throw new Error(message);
      }

      await response.json();
      
      setLastRefresh(new Date());
      setNeedsUpdate(false);
      
      // Reload the page to show updated values
      window.location.reload();
    } catch (err) {
      console.error("Error refreshing collection:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh collection");
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastRefresh = () => {
    if (!lastRefresh) return "Never refreshed";
    
    const now = new Date();
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return "Just now";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        <span className={styles.label}>Last updated:</span>
        <span className={styles.time}>{formatLastRefresh()}</span>
      </div>
      
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`${styles.button} ${needsUpdate ? styles.needsUpdate : ''}`}
        title="Refresh collection values with current market prices"
      >
        {isRefreshing ? (
          <>
            <span className={styles.spinner}>↻</span> Refreshing...
          </>
        ) : (
          <>
            🔄 {needsUpdate ? "Update Available" : "Refresh Values"}
          </>
        )}
      </button>
      
      {error && <div className={styles.error}>{error}</div>}
      
      {needsUpdate && !isRefreshing && (
        <div className={styles.notification}>
          💡 Your collection values are over 24 hours old. Click to update!
        </div>
      )}
    </div>
  );
}
