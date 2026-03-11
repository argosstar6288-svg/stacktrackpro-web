"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "../../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useUserCards } from "../../../../lib/cards";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import styles from "./create.module.css";

export default function CreateListingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { cards } = useUserCards();
  const [listedCardIds, setListedCardIds] = useState<Set<string>>(new Set());
  
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
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

  const resolveCardNumber = (card: any): string => {
    if (!card) return "";

    const candidates = [card.cardNumber, card.number, card.cardNo, card.no];
    const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    return found || "";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        // Fetch all active listings to get listed card IDs (flat first, legacy fallback)
        try {
          const listedIds = new Set<string>();

          const collectListedIds = (docs: any[]) => {
            docs.forEach((snapshot) => {
              const data = snapshot.data();

              if (data.cardId) listedIds.add(data.cardId);
              if (data.cardID) listedIds.add(data.cardID);

              if (data.cards && Array.isArray(data.cards)) {
                data.cards.forEach((card: any) => {
                  if (card.cardId) listedIds.add(card.cardId);
                  if (card.cardID) listedIds.add(card.cardID);
                });
              }
            });
          };

          try {
            const flatQuery = query(
              collection(db, FLAT_COLLECTIONS.marketListings),
              where("status", "==", "active")
            );
            const flatSnapshot = await getDocs(flatQuery);
            collectListedIds(flatSnapshot.docs);
          } catch (flatError) {
            console.warn("Flat marketListings query failed:", flatError);
          }

          const legacyQuery = query(collection(db, "marketplace"), where("status", "==", "active"));
          const legacySnapshot = await getDocs(legacyQuery);
          collectListedIds(legacySnapshot.docs);

          setListedCardIds(listedIds);
        } catch (error) {
          console.error("Error fetching marketplace listings:", error);
        }

        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Handle pre-filled card data from URL parameter
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const params = new URLSearchParams(window.location.search);
    const cardParam = params.get("card");
    
    if (cardParam) {
      try {
        const cardData = JSON.parse(decodeURIComponent(cardParam));
        setFormData({
          selectedCard: cardData.id || "",
          selectedCardImageUrl: cardData.imageUrl || "",
          cardName: cardData.name || "",
          player: cardData.player || "",
          year: cardData.year || new Date().getFullYear(),
          brand: cardData.brand || "",
          sport: cardData.sport || "Baseball",
          condition: cardData.condition || "Mint",
          listingType: "sell",
          price: cardData.value?.toString() || "",
          tradeFor: "",
          description: "",
        });
        // Clean up URL
        window.history.replaceState({}, "", "/dashboard/marketplace/create");
      } catch (error) {
        console.error("Error parsing card data:", error);
      }
    }
  }, []);

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

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  const getSelectedCards = () => {
    if (!cards) return [];
    return cards.filter((card) => selectedCardIds.includes(card.id));
  };

  const getTotalValue = () => {
    return getSelectedCards().reduce((sum, card) => sum + (card.value || 0), 0);
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

    if (selectedCardIds.length === 0) {
      setError("Select at least one card from your collection.");
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

      const selectedCards = getSelectedCards();
      const cardDetails = selectedCards.map((card) => ({
        cardId: card.id,
        cardName: card.name,
        cardNumber: resolveCardNumber(card),
        player: (card as any).player || "",
        year: card.year || new Date().getFullYear(),
        brand: (card as any).brand || "",
        sport: (card as any).sport || "Baseball",
        condition: (card as any).condition || "Mint",
        imageUrl: resolveCardImageUrl(card) || null,
        value: card.value || 0,
      }));

      await addDoc(collection(db, FLAT_COLLECTIONS.marketListings), {
        cards: cardDetails.map((card) => ({
          ...card,
          cardID: card.cardId,
        })),
        cardCount: selectedCards.length,
        sellerID: user.uid,
        userId: user.uid,
        userID: user.uid,
        sellerName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        userName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        // Keep first card as primary for quick lookups
        cardID: selectedCards[0].id || null,
        cardId: selectedCards[0].id || null,
        cardName: selectedCards[0].name,
        cardNumber: resolveCardNumber(selectedCards[0]) || null,
        player: (selectedCards[0] as any).player || "",
        year: selectedCards[0].year || new Date().getFullYear(),
        brand: (selectedCards[0] as any).brand || "",
        sport: (selectedCards[0] as any).sport || "Baseball",
        condition: (selectedCards[0] as any).condition || "Mint",
        imageUrl: resolveCardImageUrl(selectedCards[0]) || null,
        listingType: formData.listingType,
        price: formData.price ? Number(formData.price) : null,
        tradeFor: formData.tradeFor || null,
        description: formData.description,
        status: "active",
        views: 0,
        created: serverTimestamp(),
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
            <h3 className={styles.sectionTitle}>Select Cards from Collection</h3>
            <p className={styles.selectedCardPreviewText}>
              Select one or more cards to include in this listing. Total value: ${getTotalValue().toLocaleString()}
              <br />
              <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
                {cards.filter(card => !listedCardIds.has(card.id)).length} of {cards.length} cards available 
                {listedCardIds.size > 0 && ` (${listedCardIds.size} already listed)`}
              </span>
            </p>
            
            {cards.filter(card => !listedCardIds.has(card.id)).length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'rgba(255,140,0,0.1)',
                border: '1px solid rgba(255,140,0,0.3)',
                borderRadius: '12px',
                marginTop: '1rem'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                <h3 style={{ marginBottom: '0.5rem' }}>All cards are already listed</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  All your cards are currently in active marketplace listings. Delete existing listings to create new ones.
                </p>
              </div>
            ) : (
              <>
                <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
              gap: "1rem",
              marginTop: "1rem",
              maxHeight: "500px",
              overflowY: "auto",
              padding: "0.5rem",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              background: "rgba(0,0,0,0.3)"
            }}>
              {cards.filter(card => !listedCardIds.has(card.id)).map((card) => {
                const imageUrl = resolveCardImageUrl(card);
                const cardNumber = resolveCardNumber(card);
                const isSelected = selectedCardIds.includes(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => toggleCardSelection(card.id)}
                    style={{
                      cursor: "pointer",
                      border: isSelected ? "3px solid #1E90FF" : "2px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "0.75rem",
                      background: isSelected ? "rgba(30,144,255,0.15)" : "rgba(0,0,0,0.4)",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#1E90FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                        boxShadow: "0 2px 8px rgba(30,144,255,0.6)",
                        border: "2px solid white"
                      }}>
                        <svg 
                          width="20" 
                          height="20" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="white" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                    {imageUrl && (
                      <Image
                        src={imageUrl}
                        alt={card.name}
                        width={160}
                        height={224}
                        sizes="160px"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "4px",
                          marginBottom: "0.5rem",
                          opacity: isSelected ? 0.9 : 1,
                          transition: "opacity 0.2s"
                        }}
                        unoptimized
                      />
                    )}
                    <div style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.25rem" }}>
                      {cardNumber ? `Card #${cardNumber}` : `Card ID: ${card.id}`}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                      ${card.value?.toLocaleString() || 0}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCardIds.length > 0 && (
              <div style={{ 
                marginTop: "1rem", 
                padding: "1rem", 
                background: "rgba(30,144,255,0.1)", 
                borderRadius: "8px",
                border: "1px solid rgba(30,144,255,0.3)"
              }}>
                <strong>{selectedCardIds.length} card{selectedCardIds.length > 1 ? 's' : ''} selected</strong>
                <div style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {getSelectedCards().map((card) => card.name).join(", ")}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}

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
