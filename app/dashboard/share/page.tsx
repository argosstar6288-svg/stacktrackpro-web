"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUserCards, type Card } from "@/lib/cards";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";
import styles from "./share.module.css";

type ShareMode = "card" | "collection";

type ShareOptions = {
  showMonthlyValueStat: boolean;
  showRarityStat: boolean;
  showWatermark: boolean;
};

const PLACEHOLDER_IMAGE = "/placeholder-card.svg";

const cardRarityPercentile = (card?: Card | null) => {
  const rarity = `${card?.rarityTier || card?.rarity || ""}`.toLowerCase();
  if (rarity.includes("legendary") || rarity.includes("ultra")) return 10;
  if (rarity.includes("rare")) return 20;
  if (rarity.includes("uncommon")) return 40;
  if (rarity.includes("common")) return 70;
  return 50;
};

const isRenderableImage = (value?: string) => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  );
};

const resolveImage = (card?: Card | null) => {
  const selected = [
    card?.imageUrl,
    card?.photoUrl,
    card?.frontImageUrl,
    card?.thumbnailUrl,
  ].find((value) => isRenderableImage(value));

  return selected || PLACEHOLDER_IMAGE;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const clamped = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + clamped, y);
  ctx.lineTo(x + width - clamped, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + clamped);
  ctx.lineTo(x + width, y + height - clamped);
  ctx.quadraticCurveTo(x + width, y + height, x + width - clamped, y + height);
  ctx.lineTo(x + clamped, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - clamped);
  ctx.lineTo(x, y + clamped);
  ctx.quadraticCurveTo(x, y, x + clamped, y);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageWidth = (image as any).width || width;
  const imageHeight = (image as any).height || height;
  const sourceRatio = imageWidth / imageHeight;
  const targetRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = imageHeight * targetRatio;
    sourceX = (imageWidth - sourceWidth) / 2;
  } else {
    sourceHeight = imageWidth / targetRatio;
    sourceY = (imageHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function formatPercentLabel(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% value this month`;
}

export default function SharePage() {
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { cards, loading } = useUserCards();
  const { currency } = useCurrency();

  const [mode, setMode] = useState<ShareMode>("card");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [options, setOptions] = useState<ShareOptions>({
    showMonthlyValueStat: true,
    showRarityStat: true,
    showWatermark: true,
  });
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [copyState, setCopyState] = useState("");

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    const requestedCardId = searchParams.get("cardId");

    if (requestedMode === "collection" || requestedMode === "card") {
      setMode(requestedMode);
    }

    if (requestedCardId) {
      setSelectedCardId(requestedCardId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!cards.length) return;
    if (!selectedCardId) {
      setSelectedCardId(cards[0]?.id || "");
    }
  }, [cards, selectedCardId]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) || cards[0] || null,
    [cards, selectedCardId]
  );

  const featuredCard = useMemo(() => {
    if (!cards.length) return null;
    return [...cards].sort((a, b) => Number(b.marketPrice ?? b.value ?? 0) - Number(a.marketPrice ?? a.value ?? 0))[0];
  }, [cards]);

  const monthlyValueChange = useMemo(() => {
    if (mode === "card") {
      if (!selectedCard) return 0;
      const base = Number(selectedCard.value || 0);
      const current = Number(selectedCard.marketPrice ?? selectedCard.value ?? 0);
      if (base <= 0) return 0;
      return ((current - base) / base) * 100;
    }

    const baseTotal = cards.reduce((sum, card) => sum + Number(card.value || 0), 0);
    const currentTotal = cards.reduce(
      (sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0),
      0
    );

    if (baseTotal <= 0) return 0;
    return ((currentTotal - baseTotal) / baseTotal) * 100;
  }, [cards, mode, selectedCard]);

  const rarityPercentile = useMemo(() => {
    if (mode === "card") {
      return cardRarityPercentile(selectedCard);
    }

    return cardRarityPercentile(featuredCard);
  }, [featuredCard, mode, selectedCard]);

  const watermarkText = useMemo(() => {
    const username = user?.displayName || user?.email?.split("@")[0] || user?.uid || "collector";
    return `@${String(username).replace(/\s+/g, "").slice(0, 18)}`;
  }, [user]);

  const renderShare = useCallback(async () => {
    if (!cards.length || (mode === "card" && !selectedCard)) {
      setPreviewDataUrl("");
      return;
    }

    setIsRendering(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setPreviewDataUrl("");
        return;
      }

      const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1350);
      bgGradient.addColorStop(0, "#0c1018");
      bgGradient.addColorStop(0.55, "#0d1320");
      bgGradient.addColorStop(1, "#111a2b");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const glowGradient = ctx.createRadialGradient(860, 180, 50, 860, 180, 380);
      glowGradient.addColorStop(0, "rgba(255, 143, 0, 0.30)");
      glowGradient.addColorStop(1, "rgba(255, 143, 0, 0)");
      ctx.fillStyle = glowGradient;
      ctx.fillRect(540, 0, 540, 520);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      drawRoundedRect(ctx, 48, 52, 984, 1248, 30);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 143, 0, 0.42)";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 48, 52, 984, 1248, 30);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "600 30px Inter, system-ui, sans-serif";
      ctx.fillText("STACKTRACK FLEX", 88, 118);

      if (mode === "card" && selectedCard) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "700 56px Inter, system-ui, sans-serif";
        const cardName = String(selectedCard.name || "Card").slice(0, 28);
        ctx.fillText(cardName, 88, 186);

        const imageUrl = resolveImage(selectedCard);
        const image = await loadImage(imageUrl);

        ctx.fillStyle = "rgba(16, 22, 34, 0.95)";
        drawRoundedRect(ctx, 88, 220, 904, 730, 26);
        ctx.fill();

        if (image) {
          ctx.save();
          drawRoundedRect(ctx, 88, 220, 904, 730, 26);
          ctx.clip();
          drawImageCover(ctx, image, 88, 220, 904, 730);
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.font = "500 42px Inter, system-ui, sans-serif";
          ctx.fillText("No image available", 350, 590);
        }

        ctx.fillStyle = "rgba(255,255,255,0.84)";
        ctx.font = "500 30px Inter, system-ui, sans-serif";
        const condition = selectedCard.condition || "Not graded";
        ctx.fillText(`Condition: ${condition}`, 88, 1010);

        const currentValue = Number(selectedCard.marketPrice ?? selectedCard.value ?? 0);
        ctx.font = "700 38px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#ffb259";
        ctx.fillText(`Value ${formatCurrency(currentValue, currency)}`, 88, 1060);
      } else {
        const collectionTotal = cards.reduce(
          (sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0),
          0
        );

        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "700 52px Inter, system-ui, sans-serif";
        ctx.fillText("Collection Flex", 88, 186);

        const collageCards = [...cards]
          .sort((a, b) => Number(b.marketPrice ?? b.value ?? 0) - Number(a.marketPrice ?? a.value ?? 0))
          .slice(0, 4);

        const slots = [
          { x: 88, y: 230, w: 442, h: 350 },
          { x: 550, y: 230, w: 442, h: 350 },
          { x: 88, y: 600, w: 442, h: 350 },
          { x: 550, y: 600, w: 442, h: 350 },
        ];

        for (let i = 0; i < slots.length; i += 1) {
          const slot = slots[i];
          const card = collageCards[i];
          ctx.fillStyle = "rgba(16, 22, 34, 0.95)";
          drawRoundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 20);
          ctx.fill();

          if (!card) continue;

          const image = await loadImage(resolveImage(card));
          if (!image) continue;

          ctx.save();
          drawRoundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 20);
          ctx.clip();
          drawImageCover(ctx, image, slot.x, slot.y, slot.w, slot.h);
          ctx.restore();
        }

        ctx.fillStyle = "rgba(255,255,255,0.84)";
        ctx.font = "500 30px Inter, system-ui, sans-serif";
        ctx.fillText(`Cards: ${cards.length}`, 88, 1035);
        ctx.fillText(`Collection Value: ${formatCurrency(collectionTotal, currency)}`, 88, 1080);

        const featuredCondition = featuredCard?.condition || "Mixed";
        ctx.fillText(`Featured Condition: ${featuredCondition}`, 88, 1125);
      }

      let statY = 1170;
      if (options.showMonthlyValueStat) {
        ctx.fillStyle = "rgba(30, 144, 255, 0.22)";
        drawRoundedRect(ctx, 88, statY, 520, 56, 28);
        ctx.fill();
        ctx.fillStyle = "rgba(214, 233, 255, 0.98)";
        ctx.font = "600 26px Inter, system-ui, sans-serif";
        ctx.fillText(formatPercentLabel(monthlyValueChange), 112, statY + 37);
        statY += 72;
      }

      if (options.showRarityStat) {
        ctx.fillStyle = "rgba(255, 143, 0, 0.22)";
        drawRoundedRect(ctx, 88, statY, 400, 56, 28);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 238, 214, 0.98)";
        ctx.font = "600 26px Inter, system-ui, sans-serif";
        ctx.fillText(`Top ${rarityPercentile}% rarity`, 112, statY + 37);
      }

      if (options.showWatermark) {
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.font = "600 30px Inter, system-ui, sans-serif";
        ctx.fillText(watermarkText, 988, 1240);
        ctx.textAlign = "left";
      }

      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Error rendering share card:", error);
      setPreviewDataUrl("");
    } finally {
      setIsRendering(false);
    }
  }, [cards, currency, featuredCard, mode, monthlyValueChange, options, rarityPercentile, selectedCard, watermarkText]);

  useEffect(() => {
    void renderShare();
  }, [renderShare]);

  const handleDownload = () => {
    if (!previewDataUrl) return;
    const link = document.createElement("a");
    const fileMode = mode === "card" ? "card" : "collection";
    link.download = `stacktrack-flex-${fileMode}-${Date.now()}.png`;
    link.href = previewDataUrl;
    link.click();
  };

  const handleCopyImage = async () => {
    if (!previewDataUrl) return;

    try {
      const blob = await fetch(previewDataUrl).then((response) => response.blob());

      if (typeof window !== "undefined" && "ClipboardItem" in window && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopyState("Image copied — paste anywhere.");
      } else {
        await navigator.clipboard.writeText(previewDataUrl);
        setCopyState("Image data copied.");
      }
    } catch (error) {
      console.error("Failed to copy image:", error);
      setCopyState("Could not copy image.");
    }

    setTimeout(() => setCopyState(""), 2200);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <section className={`panel ${styles.panel}`}>
          <p className={styles.stateText}>Loading your cards...</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`panel ${styles.panel}`}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Share Studio</p>
            <h1 className={styles.title}>Flex Card Generator</h1>
          </div>
          <Link className={styles.secondaryAction} href="/dashboard/inbox">
            Open Inbox
          </Link>
        </div>

        <div className={styles.modeRow}>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "card" ? styles.modeButtonActive : ""}`}
            onClick={() => setMode("card")}
          >
            Single Card
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "collection" ? styles.modeButtonActive : ""}`}
            onClick={() => setMode("collection")}
          >
            Whole Collection
          </button>
        </div>

        {mode === "card" && (
          <label className={styles.field}>
            <span>Card</span>
            <select
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
            >
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} {card.condition ? `• ${card.condition}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={styles.optionsWrap}>
          <label className={styles.optionItem}>
            <input
              type="checkbox"
              checked={options.showMonthlyValueStat}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  showMonthlyValueStat: event.target.checked,
                }))
              }
            />
            <span>Show “+12% value this month” stat</span>
          </label>

          <label className={styles.optionItem}>
            <input
              type="checkbox"
              checked={options.showRarityStat}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  showRarityStat: event.target.checked,
                }))
              }
            />
            <span>Show “Top 10% rarity” stat</span>
          </label>

          <label className={styles.optionItem}>
            <input
              type="checkbox"
              checked={options.showWatermark}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  showWatermark: event.target.checked,
                }))
              }
            />
            <span>Show username watermark</span>
          </label>
        </div>

        <div className={styles.previewWrap}>
          {previewDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewDataUrl} alt="Share preview" className={styles.previewImage} />
          ) : (
            <p className={styles.stateText}>No preview available.</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={handleDownload}
            disabled={!previewDataUrl || isRendering}
          >
            {isRendering ? "Rendering..." : "Download PNG"}
          </button>
          <button
            type="button"
            className={styles.secondaryActionButton}
            onClick={() => void handleCopyImage()}
            disabled={!previewDataUrl || isRendering}
          >
            Copy Image
          </button>
          <Link className={styles.secondaryAction} href="/dashboard/collection">
            Back to Collection
          </Link>
        </div>

        {copyState && <p className={styles.copyState}>{copyState}</p>}
      </section>
    </div>
  );
}
