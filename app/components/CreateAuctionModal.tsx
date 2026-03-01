"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCurrentUser } from "../lib/useCurrentUser";

interface CreateAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateAuctionModal({ isOpen, onClose, onSuccess }: CreateAuctionModalProps) {
  const { user } = useCurrentUser();
  const [cardName, setCardName] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [bidIncrement, setBidIncrement] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("You must be logged in");
      return;
    }

    if (!cardName || !startingBid || !bidIncrement || !endTime) {
      setError("All fields are required");
      return;
    }

    const endDate = new Date(endTime);
    if (endDate <= new Date()) {
      setError("End time must be in the future");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "auctions"), {
        cardName,
        currentBid: Number(startingBid),
        bidIncrement: Number(bidIncrement),
        endTime,
        createdBy: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
        highestBidderId: null,
      });

      setCardName("");
      setStartingBid("");
      setBidIncrement("");
      setEndTime("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create auction");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "#1a1a1a", padding: 24, borderRadius: 8, maxWidth: 500, width: "90%", color: "#fff" }}>
        <h2 style={{ marginBottom: 16 }}>Create Auction</h2>
        
        {error && <div style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Card Name</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 4, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Starting Bid ($)</label>
            <input
              type="number"
              step="0.01"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 4, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Bid Increment ($)</label>
            <input
              type="number"
              step="0.01"
              value={bidIncrement}
              onChange={(e) => setBidIncrement(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 4, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 4, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 1, padding: 10, borderRadius: 4, background: "#10b3f0", color: "#000", border: "none", fontWeight: "bold", cursor: "pointer" }}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: 10, borderRadius: 4, background: "#555", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
