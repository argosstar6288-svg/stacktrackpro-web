"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
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

  const createDisabled = useMemo(() => {
    const validPrice = Number(startPrice) > 0;
    return !imageDataUrl || !cardName.trim() || !validPrice || !selectedDuration || submitting;
  }, [cardName, imageDataUrl, selectedDuration, startPrice, submitting]);

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

    if (!imageDataUrl || !cardName.trim() || !selectedDuration || parsedPrice <= 0) {
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
      const safeName = cardName.trim().replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
      const imageRef = ref(storage, `auction-images/${user.uid}/${Date.now()}-${safeName}.jpg`);
      await uploadString(imageRef, imageDataUrl, "data_url");
      const imageUrl = await getDownloadURL(imageRef);

      const auctionRef = doc(collection(db, "auctions"));

      await setDoc(auctionRef, {
        cardName: cardName.trim(),
        set: cardSet.trim(),
        year: parsedYear,
        condition,
        gradingCompany: gradingCompany.trim() || null,
        description: description.trim(),
        imageUrl,
        sellerId: user.uid,
        sellerName: user.displayName || user.email?.split("@")[0] || "Seller",
        startingPrice: parsedPrice,
        currentBid: parsedPrice,
        minimumNextBid: parsedPrice + 5,
        highestBidder: null,
        highestBidderId: null,
        bidCount: 0,
        status: "active",
        ended: false,
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
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/auctions/live" className={styles.backButton}>
          ← Back to Live Auctions
        </Link>
        <h1>Create New Auction</h1>
        <p>List your card for live bidding.</p>
      </div>

      <form onSubmit={createAuction} className={styles.form}>
        <div className={styles.topGrid}>
          <section className={styles.leftPanel}>
            <h2>Card Image</h2>
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
                <img src={imagePreview} alt="Card preview" className={styles.previewImage} />
              ) : (
                <div className={styles.previewPlaceholder}>Image preview appears here</div>
              )}
            </div>
          </section>

          <section className={styles.rightPanel}>
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
              <span>Set *</span>
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
