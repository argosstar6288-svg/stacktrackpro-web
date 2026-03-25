"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import styles from "./RefreshCollectionButton.module.css";

export function RefreshCollectionButton() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [jobStatus, setJobStatus] = useState<"idle" | "queued" | "processing" | "completed">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkRefreshStatus = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/background-price-updater?userId=${user.uid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load updater status");
      }

      const payload = await response.json();
      const latestJob = payload?.latestJob || null;

      setNeedsUpdate(Number(payload?.cardsNeedingUpdate || 0) > 0);

      if (latestJob?.completedAt) {
        setLastRefresh(new Date(latestJob.completedAt));
      }

      if (latestJob?.status === "queued") {
        setJobStatus("queued");
        setStatusMessage("Background update is queued");
      } else if (latestJob?.status === "processing") {
        setJobStatus("processing");
        setStatusMessage("Background update is running");
      } else if (latestJob?.status === "completed") {
        setJobStatus("completed");
        setStatusMessage(
          `Last run updated ${Number(latestJob.updatedCards || 0)} card${Number(latestJob.updatedCards || 0) === 1 ? "" : "s"}`
        );
      } else {
        setJobStatus("idle");
        setStatusMessage(null);
      }
    } catch (err) {
      console.error("Error checking refresh status:", err);
    }
  }, []);

  useEffect(() => {
    void checkRefreshStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkRefreshStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkRefreshStatus]);

  const handleRefresh = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to update prices");
      return;
    }

    setIsRefreshing(true);
    setError(null);
    setStatusMessage("Fetching latest market prices...");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/background-price-updater", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "enqueue",
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to update prices");
      }

      const payload = await response.json();
      if (payload?.processedImmediately) {
        setJobStatus("completed");
        setLastRefresh(new Date());
        setNeedsUpdate(false);
        if (payload?.updatedCards > 0) {
          setStatusMessage(`✅ Updated ${payload.updatedCards} card price${payload.updatedCards === 1 ? "" : "s"}`);
        } else {
          setStatusMessage("✅ Prices are up to date");
        }
      } else {
        setJobStatus("queued");
        setStatusMessage("Background update queued. Checking progress...");
        setTimeout(() => {
          void checkRefreshStatus();
        }, 2000);
      }
    } catch (err) {
      console.error("Error refreshing collection:", err);
      setError(err instanceof Error ? err.message : "Failed to queue background update");
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
        title="Refresh card market prices"
      >
        {isRefreshing ? (
          <>
            <span className={styles.spinner}>↻</span> Updating prices...
          </>
        ) : (
          <>
            🔄 {needsUpdate ? "Update Prices" : "Refresh Prices"}
          </>
        )}
      </button>
      
      {error && <div className={styles.error}>{error}</div>}

      {statusMessage && !error && <div className={styles.notification}>{statusMessage}</div>}
      
      {needsUpdate && !isRefreshing && (
        <div className={styles.notification}>
          💡 Click "Update Prices" to fetch the latest market prices for your cards.
        </div>
      )}
    </div>
  );
}
