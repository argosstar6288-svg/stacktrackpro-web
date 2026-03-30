"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { BreakRecord, BreakSpot, getFillStats } from "@/lib/breaks";
import styles from "../breaks.module.css";

const CHAT_PLACEHOLDER = [
  "Host: Break starts in 5 minutes.",
  "CollectorMike: Good luck everyone",
  "CardQueen: Lets pull heat",
  "Host: Randomizer complete."
];

export default function BreakLivePage() {
  const params = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const breakId = useMemo(() => String(params?.id || "").trim(), [params]);

  const [record, setRecord] = useState<BreakRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hitForm, setHitForm] = useState({
    cardName: "",
    player: "",
    team: "",
    setName: "",
    estimatedValue: 0,
    assignedSpotNumber: 1,
    imageUrl: "",
  });

  const loadBreak = async () => {
    if (!breakId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/breaks/${encodeURIComponent(breakId)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to load break");
      setRecord(payload.break || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load break");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBreak();
    const interval = setInterval(() => {
      void loadBreak();
    }, 9000);

    return () => clearInterval(interval);
  }, [breakId]);

  const joinBreak = async () => {
    if (!record || !user) {
      setError("Sign in to join this break");
      return;
    }

    setError("");
    setNotice("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`/api/breaks/${encodeURIComponent(record.id)}/join`, {
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
      await loadBreak();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join break");
    }
  };

  const submitHit = async (event: FormEvent) => {
    event.preventDefault();
    if (!record) return;

    setError("");
    setNotice("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`/api/breaks/${encodeURIComponent(record.id)}/hits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(hitForm),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to record hit");

      setNotice("Hit recorded and card assigned.");
      setHitForm((prev) => ({ ...prev, cardName: "", player: "", estimatedValue: 0 }));
      await loadBreak();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record hit");
    }
  };

  if (loading) {
    return <div className={styles.empty}>Loading break...</div>;
  }

  if (!record) {
    return <div className={styles.empty}>Break not found.</div>;
  }

  const fill = getFillStats(record.spots || []);
  const isHost = user?.uid && record.sellerId === user.uid;
  const viewerCount = Math.max(8, fill.filled * 3 + 11);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Live Break</p>
          <h1 className={styles.title}>{record.title}</h1>
          <p className={styles.meta}>{record.productName} | {record.breakType.toUpperCase()} | Status: {record.status}</p>
        </div>
        <button className={styles.joinBtn} type="button" onClick={() => void joinBreak()} disabled={fill.open === 0}>
          {fill.open === 0 ? "Sold Out" : "Join Break"}
        </button>
      </div>

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.liveLayout}>
        <section className={styles.videoCard}>
          <p className={styles.meta}>Live viewers: {viewerCount}</p>
          <div className={styles.videoStage}>Live Stream Placeholder</div>

          <div className={styles.chatCard}>
            <h3 className={styles.sectionTitle}>Live Chat</h3>
            <div className={styles.chatFeed}>
              {CHAT_PLACEHOLDER.map((line) => (
                <p className={styles.chatLine} key={line}>{line}</p>
              ))}
            </div>
          </div>
        </section>

        <aside className={styles.sideCard}>
          <h3 className={styles.sectionTitle}>Spots ({fill.filled}/{fill.total})</h3>
          <div className={styles.spotList}>
            {(record.spots || []).map((spot: BreakSpot) => (
              <div className={styles.spotRow} key={spot.spotNumber}>
                <div><strong>{spot.label}</strong></div>
                <div>{spot.ownerDisplayName || "Open"}</div>
              </div>
            ))}
          </div>

          <h3 className={styles.sectionTitle} style={{ marginTop: 12 }}>Hits Feed</h3>
          <div className={styles.hitList}>
            {(record.hits || []).length === 0 ? (
              <div className={styles.spotRow}>No hits yet.</div>
            ) : (
              record.hits.map((hit) => (
                <div className={styles.hitRow} key={hit.id}>
                  <div><strong>{hit.cardName}</strong></div>
                  <div>{hit.assignedUserName} | Spot #{hit.assignedSpotNumber}</div>
                  <div className={styles.hitValue}>${Number(hit.estimatedValue || 0).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          {isHost && (
            <form className={styles.hitForm} onSubmit={submitHit}>
              <h3 className={styles.sectionTitle} style={{ marginTop: 12 }}>Record Hit</h3>
              <input
                className={styles.input}
                placeholder="Card name"
                value={hitForm.cardName}
                onChange={(event) => setHitForm((prev) => ({ ...prev, cardName: event.target.value }))}
                required
              />
              <input
                className={styles.input}
                placeholder="Player"
                value={hitForm.player}
                onChange={(event) => setHitForm((prev) => ({ ...prev, player: event.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Team"
                value={hitForm.team}
                onChange={(event) => setHitForm((prev) => ({ ...prev, team: event.target.value }))}
                required
              />
              <input
                className={styles.input}
                placeholder="Set"
                value={hitForm.setName}
                onChange={(event) => setHitForm((prev) => ({ ...prev, setName: event.target.value }))}
              />
              <input
                className={styles.input}
                type="number"
                min={0}
                step="0.01"
                placeholder="Estimated value"
                value={hitForm.estimatedValue}
                onChange={(event) => setHitForm((prev) => ({ ...prev, estimatedValue: Number(event.target.value || 0) }))}
              />
              <select
                className={styles.select}
                value={hitForm.assignedSpotNumber}
                onChange={(event) => setHitForm((prev) => ({ ...prev, assignedSpotNumber: Number(event.target.value || 1) }))}
              >
                {(record.spots || []).map((spot: BreakSpot) => (
                  <option key={spot.spotNumber} value={spot.spotNumber}>
                    #{spot.spotNumber} - {spot.label}
                  </option>
                ))}
              </select>
              <button className={styles.submit} type="submit">Assign Card</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
