"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "../../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useUserCards } from "../../../../lib/cards";
import styles from "./create.module.css";

export default function CreateListingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { cards } = useUserCards();
  
  const [formData, setFormData] = useState({
    selectedCard: "",
    selectedCardImageUrl: "",
    cardName: "",
    player: "",
    year: new Date().getFullYear(),
    brand: "",
    sport: "Baseball",
    condition: "Mint",
    listingType: "sell" as "sell" | "trade" | "both",
    price: "",
    tradeFor: "",
    description: "",
  });

  const resolveCardImageUrl = (card: any): string => {
    if (!card) return "";

    const candidates = [
      card.imageUrl,
      card.photoUrl,
      card.cardImage,
      card.image,
      card.frontImageUrl,
      card.frontImage,
      card.scanImageUrl,
      card.thumbnailUrl,
    ];

    const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    return found || "";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleCardSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cardId = e.target.value;
    const card = cards?.find((c) => c.id === cardId);
    
    if (card) {
      const selectedCardImageUrl = resolveCardImageUrl(card);
      setFormData({
        ...formData,
        selectedCard: cardId,
        selectedCardImageUrl,
        cardName: card.name,
        player: (card as any).player || "",
        year: card.year || new Date().getFullYear(),
        brand: (card as any).brand || "",
        sport: (card as any).sport || "Baseball",
        condition: (card as any).condition || "Mint",
        price: card.value?.toString() || "",
      });
    } else {
      setFormData({
        ...formData,
        selectedCard: "",
        selectedCardImageUrl: "",
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.selectedCard) {
      setError("Select a card from your collection first.");
      return;
    }

    if (!formData.cardName) {
      setError("Card name is required");
      return;
    }

    if (formData.listingType === "sell" && !formData.price) {
      setError("Price is required for sale listings");
      return;
    }

    if (formData.listingType === "trade" && !formData.tradeFor) {
      setError("Trade requirements are needed for trade listings");
      return;
    }

    if (formData.listingType === "both" && (!formData.price || !formData.tradeFor)) {
      setError("Both price and trade requirements are needed");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      setSaving(true);

      await addDoc(collection(db, "marketplace"), {
        cardId: formData.selectedCard || null,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        cardName: formData.cardName,
        player: formData.player,
        year: formData.year,
        brand: formData.brand,
        sport: formData.sport,
        condition: formData.condition,
        listingType: formData.listingType,
        price: formData.price ? Number(formData.price) : null,
        tradeFor: formData.tradeFor || null,
        description: formData.description,
        imageUrl: formData.selectedCardImageUrl || null,
        status: "active",
        views: 0,
        createdAt: serverTimestamp(),
      });

      router.push("/dashboard/marketplace");
    } catch (err) {
      console.error("Error creating listing:", err);
      setError("Failed to create listing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Link href="/dashboard/marketplace" className={styles.backLink}>
            ← Back to Marketplace
          </Link>
          <p className={styles.eyebrow}>Marketplace</p>
          <h1 className={styles.title}>Create Listing</h1>
        </div>
      </div>

      <form className={`panel ${styles.form}`} onSubmit={handleSubmit}>
        {/* Select from collection */}
        {cards && cards.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Quick Select from Collection</h3>
            <p className={styles.selectedCardPreviewText}>Choose a saved card to auto-fill listing info and photo.</p>
            <select
              value={formData.selectedCard}
              onChange={handleCardSelect}
              className={styles.select}
            >
              <option value="">-- Or enter manually --</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} - ${card.value}
                </option>
              ))}
            </select>

            {formData.selectedCardImageUrl ? (
              <div className={styles.selectedCardPreview}>
                <Image
                  src={formData.selectedCardImageUrl}
                  alt={formData.cardName || "Selected card"}
                  width={300}
                  height={420}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className={styles.selectedCardPreviewImage}
                  unoptimized
                />
                <p className={styles.selectedCardPreviewText}>Photo pulled from your Collection</p>
              </div>
            ) : formData.selectedCard ? (
              <p className={styles.selectedCardMissingPhoto}>
                No saved card photo found in Collection. Listing will use placeholder.
              </p>
            ) : null}
          </div>
        )}

        {/* Card Details */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Card Details</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Card Name *</span>
              <input
                type="text"
                name="cardName"
                value={formData.cardName}
                onChange={handleChange}
                placeholder="e.g., 2023 Topps Chrome Shohei Ohtani"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Player</span>
              <input
                type="text"
                name="player"
                value={formData.player}
                onChange={handleChange}
                placeholder="Player name"
              />
            </label>

            <label className={styles.field}>
              <span>Brand</span>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Topps, Panini, etc."
              />
            </label>

            <label className={styles.field}>
              <span>Year</span>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                min="1800"
                max={new Date().getFullYear()}
              />
            </label>

            <label className={styles.field}>
              <span>Sport</span>
              <select name="sport" value={formData.sport} onChange={handleChange}>
                <option value="Baseball">Baseball</option>
                <option value="Basketball">Basketball</option>
                <option value="Football">Football</option>
                <option value="Hockey">Hockey</option>
                <option value="Soccer">Soccer</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Condition</span>
              <select name="condition" value={formData.condition} onChange={handleChange}>
                <option value="Poor">Poor</option>
                <option value="Fair">Fair</option>
                <option value="Good">Good</option>
                <option value="Excellent">Excellent</option>
                <option value="Mint">Mint</option>
                <option value="PSA 10">PSA 10</option>
                <option value="PSA 9">PSA 9</option>
                <option value="BGS 10">BGS 10</option>
                <option value="BGS 9.5">BGS 9.5</option>
              </select>
            </label>
          </div>
        </div>

        {/* Listing Type */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Listing Type</h3>
          <div className={styles.listingTypeButtons}>
            <button
              type="button"
              className={`${styles.typeButton} ${
                formData.listingType === "sell" ? styles.typeButtonActive : ""
              }`}
              onClick={() => setFormData({ ...formData, listingType: "sell" })}
            >
              💰 For Sale
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${
                formData.listingType === "trade" ? styles.typeButtonActive : ""
              }`}
              onClick={() => setFormData({ ...formData, listingType: "trade" })}
            >
              🔄 For Trade
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${
                formData.listingType === "both" ? styles.typeButtonActive : ""
              }`}
              onClick={() => setFormData({ ...formData, listingType: "both" })}
            >
              💰🔄 Sale or Trade
            </button>
          </div>
        </div>

        {/* Price (if selling) */}
        {(formData.listingType === "sell" || formData.listingType === "both") && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Price</h3>
            <label className={styles.field}>
              <span>Asking Price (USD) *</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                required={formData.listingType === "sell" || formData.listingType === "both"}
              />
            </label>
          </div>
        )}

        {/* Trade Requirements (if trading) */}
        {(formData.listingType === "trade" || formData.listingType === "both") && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Trade Requirements</h3>
            <label className={styles.field}>
              <span>What are you looking for? *</span>
              <textarea
                name="tradeFor"
                value={formData.tradeFor}
                onChange={handleChange}
                placeholder="e.g., 2022 Topps Chrome rookies, vintage baseball cards, etc."
                rows={3}
                required={formData.listingType === "trade" || formData.listingType === "both"}
              />
            </label>
          </div>
        )}

        {/* Description */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <label className={styles.field}>
            <span>Additional Details</span>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the card condition, any flaws, why you're selling/trading, etc."
              rows={4}
            />
          </label>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <Link href="/dashboard/marketplace" className={styles.cancelButton}>
            Cancel
          </Link>
          <button type="submit" className={styles.submitButton} disabled={saving}>
            {saving ? "Creating..." : "Create Listing"}
          </button>
        </div>
      </form>
    </div>
  );
}
