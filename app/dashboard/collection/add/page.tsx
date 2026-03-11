"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { addCard, type Card } from "../../../../lib/cards";
import { db, storage } from "../../../../lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  collection,
  doc,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useCurrentUser } from "../../../../lib/useCurrentUser";
import { FLAT_COLLECTIONS, type FlatMasterCard } from "../../../../lib/flatCollections";
import { buildCardLookup, buildSetID, inferGameID } from "../../../../lib/cardSchema";
import { generateStackTrackId } from "../../../../lib/universal-card-id";
import AICardScanner from "../../../../components/AICardScanner";
import styles from "./collection-add.module.css";

const PLACEHOLDER_IMAGE_URL = "/placeholder-card.svg";

interface PossibleMatch {
  id: string;
  cardId: string;
  name: string;
  finish?: "Holo" | "Reverse Holo";
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

interface SavedScanRecord {
  userCardID: string;
  cardID: string;
  gameID: string;
  setID: string;
  lookup: string;
  cardName: string;
  cardBrand: string;
  cardNumber: string;
  selectedMatch: PossibleMatch;
  scanResult: any;
  scannedImage: string;
}

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

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

  const cacheCardMetadata = async (
    cardId: string,
    cardName: string,
    cardData: any
  ): Promise<void> => {
    try {
      await fetch("/api/cache-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardID: cardId,
          gameID: inferGameID({ sport: cardData.sport, name: cardName, brand: cardData.brand }),
          setID: buildSetID(cardData.setName || cardData.brand),
          lookup: buildCardLookup({
            name: cardName,
            cardNumber: cardData.cardNumber || "",
            setName: cardData.setName || cardData.brand || "",
          }),
          stacktrackId: cardId,
          name: cardName,
          player: cardData.player || "",
          year: Number(cardData.year) || new Date().getFullYear(),
          brand: cardData.brand || "",
          sport: cardData.sport || "Other",
          condition: cardData.condition || "Good",
          cardNumber: cardData.cardNumber || "",
          setName: cardData.setName || cardData.brand || "",
          isGraded: cardData.isGraded || false,
          gradingCompany: cardData.gradingCompany,
          grade: cardData.grade,
          estimatedValue: Number(cardData.estimatedValue || 0),
          imageUrl: cardData.imageUrl,
        }),
      });
      console.log(`[Collection Add] Cached metadata for ${cardId}`);
    } catch (e) {
      console.warn(`[Collection Add] Failed to cache card metadata for ${cardId}:`, e);
      // Don't fail the add operation if caching fails
    }
  };

  const queueBackgroundPriceUpdate = async (uid: string, cardIds: string[]): Promise<void> => {
    if (!uid) return;

    try {
      const idToken = await user?.getIdToken();
      if (!idToken) return;

      await fetch("/api/background-price-updater", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: "enqueue",
          userId: uid,
          cardIds,
        }),
      });
    } catch (queueError) {
      console.warn("[Collection Add] Failed to queue background price update:", queueError);
    }
  };

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

  const getHoloFinishLabel = (value: unknown): "Holo" | "Reverse Holo" | undefined => {
    if (typeof value !== "string") return undefined;

    const normalized = value.toLowerCase();
    if (normalized.includes("reverse") && (normalized.includes("holo") || normalized.includes("foil"))) {
      return "Reverse Holo";
    }

    if (normalized.includes("holo") || normalized.includes("foil")) {
      return "Holo";
    }

    return undefined;
  };

  const resolveMatchFinish = (match: any, result: any): "Holo" | "Reverse Holo" | undefined => {
    const directVariantLabel =
      getHoloFinishLabel(match?.variant) ||
      getHoloFinishLabel(match?.cardData?.variant) ||
      getHoloFinishLabel(match?.cardData?.dna?.variant) ||
      getHoloFinishLabel(result?.variant);

    if (directVariantLabel) {
      return directVariantLabel;
    }

    const variantPricing = match?.cardData?.pricing?.variants || match?.pricing?.variants;
    if (variantPricing && typeof variantPricing === "object") {
      if (variantPricing.reverseHolofoil != null) {
        return "Reverse Holo";
      }
      if (variantPricing.holofoil != null) {
        return "Holo";
      }
    }

    const tcgPrices = match?.cardData?.tcgplayer?.prices || match?.tcgplayer?.prices;
    if (tcgPrices && typeof tcgPrices === "object") {
      if ((tcgPrices as any).reverseHolofoil) {
        return "Reverse Holo";
      }
      if ((tcgPrices as any).holofoil) {
        return "Holo";
      }
    }

    return undefined;
  };

  const formatCardIdForDisplay = (cardId?: string): string => {
    if (!cardId) return "—";
    if (cardId.length <= 24) return cardId;
    return `${cardId.slice(0, 16)}…${cardId.slice(-6)}`;
  };

  const toConfidencePercent = (value: unknown): number => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    if (value <= 1) {
      return Math.max(0, Math.min(100, Math.round(value * 100)));
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  };

  const handleSelectMatch = (scanIndex: number, selectedMatchId: string) => {
    setPendingScanMatches((previous) =>
      previous.map((entry, index) =>
        index === scanIndex
          ? { ...entry, selectedMatchId }
          : entry
      )
    );
  };

  const loadMasterCards = async (cardIds: string[]) => {
    const uniqueCardIds = Array.from(new Set(cardIds.filter(Boolean)));
    const masterByCardId = new Map<string, FlatMasterCard>();
    const chunkedIds = chunkArray(uniqueCardIds, 10);

    for (const chunk of chunkedIds) {
      const byDocIdQuery = query(
        collection(db, FLAT_COLLECTIONS.cards),
        where(documentId(), "in", chunk)
      );
      const snapshot = await getDocs(byDocIdQuery);

      snapshot.docs.forEach((docSnapshot) => {
        const data = { id: docSnapshot.id, ...docSnapshot.data() } as FlatMasterCard;
        const resolvedCardID = String(data.cardID || docSnapshot.id);
        masterByCardId.set(resolvedCardID, data);
      });
    }

    const unresolved = uniqueCardIds.filter((cardId) => !masterByCardId.has(cardId));
    const unresolvedChunks = chunkArray(unresolved, 10);

    for (const chunk of unresolvedChunks) {
      const byCardIdQuery = query(
        collection(db, FLAT_COLLECTIONS.cards),
        where("cardID", "in", chunk)
      );
      const snapshot = await getDocs(byCardIdQuery);

      snapshot.docs.forEach((docSnapshot) => {
        const data = { id: docSnapshot.id, ...docSnapshot.data() } as FlatMasterCard;
        const resolvedCardID = String(data.cardID || docSnapshot.id);
        masterByCardId.set(resolvedCardID, data);
      });
    }

    return masterByCardId;
  };

  const loadGlobalIndexCards = async (cardIds: string[]) => {
    const uniqueCardIds = Array.from(new Set(cardIds.filter(Boolean)));
    const indexByCardId = new Map<string, any>();
    const chunkedIds = chunkArray(uniqueCardIds, 10);

    for (const chunk of chunkedIds) {
      const byDocIdQuery = query(
        collection(db, FLAT_COLLECTIONS.globalCardIndex),
        where(documentId(), "in", chunk)
      );
      const snapshot = await getDocs(byDocIdQuery);

      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() || {};
        const resolvedCardID = String(data.cardID || docSnapshot.id);
        indexByCardId.set(resolvedCardID, data);
      });
    }

    return indexByCardId;
  };

  const hydrateSavedScanRecords = async (uid: string, records: SavedScanRecord[]) => {
    if (!records.length) return;

    try {
      const cardIds = records.map((record) => record.cardID);
      const [masterByCardID, indexByCardID] = await Promise.all([
        loadMasterCards(cardIds),
        loadGlobalIndexCards(cardIds),
      ]);

      const batch = writeBatch(db);
      const pendingImageUploads: Array<{ cardDocId: string; userCardID: string; cardName: string; dataUrl: string }> = [];
      const createdCardDocIds: string[] = [];

      for (const record of records) {
        const master = masterByCardID.get(record.cardID);
        const indexed = indexByCardID.get(record.cardID);

        const resolvedName = master?.name || indexed?.name || record.cardName;
        const resolvedSet = master?.set || indexed?.set || record.cardBrand;
        const resolvedNumber = master?.number || indexed?.number || record.cardNumber;
        const resolvedLookup = master?.lookup || indexed?.lookup || record.lookup;

        let imageUrl =
          master?.image ||
          indexed?.image ||
          record.selectedMatch.imageUrl ||
          record.scanResult?.imageUrl ||
          record.scanResult?.photoUrl ||
          PLACEHOLDER_IMAGE_URL;

        if (record.scannedImage && !record.scannedImage.startsWith("data:") && imageUrl === PLACEHOLDER_IMAGE_URL) {
          imageUrl = record.scannedImage;
        }

        const cardRef = doc(collection(db, "cards"));
        createdCardDocIds.push(cardRef.id);

        if (record.scannedImage && record.scannedImage.startsWith("data:")) {
          pendingImageUploads.push({
            cardDocId: cardRef.id,
            userCardID: record.userCardID,
            cardName: resolvedName,
            dataUrl: record.scannedImage,
          });
        }

        batch.set(cardRef, {
          userId: uid,
          cardID: record.cardID,
          gameID: record.gameID,
          setID: record.setID,
          lookup: resolvedLookup,
          name: resolvedName,
          value: Number(record.scanResult?.estimatedValue || master?.avgPrice || 0),
          marketPrice: Number(master?.avgPrice || record.scanResult?.estimatedValue || 0),
          priceLastUpdated: new Date().toISOString(),
          rarity: "Uncommon",
          player: record.selectedMatch.player || record.scanResult?.player || "",
          cardNumber: resolvedNumber,
          brand: resolvedSet,
          year: Number(record.selectedMatch.year || record.scanResult?.year || master?.year) || new Date().getFullYear(),
          sport: getSafeSport(record.selectedMatch.sport || record.scanResult?.sport),
          condition: (record.scanResult?.condition || "Good") as Card["condition"],
          imageUrl,
          photoUrl: imageUrl,
          addedAt: serverTimestamp(),
        });

        batch.set(
          doc(db, FLAT_COLLECTIONS.userCards, record.userCardID),
          {
            gameID: record.gameID,
            setID: record.setID,
            lookup: resolvedLookup,
            cardName: resolvedName,
            cardNumber: resolvedNumber,
            brand: resolvedSet,
            condition: record.scanResult?.condition || "Good",
            value: Number(record.scanResult?.estimatedValue || master?.avgPrice || 0),
            imageUrl,
            photoUrl: imageUrl,
            legacyCardDocID: cardRef.id,
            hydratedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const scanRef = doc(collection(db, FLAT_COLLECTIONS.scans));
        batch.set(scanRef, {
          userID: uid,
          cardID: record.cardID,
          gameID: record.gameID,
          setID: record.setID,
          lookup: resolvedLookup,
          image: record.scannedImage || imageUrl || PLACEHOLDER_IMAGE_URL,
          detectedCard: record.cardID,
          confidence: Number(record.scanResult?.confidence || 0),
          timestamp: serverTimestamp(),
        });

        void cacheCardMetadata(record.cardID, resolvedName, {
          player: record.selectedMatch.player || record.scanResult?.player,
          year: record.selectedMatch.year || record.scanResult?.year,
          brand: resolvedSet,
          sport: record.selectedMatch.sport || record.scanResult?.sport,
          condition: record.scanResult?.condition,
          cardNumber: resolvedNumber,
          setName: resolvedSet,
          isGraded: record.scanResult?.isGraded,
          gradingCompany: record.scanResult?.gradingCompany,
          grade: record.scanResult?.grade,
          estimatedValue: record.scanResult?.estimatedValue,
          imageUrl: imageUrl !== PLACEHOLDER_IMAGE_URL ? imageUrl : undefined,
        });
      }

      await batch.commit();

      if (createdCardDocIds.length > 0) {
        void queueBackgroundPriceUpdate(uid, createdCardDocIds);
      }

      if (pendingImageUploads.length > 0) {
        void Promise.allSettled(
          pendingImageUploads.map(async (pendingUpload) => {
            try {
              const uploadedImageUrl = await uploadScannedImage(
                uid,
                pendingUpload.cardName,
                pendingUpload.dataUrl
              );

              if (!uploadedImageUrl || uploadedImageUrl === PLACEHOLDER_IMAGE_URL) {
                return;
              }

              await Promise.all([
                updateDoc(doc(db, "cards", pendingUpload.cardDocId), {
                  imageUrl: uploadedImageUrl,
                  photoUrl: uploadedImageUrl,
                }),
                updateDoc(doc(db, FLAT_COLLECTIONS.userCards, pendingUpload.userCardID), {
                  imageUrl: uploadedImageUrl,
                  photoUrl: uploadedImageUrl,
                }),
              ]);
            } catch (uploadError) {
              console.error(
                `Failed deferred image upload for card ${pendingUpload.cardDocId}:`,
                uploadError
              );
            }
          })
        );
      }
    } catch (hydrationError) {
      console.error("[Collection Add] Deferred scan hydration failed:", hydrationError);
    }
  };

  const saveScanMatches = async (
    matches: PendingScanMatch[],
    options?: { instantMode?: boolean; avgLatencyMs?: number }
  ) => {
    if (!matches.length) return;

    try {
      setSaving(true);
      setError(options?.instantMode ? "Auto-adding scanned card to your collection..." : "Saving selected cards to your collection...");

      const batch = writeBatch(db);
      const savedScanRecords: SavedScanRecord[] = [];

      for (let i = 0; i < matches.length; i++) {
        const entry = matches[i];
        const selectedMatch =
          entry.possibleMatches.find((match) => match.id === entry.selectedMatchId) ||
          entry.possibleMatches[0];

        if (!selectedMatch) {
          throw new Error(`Missing selected match for scanned card ${i + 1}`);
        }

        const result = entry.scanResult;
        const cardName = selectedMatch.name || result.name || "Scanned Card";
        const cardBrand = selectedMatch.brand || result.setName || result.brand || "";
        const cardNumber = selectedMatch.cardNumber || result.cardNumber || "";
        const gameID = inferGameID({
          sport: selectedMatch.sport || result.sport,
          name: cardName,
          brand: cardBrand,
        });
        const setID = buildSetID(cardBrand);
        const lookup = buildCardLookup({
          name: cardName,
          cardNumber,
          setName: cardBrand,
        });
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

        const userCardRef = doc(collection(db, FLAT_COLLECTIONS.userCards));
        batch.set(userCardRef, {
          userCardID: userCardRef.id,
          userID: user.uid,
          cardID: cardId,
          added: serverTimestamp(),
          folder: "",
          folderID: "",
        });

        savedScanRecords.push({
          userCardID: userCardRef.id,
          cardID: cardId,
          gameID,
          setID,
          lookup,
          cardName,
          cardBrand,
          cardNumber,
          selectedMatch,
          scanResult: result,
          scannedImage,
        });
      }

      await batch.commit();

      void hydrateSavedScanRecords(user.uid, savedScanRecords);

      const savedCount = matches.length;
      setPendingScanMatches([]);
      setError("");

      const latencyParam =
        typeof options?.avgLatencyMs === "number" ? `&scanLatencyMs=${options.avgLatencyMs}` : "";

      router.push(`/dashboard/collection?savedFromScan=1&savedCount=${savedCount}${latencyParam}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save selected cards");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSelectedMatches = async () => {
    if (!pendingScanMatches.length) return;
    await saveScanMatches(pendingScanMatches);
  };

  const handleScanComplete = async (
    results: any[],
    options?: { instantMode?: boolean; autoAdd?: boolean; avgLatencyMs?: number }
  ) => {
    if (!results.length) {
      setShowScanner(false);
      setError("No scan results were returned.");
      return;
    }

    if (options?.autoAdd) {
      setShowScanner(false);

      const autoMatches: PendingScanMatch[] = results.map((result, index) => {
        const fallbackMatch: PossibleMatch = {
          id: `${index}-instant-auto`,
          cardId: buildFallbackCardId(result),
          name: result.name || "Scanned Card",
          finish: getHoloFinishLabel(result.variant),
          player: result.player || "",
          year: Number(result.year) || new Date().getFullYear(),
          brand: result.setName || result.brand || "",
          sport: result.sport || "Other",
          cardNumber: result.cardNumber || "",
          imageUrl: result.imageUrl || result.photoUrl || PLACEHOLDER_IMAGE_URL,
          confidence: typeof result.confidence === "number" ? Math.round(result.confidence * 100) : 0,
        };

        return {
          scanResult: result,
          possibleMatches: [fallbackMatch],
          selectedMatchId: fallbackMatch.id,
        };
      });

      await saveScanMatches(autoMatches, {
        instantMode: true,
        avgLatencyMs: options?.avgLatencyMs,
      });
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
              finish: resolveMatchFinish(match, result),
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
                finish: getHoloFinishLabel(result.variant),
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
              finish: getHoloFinishLabel(result.variant),
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

      void queueBackgroundPriceUpdate(user.uid, [createdCardId]);

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
            </div>
            <small style={{ color: "#9fb3c8" }}>
              Market values refresh in the background after save.
            </small>
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

                <div className={styles.aiConfidencePanel}>
                  <p className={styles.aiConfidenceTitle}>AI Confidence Score</p>
                  <div className={styles.aiConfidenceRow}>
                    <span>Card detected</span>
                    <strong>{entry.scanResult?.name || "Unknown Card"}</strong>
                  </div>
                  <div className={styles.aiConfidenceRow}>
                    <span>Confidence</span>
                    <strong>{toConfidencePercent(entry.scanResult?.confidence)}%</strong>
                  </div>
                </div>

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
                          <div className={styles.matchCardMeta}>
                            <span className={styles.cardIdBadge} title={candidate.cardId || "Unavailable"}>
                              {formatCardIdForDisplay(candidate.cardId)}
                            </span>
                          </div>
                          {candidate.finish && (
                            <div>
                              <span className={styles.finishBadge}>{candidate.finish}</span>
                            </div>
                          )}
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
