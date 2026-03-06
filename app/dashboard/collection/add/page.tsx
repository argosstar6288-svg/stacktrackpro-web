"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { addCard, type Card } from "../../../../lib/cards";
import { storage } from "../../../../lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useCurrentUser } from "../../../../lib/useCurrentUser";
import AICardScanner from "../../../../components/AICardScanner";
import styles from "./collection-add.module.css";

const PLACEHOLDER_IMAGE_URL = "/placeholder-card.svg";

export default function CollectionAddPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
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

  const handleScanComplete = async (results: any[]) => {
    if (!results.length) {
      setShowScanner(false);
      setError("No scan results were returned.");
      return;
    }

    try {
      setSaving(true);
      setError(`Saving ${results.length} scanned card${results.length > 1 ? "s" : ""} to your collection...`);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        setError(`Saving card ${i + 1} of ${results.length}...`);

        let imageUrl = PLACEHOLDER_IMAGE_URL;
        const scannedImage =
          (typeof result?.imageUrl === "string" && result.imageUrl) ||
          (typeof result?.photoUrl === "string" && result.photoUrl) ||
          "";

        if (scannedImage && scannedImage.startsWith("data:")) {
          imageUrl = await uploadScannedImage(user.uid, result.name || "scanned-card", scannedImage);
        } else if (scannedImage) {
          imageUrl = scannedImage;
        }

        await addCard(user.uid, {
          name: result.name || "Scanned Card",
          value: Number(result.estimatedValue || 0),
          marketPrice: Number(result.estimatedValue || 0),
          priceLastUpdated: new Date().toISOString(),
          rarity: "Uncommon",
          player: result.player || "",
          cardNumber: result.cardNumber || "",
          brand: result.brand || "",
          year: Number(result.year) || new Date().getFullYear(),
          sport: (result.sport || "Other") as Card["sport"],
          condition: (result.condition || "Good") as Card["condition"],
          imageUrl,
          photoUrl: imageUrl,
        });
      }

      setShowScanner(false);
      router.push(`/dashboard/collection?savedFromScan=1&savedCount=${results.length}`);
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
      if (cardImageFile) {
        imageUrl = await uploadCardImage(user.uid, formData.name, cardImageFile);
      } else if (cardImagePreview) {
        imageUrl = cardImagePreview;
      }

      await addCard(user.uid, {
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
      });

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
    </div>
  );
}
