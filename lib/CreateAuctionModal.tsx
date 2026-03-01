"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { Card, useUserCards } from "@/lib/cards";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface CreateAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuctionCreated: () => void;
}

export function CreateAuctionModal({
  isOpen,
  onClose,
  onAuctionCreated,
}: CreateAuctionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { cards } = useUserCards();
  const [formData, setFormData] = useState({
    cardId: "",
    cardName: "",
    startingBid: "",
    durationHours: "24",
    description: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCardSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCardId = e.target.value;
    const selectedCard = cards?.find((c) => c.id === selectedCardId);
    setFormData((prev) => ({
      ...prev,
      cardId: selectedCardId,
      cardName: selectedCard?.name || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!auth.currentUser) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    if (!formData.cardId || !formData.startingBid || !formData.durationHours) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const now = new Date();
      const startTime = Timestamp.fromDate(now);
      const endDate = new Date(
        now.getTime() + parseInt(formData.durationHours) * 60 * 60 * 1000
      );
      const endTime = Timestamp.fromDate(endDate);

      await addDoc(collection(db, "auctions"), {
        sellerId: auth.currentUser.uid,
        cardName: formData.cardName,
        cardId: formData.cardId,
        startingBid: parseFloat(formData.startingBid),
        startTime,
        endTime,
        status: "active",
        description: formData.description,
        createdAt: serverTimestamp(),
        currentBid: parseFloat(formData.startingBid),
        totalBids: 0,
      });

      setFormData({
        cardId: "",
        cardName: "",
        startingBid: "",
        durationHours: "24",
        description: "",
      });

      onAuctionCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "10px",
          padding: "30px",
          width: "90%",
          maxWidth: "500px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          color: "white",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: "20px", color: "#10b3f0" }}>Create Auction</h2>

        {error && (
          <div
            style={{
              backgroundColor: "#ff4444",
              color: "white",
              padding: "10px",
              borderRadius: "5px",
              marginBottom: "15px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Card Selection */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Select Card *
            </label>
            {(cards || []).length > 0 ? (
              <select
                name="cardId"
                value={formData.cardId}
                onChange={handleCardSelect}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "5px",
                  border: "1px solid #333",
                  backgroundColor: "#0a0a0a",
                  color: "white",
                  boxSizing: "border-box",
                }}
                required
              >
                <option value="">Choose a card...</option>
                {(cards || []).map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} - ${card.value.toLocaleString()}
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "5px",
                  border: "1px solid #333",
                  backgroundColor: "#0a0a0a",
                  color: "#999",
                }}
              >
                No cards available. Add cards to your collection first.
              </div>
            )}
          </div>

          {/* Starting Bid */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Starting Bid ($) *
            </label>
            <input
              type="number"
              name="startingBid"
              value={formData.startingBid}
              onChange={handleChange}
              placeholder="e.g., 100"
              min="0"
              step="0.01"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "white",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          {/* Duration */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Auction Duration *
            </label>
            <select
              name="durationHours"
              value={formData.durationHours}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "white",
                boxSizing: "border-box",
              }}
              required
            >
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add any notes about the card's condition or other details..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "white",
                boxSizing: "border-box",
                fontFamily: "inherit",
                minHeight: "80px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              disabled={loading || (cards || []).length === 0}
              style={{
                flex: 1,
                padding: "12px",
                background: "#10b3f0",
                color: "black",
                border: "none",
                borderRadius: "5px",
                cursor: loading || (cards || []).length === 0 ? "not-allowed" : "pointer",
                fontWeight: "bold",
                opacity: loading || (cards || []).length === 0 ? 0.6 : 1,
              }}
            >
              {loading ? "Creating..." : "Create Auction"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                background: "#333",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
