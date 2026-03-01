"use client";

import { useState } from "react";
import { Card, createCard } from "@/lib/cards";
import { auth } from "@/lib/firebase";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardAdded: () => void;
}

export function AddCardModal({ isOpen, onClose, onCardAdded }: AddCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    rarity: "Uncommon" as Card["rarity"],
    player: "",
    brand: "",
    year: new Date().getFullYear().toString(),
    sport: "Baseball",
    condition: "Mint",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "value" ? (value ? parseInt(value) : "") : value,
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

    if (!formData.name || !formData.value) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      await createCard(auth.currentUser.uid, {
        name: formData.name,
        value: parseFloat(formData.value),
        rarity: formData.rarity as "Common" | "Uncommon" | "Rare" | "Legendary",
        player: formData.player,
        brand: formData.brand,
        year: formData.year ? parseInt(formData.year) : new Date().getFullYear(),
        sport: formData.sport as "Baseball" | "Basketball" | "Football" | "Hockey" | "Soccer" | "Other",
        condition: formData.condition as "Poor" | "Fair" | "Good" | "Excellent" | "Mint",
      });

      setFormData({
        name: "",
        value: "",
        rarity: "Uncommon",
        player: "",
        brand: "",
        year: new Date().getFullYear().toString(),
        sport: "Baseball",
        condition: "Mint",
      });

      onCardAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card");
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
        <h2 style={{ marginBottom: "20px", color: "#10b3f0" }}>Add New Card</h2>

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
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Card Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., 1952 Mickey Mantle"
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

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Player Name
            </label>
            <input
              type="text"
              name="player"
              value={formData.player}
              onChange={handleChange}
              placeholder="e.g., Mickey Mantle"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #333",
                backgroundColor: "#0a0a0a",
                color: "white",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                Year
              </label>
              <input
                type="number"
                name="year"
                value={formData.year}
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
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                Value ($) *
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                placeholder="0"
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
          </div>

          <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                Sport
              </label>
              <select
                name="sport"
                value={formData.sport}
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
              >
                <option>Baseball</option>
                <option>Basketball</option>
                <option>Football</option>
                <option>Hockey</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                Rarity
              </label>
              <select
                name="rarity"
                value={formData.rarity}
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
              >
                <option>Common</option>
                <option>Uncommon</option>
                <option>Rare</option>
                <option>Legendary</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Condition
            </label>
            <select
              name="condition"
              value={formData.condition}
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
            >
              <option>Poor</option>
              <option>Good</option>
              <option>Very Good</option>
              <option>Fine</option>
              <option>Very Fine</option>
              <option>Near Mint</option>
              <option>Mint</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "12px",
                background: "#10b3f0",
                color: "black",
                border: "none",
                borderRadius: "5px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "bold",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Adding..." : "Add Card"}
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
