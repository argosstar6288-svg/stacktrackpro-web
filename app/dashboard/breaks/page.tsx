"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { BreakRecord, getFillStats } from "@/lib/breaks";
import styles from "./breaks.module.css";

export default function BreaksPage() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [breaks, setBreaks] = useState<BreakRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBreaks = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/breaks?limit=30", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to load breaks");
      setBreaks(Array.isArray(payload?.breaks) ? payload.breaks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load breaks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBreaks();
  }, []);

  const joinBreak = async (breakId: string) => {
    if (!user) {
      setError("Sign in to join breaks");
      return;
    }

    setNotice("");
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`/api/breaks/${encodeURIComponent(breakId)}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to join break");

      setNotice(`Joined spot #${payload.spotNumber}`);
      await loadBreaks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join break");
    }
  };

  const upcomingBreaks = useMemo(
    () => breaks.filter((item) => ["filling", "ready", "live"].includes(item.status)),
    [breaks]
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>StackTrack Breaks</p>
          <h1 className={styles.title}>Live + Automated + Safe</h1>
        </div>
        <Link className={styles.createBtn} href="/dashboard/breaks/create">
          Create Break
        </Link>
      </div>

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Loading breaks...</div>
      ) : upcomingBreaks.length === 0 ? (
        <div className={styles.empty}>No active breaks right now.</div>
      ) : (
        <div className={styles.grid}>
          {upcomingBreaks.map((item) => {
            const fill = getFillStats(item.spots || []);
            return (
              <article className={styles.card} key={item.id}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.meta}>{item.productName}</p>
                <p className={styles.meta}>
                  {item.breakType.toUpperCase()} | ${item.spotPrice.toFixed(2)} / spot
                </p>
                <p className={styles.meta}>
                  Host: {item.sellerName} | Status: {item.status}
                </p>
                <p className={styles.meta}>Starts: {new Date(item.scheduledAt).toLocaleString()}</p>

                <div className={styles.progressRow}>
                  <span>{fill.filled}/{fill.total} spots filled</span>
                  <span>{fill.percent}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${fill.percent}%` }} />
                </div>

                <div className={styles.actions}>
                  <Link className={styles.actionBtn} href={`/dashboard/breaks/${encodeURIComponent(item.id)}`}>
                    View Live
                  </Link>
                  <button
                    type="button"
                    className={styles.joinBtn}
                    onClick={() => void joinBreak(item.id)}
                    disabled={fill.open === 0 || item.status === "completed" || item.status === "cancelled"}
                  >
                    {fill.open === 0 ? "Sold Out" : "Join Break"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
