"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./seller-tools.module.css";
import { useCurrentUser } from "../../lib/useCurrentUser";

interface SellerOffer {
  "condition-string"?: string;
  "console-name"?: string;
  "ended-time"?: string;
  "include-string"?: string;
  "is-available"?: boolean;
  "is-ended"?: boolean;
  "is-shipped"?: boolean;
  "is-sold"?: boolean;
  "offer-id"?: string;
  "offer-status"?: string;
  "offer-url"?: string;
  price?: number;
  "product-name"?: string;
  "sale-time"?: string;
  "shipped-time"?: string;
  sku?: string;
}

type OfferStatus = "sold" | "available" | "ended" | "collection";

function formatOfferPrice(cents?: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

export default function SellerOptimizationTools() {
  const { user, loading: authLoading } = useCurrentUser();
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState<OfferStatus>("sold");
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Enter your PriceCharting seller ID to sync offers.");

  useEffect(() => {
    const saved = window.localStorage.getItem("pc-seller-id");
    if (saved) {
      setSellerId(saved);
    }
  }, []);

  const stats = useMemo(() => {
    const sold = offers.filter((offer) => offer["is-sold"]).length;
    const shipped = offers.filter((offer) => offer["is-shipped"]).length;
    const totalValue = offers.reduce((sum, offer) => sum + Number(offer.price || 0), 0);
    return { sold, shipped, totalValue };
  }, [offers]);

  const loadOffers = async () => {
    const trimmedSellerId = sellerId.trim();
    if (!trimmedSellerId) {
      setMessage("A seller ID is required.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Syncing offers from PriceCharting...");
      window.localStorage.setItem("pc-seller-id", trimmedSellerId);

      const response = await fetch(
        `/api/offers?seller=${encodeURIComponent(trimmedSellerId)}&status=${encodeURIComponent(status)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || data?.status === "error") {
        throw new Error(data?.error || data?.["error-message"] || "Failed to load seller offers");
      }

      const nextOffers = Array.isArray(data?.offers) ? data.offers : [];
      setOffers(nextOffers);
      setMessage(`${data?.cached ? "Cached" : "Live"} sync complete. ${nextOffers.length} ${status} offers loaded.`);
    } catch (error) {
      console.error("Error loading seller offers:", error);
      setOffers([]);
      setMessage(error instanceof Error ? error.message : "Unable to load seller offers.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className={styles.container}><div className={styles.loading}>Loading seller tools...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📦 Seller Offer Center</h1>
        <p>Check sold, active, ended, or collection offers from PriceCharting with built-in 5 minute throttling.</p>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            placeholder="Enter your PriceCharting seller ID"
          />

          <select
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.target.value as OfferStatus)}
          >
            <option value="sold">Sold</option>
            <option value="available">Available</option>
            <option value="ended">Ended</option>
            <option value="collection">Collection</option>
          </select>

          <button className={styles.updateBtn} onClick={loadOffers} disabled={loading}>
            {loading ? "Syncing..." : "Sync Offers"}
          </button>
        </div>

        <p className={styles.helperText}>
          Signed in as {user?.email || "seller"}. Use the code from your PriceCharting items-for-sale page.
        </p>
        <p className={styles.statusMessage}>{message}</p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <strong>{offers.length}</strong>
          <span>Offers Loaded</span>
        </div>
        <div className={styles.statTile}>
          <strong>{stats.sold}</strong>
          <span>Sold</span>
        </div>
        <div className={styles.statTile}>
          <strong>{stats.shipped}</strong>
          <span>Shipped</span>
        </div>
        <div className={styles.statTile}>
          <strong>{formatOfferPrice(stats.totalValue)}</strong>
          <span>Total Value</span>
        </div>
      </div>

      <div className={styles.listingsContainer}>
        {offers.map((offer) => (
          <div key={offer["offer-id"]} className={styles.listingCard}>
            <div className={styles.listingHeader}>
              <div>
                <h3>{offer["product-name"] || "Unknown item"}</h3>
                <p className={styles.category}>
                  {offer["console-name"] || "Unknown category"} • {offer["include-string"] || "Normal wear"}
                </p>
              </div>
              <div className={styles.offerBadge}>{offer["offer-status"] || status}</div>
            </div>

            <div className={styles.priceAnalysis}>
              <div className={styles.priceItem}>
                <span>Price</span>
                <strong>{formatOfferPrice(offer.price)}</strong>
              </div>
              <div className={styles.priceItem}>
                <span>Sale Time</span>
                <strong>{offer["sale-time"] || "—"}</strong>
              </div>
              <div className={styles.priceItem}>
                <span>Shipped</span>
                <strong>{offer["is-shipped"] ? (offer["shipped-time"] || "Yes") : "No"}</strong>
              </div>
            </div>

            <div className={styles.improvements}>
              <strong>Offer details</strong>
              <ul>
                <li>Condition: {offer["condition-string"] || "Normal wear"}</li>
                <li>Offer ID: {offer["offer-id"] || "—"}</li>
                <li>SKU: {offer.sku || "—"}</li>
                <li>Ended: {offer["ended-time"] || "—"}</li>
              </ul>
            </div>
          </div>
        ))}
      </div>

      {!loading && offers.length === 0 && (
        <div className={styles.empty}>No offers to show yet. Sync your seller ID to check marketplace activity.</div>
      )}
    </div>
  );
}
