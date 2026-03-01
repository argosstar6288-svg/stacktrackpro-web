"use client";

import { useState } from "react";
import { createCard, updateCard, Card } from "../lib/cards";
import { useCurrentUser } from "../lib/useCurrentUser";

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialCard?: Card;
  isEditing?: boolean;
}

export function CardModal({ isOpen, onClose, onSuccess, initialCard, isEditing }: CardModalProps) {
  const { user } = useCurrentUser();
  const [name, setName] = useState(initialCard?.name || "");
  const [player, setPlayer] = useState(initialCard?.player || "");
  const [sport, setSport] = useState<Card["sport"]>(initialCard?.sport || "Baseball");
  const [brand, setBrand] = useState(initialCard?.brand || "");
  const [year, setYear] = useState(initialCard?.year?.toString() || new Date().getFullYear().toString());
  const [rarity, setRarity] = useState<Card["rarity"]>(initialCard?.rarity || "Common");
  const [condition, setCondition] = useState<Card["condition"]>(initialCard?.condition || "Good");
  const [value, setValue] = useState(initialCard?.value?.toString() || "");
  const [notes, setNotes] = useState(initialCard?.notes || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("You must be logged in");
      return;
    }

    if (!name || !player || !brand || !value) {
      setError("Name, player, brand, and value are required");
      return;
    }

    const cardValue = Number(value);
    const cardYear = Number(year);

    if (isNaN(cardValue) || cardValue < 0) {
      setError("Value must be a valid positive number");
      return;
    }

    if (isNaN(cardYear) || cardYear < 1900 || cardYear > new Date().getFullYear()) {
      setError("Year must be between 1900 and current year");
      return;
    }

    setLoading(true);

    try {
      const cardData = {
        name,
        player,
        sport,
        brand,
        year: cardYear,
        rarity,
        condition,
        value: cardValue,
        notes: notes || undefined,
      };

      if (isEditing && initialCard) {
        await updateCard(initialCard.id, cardData);
      } else {
        await createCard(user.uid, {
          ...cardData,
          imageUrl: undefined,
          folderId: undefined,
        });
      }

      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save card");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setPlayer("");
    setSport("Baseball");
    setBrand("");
    setYear(new Date().getFullYear().toString());
    setRarity("Common");
    setCondition("Good");
    setValue("");
    setNotes("");
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "#1a1a1a", padding: 32, borderRadius: 12, maxWidth: 600, width: "90%", color: "#fff", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ marginBottom: 24, color: "#10b3f0" }}>{isEditing ? "Edit Card" : "Add New Card"}</h2>

        {error && <div style={{ color: "#ff6b6b", marginBottom: 16, padding: 12, background: "#3a0a0a", borderRadius: 6 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Card Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 1952 Mickey Mantle"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Player Name *</label>
              <input
                type="text"
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
                placeholder="e.g., Mickey Mantle"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Brand *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Topps"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Year *</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as Card["sport"])}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              >
                <option>Baseball</option>
                <option>Basketball</option>
                <option>Football</option>
                <option>Hockey</option>
                <option>Soccer</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Rarity</label>
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as Card["rarity"])}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              >
                <option>Common</option>
                <option>Uncommon</option>
                <option>Rare</option>
                <option>Legendary</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Card["condition"])}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              >
                <option>Poor</option>
                <option>Fair</option>
                <option>Good</option>
                <option>Excellent</option>
                <option>Mint</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Value ($) *</label>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #555", backgroundColor: "#222", color: "#fff", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 1, padding: 12, borderRadius: 6, background: "#10b3f0", color: "#000", border: "none", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
            >
              {loading ? "Saving..." : isEditing ? "Update Card" : "Add Card"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              style={{ flex: 1, padding: 12, borderRadius: 6, background: "#555", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
