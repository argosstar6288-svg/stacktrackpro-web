"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { addCard, type Card } from "../../../../lib/cards";
import { db, storage } from "../../../../lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useCurrentUser } from "../../../../lib/useCurrentUser";
import { generateStackTrackId } from "../../../../lib/universal-card-id";
import AICardScanner from "../../../../components/AICardScanner";
import styles from "./collection-add.module.css";

const PLACEHOLDER_IMAGE_URL = "/placeholder-card.svg";

interface PossibleMatch {
  id: string;
  cardId: string;
  name: string;
  player?: string;
  year?: number;
  brand?: string;
  sport?: string;
  cardNumber?: string;
  imageUrl?: string;
  confidence?: number;
}

interface PendingScanMatch {
  scanResult: any;
  possibleMatches: PossibleMatch[];
  selectedMatchId: string;
}

export default function CollectionAddPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [pendingScanMatches, setPendingScanMatches] = useState<PendingScanMatch[]>([]);
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreview, setCardImagePreview] = useState("");
  const [addMethod, setAddMethod] = useState<"scan" | "manual" | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    rarity: "Uncommon" as Card["rarity"],
    player: "",
    cardNumber: "",
    brand: "",
    year: new Date().getFullYear().toString(),
    sport: "Baseball",
    condition: "Mint",
  });

  const sanitizeFilePart = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);

  const uploadCardImage = async (userId: string, name: string, file: File) => {
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const imagePath = `cards/${userId}/${Date.now()}-${sanitizeFilePart(name)}.${extension}`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, file);
    return getDownloadURL(imageRef);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "value" ? (value ? Number(value) : "") : value,
    }));
  };

  const handleFetchPrice = async () => {
    if (!formData.name) {
      setError("Please enter a card name first");
      return;
    }

    setFetchingPrice(true);
    setError("");

    try {
      const response = await fetch("/api/price-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardName: formData.name,
          player: formData.player || undefined,
          year: formData.year ? Number(formData.year) : undefined,
          brand: formData.brand || undefined,
          sport: formData.sport || undefined,
          condition: formData.condition || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch price");
      }

      const data = await response.json();

      if (data.found && data.suggestedPrice) {
        setFormData((prev) => ({
          ...prev,
          value: String(data.suggestedPrice),
        }));
        setError(`✓ Found market price: $${data.suggestedPrice} (${data.productName})`);
      } else {
        setError("⚠ Card not found in price database. Using estimated value.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market price");
    } finally {
      setFetchingPrice(false);
    }
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(",");
    const mimeMatch = (parts[0] || "").match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  };

  const uploadScannedImage = async (
    userId: string,
    cardName: string,
    dataUrl: string
  ): Promise<string> => {
    try {
      const blob = dataUrlToBlob(dataUrl);
      const imagePath = `cards/${userId}/${Date.now()}-${sanitizeFilePart(cardName)}.jpg`;
      const imageRef = ref(storage, imagePath);
      await uploadBytes(imageRef, blob);
      return getDownloadURL(imageRef);
    } catch (err) {
      console.error("Failed to upload scanned image:", err);
      return PLACEHOLDER_IMAGE_URL;
    }
  };

  const getSafeSport = (value: string): Card["sport"] => {
    const normalized = String(value || "Other").toLowerCase();
    if (normalized.includes("baseball")) return "Baseball";
    if (normalized.includes("basketball")) return "Basketball";
    if (normalized.includes("football")) return "Football";
    if (normalized.includes("hockey")) return "Hockey";
    if (normalized.includes("soccer")) return "Soccer";
    return "Other";
  };

  const buildFallbackCardId = (result: any): string =>
    generateStackTrackId({
      game: result?.sport || "sports",
      name: result?.name || "Scanned Card",
      player: result?.player || "Unknown",
      year: result?.year || new Date().getFullYear(),
      set: result?.brand || "unknown",
      cardNumber: result?.cardNumber || "0",
      sport: result?.sport || "other",
    });

  const handleSelectMatch = (scanIndex: number, selectedMatchId: string) => {
    setPendingScanMatches((previous) =>
      previous.map((entry, index) =>
        index === scanIndex
          ? { ...entry, selectedMatchId }
          : entry
      )
    );
  };

  const handleSaveSelectedMatches = async () => {
    if (!pendingScanMatches.length) return;

    try {
      setSaving(true);
      setError("Saving selected cards to your collection...");

      const batch = writeBatch(db);
      const pendingImageUploads: Array<{ cardDocId: string; cardName: string; dataUrl: string }> = [];

      for (let i = 0; i < pendingScanMatches.length; i++) {
        const entry = pendingScanMatches[i];
        const selectedMatch =
          entry.possibleMatches.find((match) => match.id === entry.selectedMatchId) ||
          entry.possibleMatches[0];

        if (!selectedMatch) {
          throw new Error(`Missing selected match for scanned card ${i + 1}`);
        }

        const result = entry.scanResult;
        const scannedImage =
          (typeof result?.imageUrl === "string" && result.imageUrl) ||
          (typeof result?.photoUrl === "string" && result.photoUrl) ||
          "";

        let imageUrl = selectedMatch.imageUrl || PLACEHOLDER_IMAGE_URL;
        if (scannedImage && !scannedImage.startsWith("data:") && imageUrl === PLACEHOLDER_IMAGE_URL) {
          imageUrl = scannedImage;
        }

        const cardId = selectedMatch.cardId || buildFallbackCardId(result);
        if (!cardId) {
          throw new Error(`cardId is undefined for selected card ${selectedMatch.name}`);
        }

        const cardRef = doc(collection(db, "cards"));

        if (scannedImage && scannedImage.startsWith("data:")) {
          pendingImageUploads.push({
            cardDocId: cardRef.id,
            cardName: selectedMatch.name || "scanned-card",
            dataUrl: scannedImage,
          });
        }

        batch.set(cardRef, {
          userId: user.uid,
          name: selectedMatch.name || result.name || "Scanned Card",
          value: Number(result.estimatedValue || 0),
          marketPrice: Number(result.estimatedValue || 0),
          priceLastUpdated: new Date().toISOString(),
          rarity: "Uncommon",
          player: selectedMatch.player || result.player || "",
          cardNumber: selectedMatch.cardNumber || result.cardNumber || "",
          brand: selectedMatch.brand || result.brand || "",
          year: Number(selectedMatch.year || result.year) || new Date().getFullYear(),
          sport: getSafeSport(selectedMatch.sport || result.sport),
          condition: (result.condition || "Good") as Card["condition"],
          imageUrl,
          photoUrl: imageUrl,
          addedAt: serverTimestamp(),
        });

        const userCollectionRef = doc(collection(db, "userCollections"));
        batch.set(userCollectionRef, {
          userId: user.uid,
          cardId,
          quantity: 1,
          condition: "raw",
          created: Date.now(),
        });
      }

      await batch.commit();

      if (pendingImageUploads.length > 0) {
        void Promise.allSettled(
          pendingImageUploads.map(async (pendingUpload) => {
            try {
              const uploadedImageUrl = await uploadScannedImage(
                user.uid,
                pendingUpload.cardName,
                pendingUpload.dataUrl
              );

              if (!uploadedImageUrl || uploadedImageUrl === PLACEHOLDER_IMAGE_URL) {
                return;
              }

              await updateDoc(doc(db, "cards", pendingUpload.cardDocId), {
                imageUrl: uploadedImageUrl,
                photoUrl: uploadedImageUrl,
              });
            } catch (uploadError) {
              console.error(
                `Failed deferred image upload for card ${pendingUpload.cardDocId}:`,
                uploadError
              );
            }
          })
        );
      }

      const savedCount = pendingScanMatches.length;
      setPendingScanMatches([]);
      setError("");
      router.push(`/dashboard/collection?savedFromScan=1&savedCount=${savedCount}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save selected cards");
    } finally {
      setSaving(false);
    }
  };

  const handleScanComplete = async (results: any[]) => {
    if (!results.length) {
      setShowScanner(false);
      setError("No scan results were returned.");
      return;
    }

    try {
      setSaving(true);
      setError(`Finding possible matches for ${results.length} scanned card${results.length > 1 ? "s" : ""}...`);

      let completed = 0;
      const pendingMatches: PendingScanMatch[] = await Promise.all(
        results.map(async (result, i) => {
          try {
            const dnaResponse = await fetch("/api/catalog/dna-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                player: result.player,
                team: result.team,
                year: result.year,
                set: result.brand,
                cardNumber: result.cardNumber,
                brand: result.brand,
                sport: result.sport,
                name: result.name,
                limit: 3,
              }),
            });

            const dnaPayload = dnaResponse.ok ? await dnaResponse.json() : { matches: [] };
            const apiMatches = Array.isArray(dnaPayload?.matches) ? dnaPayload.matches : [];

            const possibleMatches: PossibleMatch[] = apiMatches.slice(0, 3).map((match: any, matchIndex: number) => ({
              id: `${i}-${matchIndex}-${match.stacktrackId || match.catalogId || "candidate"}`,
              cardId: match.stacktrackId || match.catalogId || buildFallbackCardId(result),
              name: match.name || result.name || "Scanned Card",
              player: match.cardData?.player || result.player || "",
              year: Number(match.cardData?.year || result.year) || new Date().getFullYear(),
              brand: match.cardData?.brand || match.cardData?.set?.name || result.brand || "",
              sport: match.cardData?.sport || result.sport || "Other",
              cardNumber: match.cardData?.cardNumber || result.cardNumber || "",
              imageUrl:
                match.cardData?.images?.large ||
                match.cardData?.images?.small ||
                result.imageUrl ||
                result.photoUrl ||
                PLACEHOLDER_IMAGE_URL,
              confidence: match.percentage || 0,
            }));

            if (possibleMatches.length === 0) {
              possibleMatches.push({
                id: `${i}-manual`,
                cardId: buildFallbackCardId(result),
                name: result.name || "Scanned Card",
                player: result.player || "",
                year: Number(result.year) || new Date().getFullYear(),
                brand: result.brand || "",
                sport: result.sport || "Other",
                cardNumber: result.cardNumber || "",
                imageUrl: result.imageUrl || result.photoUrl || PLACEHOLDER_IMAGE_URL,
                confidence: 0,
              });
            }

            return {
              scanResult: result,
              possibleMatches,
              selectedMatchId: possibleMatches[0].id,
            };
          } catch (matchError) {
            console.error(`Failed DNA matching for card ${i + 1}:`, matchError);

            const fallbackMatch: PossibleMatch = {
              id: `${i}-manual`,
              cardId: buildFallbackCardId(result),
              name: result.name || "Scanned Card",
              player: result.player || "",
              year: Number(result.year) || new Date().getFullYear(),
              brand: result.brand || "",
              sport: result.sport || "Other",
              cardNumber: result.cardNumber || "",
              imageUrl: result.imageUrl || result.photoUrl || PLACEHOLDER_IMAGE_URL,
              confidence: 0,
            };

            return {
              scanResult: result,
              possibleMatches: [fallbackMatch],
              selectedMatchId: fallbackMatch.id,
            };
          } finally {
            completed += 1;
            setError(`Finding matches for card ${completed} of ${results.length}...`);
          }
        })
      );

      setShowScanner(false);
      setPendingScanMatches(pendingMatches);
      setError("");
    } catch (err) {
      setShowScanner(false);
      setError(err instanceof Error ? err.message : "Failed to save scanned cards");
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setCardImageFile(file);
    setCardImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!formData.name || !formData.value) {
      setError("Please fill in the required fields.");
      return;
    }

    try {
      setSaving(true);

      let imageUrl = PLACEHOLDER_IMAGE_URL;
      if (!cardImageFile && cardImagePreview && !cardImagePreview.startsWith("blob:")) {
        imageUrl = cardImagePreview;
      }

      const createdCardId = await addCard(user.uid, {
        name: formData.name,
        value: Number(formData.value),
        rarity: formData.rarity,
        player: formData.player,
        cardNumber: formData.cardNumber,
        brand: formData.brand,
        year: formData.year ? Number(formData.year) : new Date().getFullYear(),
        sport: formData.sport as Card["sport"],
        condition: formData.condition as Card["condition"],
        imageUrl,
        photoUrl: imageUrl,
      });

      if (cardImageFile) {
        void uploadCardImage(user.uid, formData.name, cardImageFile)
          .then(async (uploadedImageUrl) => {
            if (!uploadedImageUrl || uploadedImageUrl === PLACEHOLDER_IMAGE_URL) {
              return;
            }

            await updateDoc(doc(db, "cards", createdCardId), {
              imageUrl: uploadedImageUrl,
              photoUrl: uploadedImageUrl,
            });
          })
          .catch((uploadError) => {
            console.error(`Deferred manual image upload failed for card ${createdCardId}:`, uploadError);
          });
      }

      router.push("/dashboard/collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Collection</p>
          <h1 className={styles.title}>Add Card</h1>
        </div>
        <Link className={styles.secondaryButton} href="/dashboard/collection">
          Back to Collection
        </Link>
      </div>

      {error && !showScanner && !addMethod && <div className={styles.error}>{error}</div>}

      {!addMethod && !showScanner && (
        <div className={styles.methodsGrid}>
          <button
            type="button"
            className={styles.methodBox}
            onClick={() => setShowScanner(true)}
          >
            <div className={styles.methodIcon}>📷</div>
            <div className={styles.methodTitle}>Scan with AI</div>
            <div className={styles.methodDesc}>Take a photo and let AI detect card details</div>
          </button>

          <button
            type="button"
            className={styles.methodBox}
            onClick={() => setAddMethod("manual")}
          >
            <div className={styles.methodIcon}>✏️</div>
            <div className={styles.methodTitle}>Enter Manually</div>
            <div className={styles.methodDesc}>Type in your card details</div>
          </button>
        </div>
      )}

      {(addMethod === "manual" || addMethod === "scan") && (
        <form className={`panel ${styles.panel}`} onSubmit={handleSubmit}>
        <div className={styles.imageSection}>
          <label className={styles.field}>
            <span>Card Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </label>

          {cardImagePreview ? (
            <Image
              src={cardImagePreview}
              alt="Card preview"
              width={300}
              height={420}
              sizes="(max-width: 768px) 100vw, 400px"
              className={styles.imagePreview}
              unoptimized
            />
          ) : (
            <div className={styles.imagePlaceholder}>No photo selected</div>
          )}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Card Name *</span>
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., 1952 Mickey Mantle"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Player</span>
            <input
              name="player"
              type="text"
              value={formData.player}
              onChange={handleChange}
              placeholder="e.g., Mickey Mantle"
            />
          </label>

          <label className={styles.field}>
            <span>Card Number</span>
            <input
              name="cardNumber"
              type="text"
              value={formData.cardNumber}
              onChange={handleChange}
              placeholder="e.g., 054/112 or 001"
            />
          </label>

          <label className={styles.field}>
            <span>Brand</span>
            <input
              name="brand"
              type="text"
              value={formData.brand}
              onChange={handleChange}
              placeholder="Topps"
            />
          </label>

          <label className={styles.field}>
            <span>Year</span>
            <input
              name="year"
              type="number"
              value={formData.year}
              onChange={handleChange}
            />
          </label>

          <label className={styles.field}>
            <span>Value (USD) *</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                name="value"
                type="number"
                value={formData.value}
                onChange={handleChange}
                placeholder="0"
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleFetchPrice}
                disabled={fetchingPrice || !formData.name}
                className={styles.priceButton}
                title="Fetch current market price"
              >
                {fetchingPrice ? "⏳" : "💰"}
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span>Rarity</span>
            <select name="rarity" value={formData.rarity} onChange={handleChange}>
              <option value="Common">Common</option>
              <option value="Uncommon">Uncommon</option>
              <option value="Rare">Rare</option>
              <option value="Legendary">Legendary</option>
            </select>
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
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
            >
              <option value="Poor">Poor</option>
              <option value="Fair">Fair</option>
              <option value="Good">Good</option>
              <option value="Excellent">Excellent</option>
              <option value="Mint">Mint</option>
            </select>
          </label>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setAddMethod(null)}
          >
            Back to Methods
          </button>
          <button className={styles.primaryButton} type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Card"}
          </button>
        </div>
      </form>
      )}

      {showScanner && (
        <div className={styles.modalOverlay}>
          <AICardScanner
            onScanComplete={handleScanComplete}
            onCancel={() => setShowScanner(false)}
            userId={user.uid}
          />
        </div>
      )}

      {pendingScanMatches.length > 0 && (
        <div className={styles.modalOverlay}>
          <div className={styles.matchSelectionModal}>
            <h2 className={styles.matchSelectionTitle}>Possible Matches</h2>
            <p className={styles.matchSelectionSubtitle}>
              We found possible cards. Select the correct card for each scan before adding.
            </p>

            {pendingScanMatches.map((entry, scanIndex) => (
              <section key={`scan-${scanIndex}`} className={styles.matchSection}>
                <h3 className={styles.matchSectionTitle}>
                  We found {entry.possibleMatches.length} possible card{entry.possibleMatches.length > 1 ? "s" : ""}
                </h3>

                <div className={styles.matchCardsGrid}>
                  {entry.possibleMatches.map((candidate) => {
                    const isSelected = entry.selectedMatchId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`${styles.matchCard} ${isSelected ? styles.matchCardSelected : ""}`}
                        onClick={() => handleSelectMatch(scanIndex, candidate.id)}
                      >
                        <img
                          src={candidate.imageUrl || PLACEHOLDER_IMAGE_URL}
                          alt={candidate.name}
                          className={`${styles.matchCardImage} w-full rounded`}
                          onError={(event) => {
                            const target = event.currentTarget;
                            if (target.src.endsWith("/placeholder-card.svg")) return;
                            target.src = PLACEHOLDER_IMAGE_URL;
                          }}
                        />
                        <div className={styles.matchCardInfo}>
                          <div className={styles.matchCardName}>{candidate.name}</div>
                          <div className={styles.matchCardMeta}>
                            {candidate.year || "—"} • {candidate.brand || "Unknown Set"} • #{candidate.cardNumber || "—"}
                          </div>
                          {typeof candidate.confidence === "number" && (
                            <div className={styles.matchCardConfidence}>Confidence: {candidate.confidence}%</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setPendingScanMatches([])}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSaveSelectedMatches}
                disabled={saving}
              >
                {saving ? "Saving..." : "Add Selected Cards"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
