"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUserCards } from "@/lib/cards";
import type { Card } from "@/lib/cards";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import styles from "./create.module.css";

type DurationKey = "1h" | "6h" | "24h" | "3d";

type Condition = "Mint" | "NM" | "LP" | "MP" | "HP";

const durationMap: Record<DurationKey, number> = {
  "1h": 3600000,
  "6h": 21600000,
  "24h": 86400000,
  "3d": 259200000,
};

const conditionOptions: Condition[] = ["Mint", "NM", "LP", "MP", "HP"];

export default function CreateAuctionPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { cards, loading: cardsLoading } = useUserCards();

  // Collection selection - support multiple cards
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  // Form fields
  const [cardName, setCardName] = useState("");
  const [cardSet, setCardSet] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [condition, setCondition] = useState<Condition>("Mint");
  const [gradingCompany, setGradingCompany] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<DurationKey | "">("");

  const [imagePreview, setImagePreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // When a collection card is selected, auto-fill the form
  const handleSelectFromCollection = (card: Card) => {
    setSelectedCard(card);
    setCardName(card.name || "");
    setCardSet(card.brand || "");
    setYear((card.year || new Date().getFullYear()).toString());
    setCondition((card.condition as Condition) || "Mint");
    if (card.imageUrl || card.photoUrl || card.frontImageUrl) {
      setImagePreview(card.imageUrl || card.photoUrl || card.frontImageUrl || "");
      setImageDataUrl(""); // Use existing image URL, don't re-encode
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

  const resolveCardImageUrl = (card: Card): string => {
    const candidates = [
      card.imageUrl,
      card.photoUrl,
      card.frontImageUrl,
      card.thumbnailUrl,
    ];
    return candidates.find((url) => url && url.trim().length > 0) || "";
  };

  const createDisabled = useMemo(() => {
    const validPrice = Number(startPrice) > 0;
    // Allow either a new image OR selected cards with existing images
    const hasImage = imageDataUrl || selectedCardIds.length > 0;
    return !hasImage || !cardName.trim() || !validPrice || !selectedDuration || submitting;
  }, [cardName, imageDataUrl, selectedCardIds.length, selectedDuration, startPrice, submitting]);

  useEffect(() => {
    const checkVerification = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (!userData?.isAuctionVerified) {
          router.push(`/verify-age?redirect=/auctions/create`);
        }
      } catch (verificationError) {
        console.error("Error checking verification:", verificationError);
      }
    };

    if (user && !userLoading) {
      checkVerification();
    }
  }, [router, user, userLoading]);

  // Handle pre-filled card data from URL parameter
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const params = new URLSearchParams(window.location.search);
    const cardParam = params.get("card");
    
    if (cardParam) {
      try {
        const cardData = JSON.parse(decodeURIComponent(cardParam));
        // Create a mock card object from the data
        const mockCard: Card = {
          id: cardData.id || "",
          name: cardData.name || "",
          brand: cardData.brand || "",
          year: cardData.year || new Date().getFullYear(),
          condition: cardData.condition || "Mint",
          imageUrl: cardData.imageUrl || "",
          photoUrl: cardData.imageUrl || "",
          frontImageUrl: cardData.imageUrl || "",
          value: cardData.value || 0,
          userId: user?.uid || "",
          createdAt: new Date(),
          updatedAt: new Date(),
          sport: cardData.sport || "",
          player: cardData.player || "",
          rarity: cardData.rarity || "",
        };
        handleSelectFromCollection(mockCard);
        // Clean up URL
        window.history.replaceState({}, "", "/auctions/create");
      } catch (error) {
        console.error("Error parsing card data:", error);
      }
    }
  }, [user]);

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be 8MB or less.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImageDataUrl(result);
        setImagePreview(result);
        setError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const createAuction = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError("Login required");
      return;
    }

    const parsedYear = Number(year);
    const parsedPrice = Number(startPrice);

    // Determine image URL
    let imageUrl: string;
    if (imageDataUrl) {
      // New image upload
      imageUrl = ""; // Will be set after upload
    } else if (selectedCardIds.length > 0) {
      // Use existing image from first selected card
      const firstCard = getSelectedCards()[0];
      imageUrl = firstCard?.imageUrl || firstCard?.photoUrl || firstCard?.frontImageUrl || "";
    } else {
      setError("Please upload an image or select cards from your collection.");
      return;
    }

    if (!cardName.trim() || !selectedDuration || parsedPrice <= 0) {
      setError("Please complete all required fields.");
      return;
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 1800 || parsedYear > new Date().getFullYear()) {
      setError("Year is invalid.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Upload new image if provided
      if (imageDataUrl) {
        const safeName = cardName.trim().replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
        const imageRef = ref(storage, `auction-images/${user.uid}/${Date.now()}-${safeName}.jpg`);
        await uploadString(imageRef, imageDataUrl, "data_url");
        imageUrl = await getDownloadURL(imageRef);
      }

      const auctionRef = doc(collection(db, "auctions"));

      // Prepare card details array
      const selectedCards = getSelectedCards();
      const cardDetails = selectedCards.length > 0 ? selectedCards.map((card) => ({
        cardId: card.id,
        cardName: card.name,
        year: card.year || new Date().getFullYear(),
        brand: card.brand || "",
        sport: (card as any).sport || "",
        condition: card.condition || "Mint",
        imageUrl: resolveCardImageUrl(card),
        value: card.value || 0,
      })) : [];

      await setDoc(auctionRef, {
        cardName: cardName.trim(),
        set: cardSet.trim(),
        year: parsedYear,
        condition,
        gradingCompany: gradingCompany.trim() || null,
        description: description.trim(),
        imageUrl,
        cards: cardDetails.map((card) => ({
          ...card,
          cardID: card.cardId,
        })),
        cardCount: selectedCards.length,
        cardID: selectedCards[0]?.id || null,
        linkedCardId: selectedCards[0]?.id || null,
        sellerID: user.uid,
        sellerId: user.uid,
        sellerName: user.displayName || user.email?.split("@")[0] || "Seller",
        startPrice: parsedPrice,
        startingPrice: parsedPrice,
        currentBid: parsedPrice,
        minimumNextBid: parsedPrice + 5,
        highestBidder: null,
        highestBidderId: null,
        bidCount: 0,
        status: "live",
        ended: false,
        created: serverTimestamp(),
        createdAt: serverTimestamp(),
        endTime: Timestamp.fromMillis(Date.now() + durationMap[selectedDuration]),
      });

      router.push("/auctions/live");
    } catch (err) {
      console.error(err);
      setError("Error creating auction");
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <div className={dashboardStyles.content}>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={dashboardStyles.content}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Create New Auction</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
          List your card for live bidding
        </p>
      </div>

      <div className={styles.verificationNotice}>
        Auctions require age verification (18+). If your account is not verified, you are redirected to <Link href="/verify-age">Verify Age</Link> before creating an auction.
      </div>

      <form onSubmit={createAuction} className={styles.form}>
        <div className={styles.topGrid}>
          {/* Left Panel: Select from Collection */}
          <section className={styles.collectionPanel}>
            <h2>📚 Your Collection</h2>
            <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", marginBottom: "1rem" }}>
              Select one or more cards to include in this auction
            </p>
            {cardsLoading ? (
              <div style={{ color: "rgba(255,255,255,0.6)", padding: "1rem" }}>Loading cards...</div>
            ) : cards.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.6)", padding: "1rem" }}>
                No cards in your collection.{" "}
                <Link href="/dashboard/scan" style={{ color: "#8b5cf6" }}>
                  Add a card →
                </Link>
              </div>
            ) : (
              <div className={styles.cardList}>
                {cards.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`${styles.cardOption} ${isSelected ? styles.selected : ""}`}
                      onClick={() => toggleCardSelection(card.id)}
                      style={{ position: "relative" }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCardSelection(card.id)}
                        style={{
                          position: "absolute",
                          top: "0.5rem",
                          left: "0.5rem",
                          cursor: "pointer",
                          width: "18px",
                          height: "18px",
                          zIndex: 1
                        }}
                      />
                      <Image
                        src={card.imageUrl || card.photoUrl || card.frontImageUrl || card.thumbnailUrl || "/placeholder-card.svg"}
                        alt={card.name}
                        width={60}
                        height={80}
                        sizes="60px"
                        className={styles.cardThumbnail}
                        unoptimized
                      />
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{card.name}</div>
                        {card.year && <div className={styles.cardMeta}>{card.year}</div>}
                        {card.condition && <div className={styles.cardMeta}>{card.condition}</div>}
                        <div className={styles.cardMeta} style={{ color: "#22c55e" }}>
                          ${card.value?.toLocaleString() || 0}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {selectedCardIds.length > 0 && (
              <div style={{ 
                marginTop: "1rem", 
                padding: "0.75rem", 
                background: "rgba(139,92,246,0.15)", 
                borderRadius: "8px",
                border: "1px solid rgba(139,92,246,0.3)",
                fontSize: "0.875rem"
              }}>
                <strong>{selectedCardIds.length} card{selectedCardIds.length > 1 ? 's' : ''} selected</strong>
              </div>
            )}
          </section>

          {/* Middle Panel: Manual Entry */}
          <section className={styles.uploadPanel}>
            <h2>📤 Or Upload Image</h2>
            <label htmlFor="cardImage" className={styles.uploadButton}>
              Upload Card Image
            </label>
            <input
              id="cardImage"
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className={styles.fileInput}
            />
            <div className={styles.previewWrap}>
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Card preview"
                  width={300}
                  height={420}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className={styles.previewImage}
                  unoptimized
                />
              ) : (
                <div className={styles.previewPlaceholder}>Image preview appears here</div>
              )}
            </div>
          </section>

          {/* Right Panel: Card Details */}
          <section className={styles.rightPanel}>
            <h2>📝 Card Details</h2>
            <label className={styles.field}>
              <span>Card Name *</span>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                maxLength={120}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Set / Brand *</span>
              <input
                type="text"
                value={cardSet}
                onChange={(e) => setCardSet(e.target.value)}
                maxLength={100}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Year *</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={1800}
                max={new Date().getFullYear()}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Condition *</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Grading Company (optional)</span>
              <input
                type="text"
                value={gradingCompany}
                onChange={(e) => setGradingCompany(e.target.value)}
                maxLength={80}
              />
            </label>

            <label className={styles.field}>
              <span>Description *</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                required
              />
            </label>
          </section>
        </div>

        <section className={styles.pricingSection}>
          <label className={styles.field}>
            <span>Starting Price ($) *</span>
            <input
              type="number"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              min={1}
              step="0.01"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Auction Duration *</span>
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value as DurationKey)}
              required
            >
              <option value="">Select duration</option>
              <option value="1h">1 Hour</option>
              <option value="6h">6 Hours</option>
              <option value="24h">24 Hours</option>
              <option value="3d">3 Days</option>
            </select>
          </label>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submitButton} disabled={createDisabled}>
          {submitting ? "Creating..." : "Create Auction"}
        </button>
      </form>
    </div>
  );
}
