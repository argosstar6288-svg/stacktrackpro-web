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

  const handleScanComplete = async (results: any[]) => {
    setShowScanner(false);
    
    if (results.length === 1) {
      // Single card - populate the form
      const result = results[0];
      const scannedImage =
        (typeof result?.imageUrl === "string" && result.imageUrl) ||
        (typeof result?.photoUrl === "string" && result.photoUrl) ||
        "";

      setFormData({
        name: result.name || "",
        player: result.player || "",
        brand: result.brand || "",
        year: result.year?.toString() || new Date().getFullYear().toString(),
        sport: result.sport || "Baseball",
        condition: result.condition || "Mint",
        value: result.estimatedValue?.toString() || "",
        rarity: "Uncommon",
      });
      setCardImagePreview(scannedImage);
      setCardImageFile(null);
      setError("");
    } else {
      // Multiple cards - save them all directly
      try {
        setSaving(true);
        setError(`Saving ${results.length} cards...`);
        
        for (const result of results) {
          await addCard(user.uid, {
            name: result.name,
            value: result.estimatedValue,
            rarity: "Uncommon",
            player: result.player || "",
            brand: result.brand || "",
            year: result.year || new Date().getFullYear(),
            sport: result.sport as Card["sport"],
            condition: result.condition as Card["condition"],
            imageUrl:
              (typeof result?.imageUrl === "string" && result.imageUrl) ||
              (typeof result?.photoUrl === "string" && result.photoUrl) ||
              PLACEHOLDER_IMAGE_URL,
          });
        }
        
        router.push("/dashboard/collection");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save cards");
        setSaving(false);
      }
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

      <div className={styles.scannerPrompt}>
        <button
          className={styles.scanButton}
          onClick={() => setShowScanner(true)}
          type="button"
        >
          📷 Scan Card with AI
        </button>
        <span className={styles.orDivider}>or enter manually</span>
      </div>

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
            <input
              name="value"
              type="number"
              value={formData.value}
              onChange={handleChange}
              placeholder="0"
              required
            />
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
          <Link className={styles.ghostButton} href="/dashboard/collection">
            Cancel
          </Link>
          <button className={styles.primaryButton} type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Card"}
          </button>
        </div>
      </form>

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
