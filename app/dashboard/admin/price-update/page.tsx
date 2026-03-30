"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isAdminEmail } from "@/lib/adminAccess";
import styles from "./price-update.module.css";

interface RunRecord {
  id: string;
  status: "processing" | "completed" | "failed";
  totalUsers: number;
  processedUsers: number;
  totalUpdated: number;
  totalFailed: number;
  totalSkipped: number;
  startedAt: string | null;
  completedAt: string | null;
  triggeredBy: string;
  staleOnly: boolean;
  batchId: string;
}

interface Stats {
  totalCards: number;
  staleCards: number;
  freshCards: number;
  totalUsers: number;
  pricechartingConfigured: boolean;
  recentRuns: RunRecord[];
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: RunRecord["status"] }) {
  const cls =
    status === "completed"
      ? styles.statusCompleted
      : status === "failed"
      ? styles.statusFailed
      : styles.statusProcessing;
  return <span className={`${styles.statusBadge} ${cls}`}>{status}</span>;
}

export default function PriceUpdatePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [staleOnly, setStaleOnly] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error" | "processing";
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdminEmail(user.email)) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const loadStats = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/bulk-price-update", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("[PriceUpdatePage] Failed to load stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleRunUpdate = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setRunning(true);
    setResultMessage({ type: "processing", title: "Running…", detail: "Fetching PriceCharting values for all cards. This may take a few minutes." });

    try {
      const token = await currentUser.getIdToken();
      const body: Record<string, unknown> = { staleOnly };
      if (targetUserId.trim()) {
        body.userId = targetUserId.trim();
      }

      const response = await fetch("/api/admin/bulk-price-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Bulk update failed");
      }

      setResultMessage({
        type: "success",
        title: `Updated ${data.totalUpdated} card${data.totalUpdated === 1 ? "" : "s"}`,
        detail: `${data.processedUsers} user${data.processedUsers === 1 ? "" : "s"} processed · ${data.totalFailed} failed · ${data.totalSkipped} skipped (fresh)`,
      });

      void loadStats();
    } catch (err) {
      setResultMessage({
        type: "error",
        title: "Update failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading || !user || !isAdminEmail(user.email)) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Admin Tools</p>
          <h1 className={styles.title}>Bulk PriceCharting Update</h1>
        </div>
        <Link href="/dashboard/admin" className={styles.backLink}>
          ← Admin
        </Link>
      </header>

      {/* Stats */}
      {statsLoading ? (
        <p className={styles.loading}>Loading stats…</p>
      ) : stats ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Total Cards</p>
            <p className={styles.statValue}>{stats.totalCards.toLocaleString()}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Stale / Unpriced</p>
            <p className={`${styles.statValue} ${stats.staleCards > 0 ? styles.statAlert : styles.statGood}`}>
              {stats.staleCards.toLocaleString()}
            </p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Fresh (≤24 h)</p>
            <p className={`${styles.statValue} ${styles.statGood}`}>{stats.freshCards.toLocaleString()}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Total Users</p>
            <p className={styles.statValue}>{stats.totalUsers.toLocaleString()}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>PriceCharting API</p>
            <p className={`${styles.statValue} ${stats.pricechartingConfigured ? styles.statGood : styles.statAlert}`}>
              {stats.pricechartingConfigured ? "✓ On" : "✗ Off"}
            </p>
          </div>
        </div>
      ) : null}

      {/* Result banner */}
      {resultMessage && (
        <div
          className={`${styles.resultBanner} ${
            resultMessage.type === "success"
              ? styles.resultBannerSuccess
              : resultMessage.type === "error"
              ? styles.resultBannerError
              : styles.resultBannerProcessing
          }`}
        >
          <div>
            <p className={styles.resultBannerTitle}>{resultMessage.title}</p>
            <p className={styles.resultBannerMeta}>{resultMessage.detail}</p>
          </div>
        </div>
      )}

      {/* Control panel */}
      <div className={styles.controlPanel}>
        <h2 className={styles.controlTitle}>Run Price Update</h2>

        <div className={styles.controlRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={staleOnly}
              onChange={(e) => setStaleOnly(e.target.checked)}
              disabled={running}
            />
            Skip cards updated in the last 24 hours (recommended)
          </label>
        </div>

        <div className={styles.controlRow}>
          <input
            type="text"
            className={styles.userIdInput}
            placeholder="Optional: limit to one User ID (leave blank for all users)"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            disabled={running}
          />
        </div>

        <div className={styles.controlRow}>
          <button
            className={styles.runButton}
            onClick={handleRunUpdate}
            disabled={running || !stats?.pricechartingConfigured}
          >
            {running ? "Updating…" : targetUserId.trim() ? "Update This User's Cards" : "Update All Cards"}
          </button>
        </div>

        <p className={styles.warningNote}>
          Each card is looked up individually on PriceCharting. Large collections take several minutes. Do not close this tab while running.
          {!stats?.pricechartingConfigured && " ⚠ PRICECHARTING_API_KEY is not configured — updates will not work."}
        </p>
      </div>

      {/* Recent runs */}
      <div className={styles.runsSection}>
        <h2 className={styles.runsSectionTitle}>Recent Bulk Runs</h2>
        {stats && stats.recentRuns.length > 0 ? (
          <table className={styles.runsTable}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Updated</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Users</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRuns.map((run) => (
                <tr key={run.id}>
                  <td><StatusBadge status={run.status} /></td>
                  <td>{run.totalUpdated.toLocaleString()}</td>
                  <td>{run.totalFailed.toLocaleString()}</td>
                  <td>{run.totalSkipped.toLocaleString()}</td>
                  <td>{run.processedUsers}/{run.totalUsers}</td>
                  <td>{formatDateShort(run.startedAt)}</td>
                  <td>{formatDateShort(run.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.noRuns}>No bulk runs yet.</p>
        )}
      </div>
    </div>
  );
}
