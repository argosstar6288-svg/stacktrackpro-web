"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";
import { auth } from "@/lib/firebase";
import { detectCardBounds, cropCanvas } from "@/lib/imagePreprocessing";
import styles from "./AICardScanner.module.css";

interface CardScanResult {
  name: string;
  player: string;
  cardNumber?: string;
  setName?: string;
  year: number;
  brand: string;
  sport: string;
  condition: string;
  isGraded: boolean;
  gradingCompany?: string;
  grade?: string;
  estimatedValue: number;
  confidence: number;
  imageUrl?: string;
  photoUrl?: string;
  processingMs?: number;
  scanMode?: "instant" | "standard";
}

interface AICardScannerProps {
  onScanComplete: (
    results: CardScanResult[],
    options?: { instantMode?: boolean; autoAdd?: boolean; avgLatencyMs?: number }
  ) => void;
  onCancel: () => void;
  userId?: string;
}

type ScannerView = "scanner" | "result" | "bulk";

const TARGET_SCAN_IMAGE_SIZE = 800;
const MAX_CARDS_PER_BATCH = 50;
const PRIMARY_SCAN_TIMEOUT_MS = 5000;
const FALLBACK_SCAN_TIMEOUT_MS = 3500;

const CONDITION_OPTIONS = ["Mint", "Excellent", "Good", "Fair", "Poor", "Near Mint"];

function getScanErrorMessage(errorData: any): string {
  const errorMessage = String(
    errorData?.message || errorData?.details || errorData?.error || "Failed to scan"
  );

  if (errorData?.quotaExceeded) {
    return errorData?.message || "AI scan limit reached for your account. Upgrade your plan or add cards manually.";
  }

  if (errorData?.providerQuotaExceeded) {
    return "AI scanning is temporarily unavailable due to service billing limits. Please try again later or add cards manually.";
  }

  if (errorData?.configurationError) {
    return "AI scanning is temporarily unavailable on this deployment. Please try again in a minute.";
  }

  if (
    String(errorData?.type || "").toLowerCase().includes("invalid_request_error") &&
    (String(errorData?.error || "").toLowerCase().includes("couldn't read this image") ||
      String(errorData?.message || "").toLowerCase().includes("couldn't read this image") ||
      String(errorData?.error || "").toLowerCase().includes("unsupported image"))
  ) {
    return "We couldn't read this image. Please upload a clear JPG or PNG photo of a single card.";
  }

  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("exceeded your current quota") ||
    normalized.includes("check your plan and billing")
  ) {
    return "AI scanning is temporarily unavailable due to service billing limits. Please try again later or add cards manually.";
  }

  if (
    normalized.includes("not configured for this environment") ||
    normalized.includes("api key not configured") ||
    normalized.includes("temporarily unavailable on this deployment")
  ) {
    return "AI scanning is temporarily unavailable on this deployment. Please try again in a minute.";
  }

  return errorMessage;
}

function normalizeErrorText(rawMessage: string): string {
  const normalized = String(rawMessage || "").toLowerCase();
  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("exceeded your current quota") ||
    normalized.includes("check your plan and billing") ||
    normalized.includes("platform.openai.com/docs/guides/error-codes/api-errors")
  ) {
    return "AI scanning is temporarily unavailable due to service billing limits. Please try again later or add cards manually.";
  }

  if (
    normalized.includes("not configured for this environment") ||
    normalized.includes("api key not configured") ||
    normalized.includes("temporarily unavailable on this deployment")
  ) {
    return "AI scanning is temporarily unavailable on this deployment. Please try again in a minute.";
  }

  if (
    normalized.includes("unsupported image") ||
    normalized.includes("couldn't read this image") ||
    normalized.includes("image_parse_error")
  ) {
    return "We couldn't read this image. Please upload a clear JPG or PNG photo of a single card.";
  }

  return rawMessage;
}

function isNonRetryableScanError(message: string): boolean {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("unsupported image") ||
    normalized.includes("couldn't read this image") ||
    normalized.includes("image_parse_error") ||
    normalized.includes("quota") ||
    normalized.includes("temporarily unavailable on this deployment") ||
    normalized.includes("api key not configured") ||
    normalized.includes("timed out")
  );
}

async function postScanRequest(
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch("/api/scan-card-v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Scanning timed out. Please try a clearer, closer photo.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toConfidencePercent(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;

  if (value <= 1) {
    return Math.max(0, Math.min(100, Math.round(value * 100)));
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function AICardScanner({ onScanComplete, onCancel, userId }: AICardScannerProps) {
  const router = useRouter();
  const { currency } = useCurrency();
  const { canScan, scansRemaining, incrementScanCount, subscriptionPlan } = useFeatureAccess();

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedOriginalImages, setSelectedOriginalImages] = useState<string[]>([]);
  const [selectedFileLabels, setSelectedFileLabels] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<CardScanResult[]>([]);
  const [scannerView, setScannerView] = useState<ScannerView>("scanner");
  const [scanning, setScanning] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState("Near Mint");
  const [lastScanLatencyMs, setLastScanLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selling, setSelling] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const primaryResult = scanResults[0];
  const primaryPreviewImage = selectedImages[0] || "";
  const hasSelectedImage = selectedImages.length > 0;

  const confidencePercent = toConfidencePercent(primaryResult?.confidence);

  const confidenceMeta = useMemo(() => {
    if (confidencePercent >= 90) {
      return { label: "High", icon: "✔", className: styles.confidenceHigh };
    }

    if (confidencePercent >= 70) {
      return { label: "Medium", icon: "⚠", className: styles.confidenceMedium };
    }

    return { label: "Low", icon: "❗", className: styles.confidenceLow };
  }, [confidencePercent]);

  const enhanceImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }

        const maxDimension = TARGET_SCAN_IMAGE_SIZE;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetWidth = Math.round(img.width * scale);
        const targetHeight = Math.round(img.height * scale);

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(img, 0, 0, targetWidth, targetHeight);

        let workingCanvas = canvas;
        try {
          const bounds = detectCardBounds(canvas);
          if (bounds) {
            const areaRatio = (bounds.width * bounds.height) / (canvas.width * canvas.height);
            if (areaRatio > 0.35 && areaRatio < 0.98) {
              workingCanvas = cropCanvas(canvas, bounds);
            }
          }
        } catch {
          workingCanvas = canvas;
        }

        const workingContext = workingCanvas.getContext("2d");
        if (!workingContext) {
          resolve(dataUrl);
          return;
        }

        const imageData = workingContext.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
        const data = imageData.data;

        const contrast = 1.2;
        const brightness = 10;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128 + brightness));
          data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128 + brightness));
          data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128 + brightness));
        }

        workingContext.putImageData(imageData, 0, 0);

        const maxLength = 3_500_000;
        let quality = 0.85;
        let currentCanvas = workingCanvas;
        let outputUrl = currentCanvas.toDataURL("image/jpeg", quality);

        while (outputUrl.length > maxLength && currentCanvas.width > 900) {
          const nextCanvas = document.createElement("canvas");
          const nextContext = nextCanvas.getContext("2d");
          if (!nextContext) break;

          nextCanvas.width = Math.round(currentCanvas.width * 0.8);
          nextCanvas.height = Math.round(currentCanvas.height * 0.8);
          nextContext.drawImage(currentCanvas, 0, 0, nextCanvas.width, nextCanvas.height);

          currentCanvas = nextCanvas;
          quality = Math.max(0.6, quality - 0.1);
          outputUrl = currentCanvas.toDataURL("image/jpeg", quality);
        }

        resolve(outputUrl);
      };
      img.src = dataUrl;
    });
  };

  const processSelectedFiles = async (
    files: File[],
    options?: { forceBulk?: boolean; forceSingle?: boolean }
  ) => {
    if (!files.length) return;

    setEnhancing(true);
    setError("");

    const validImages: string[] = [];
    const validOriginalImages: string[] = [];
    const labels: string[] = [];
    let hasError = false;

    const processedImages = await Promise.all(
      files.map(async (file) => {
        if (!file.type.startsWith("image/")) {
          setError(`File ${file.name} is not a valid image`);
          hasError = true;
          return null;
        }

        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} exceeds 10MB limit`);
          hasError = true;
          return null;
        }

        const reader = new FileReader();
        return new Promise<{ dataUrl: string; originalDataUrl: string; label: string } | null>((resolve) => {
          reader.onloadend = async () => {
            const originalImage = reader.result as string;
            const label = file.name.replace(/\.[^/.]+$/, "") || "Scanned card";
            try {
              const enhanced = await enhanceImage(originalImage);
              resolve({ dataUrl: enhanced, originalDataUrl: originalImage, label });
            } catch {
              resolve({ dataUrl: originalImage, originalDataUrl: originalImage, label });
            }
          };
          reader.readAsDataURL(file);
        });
      })
    );

    processedImages.forEach((item) => {
      if (item) {
        validImages.push(item.dataUrl);
        validOriginalImages.push(item.originalDataUrl);
        labels.push(item.label);
      }
    });

    if (validImages.length > 0) {
      const useSingle = Boolean(options?.forceSingle);
      const didExceedLimit = !useSingle && validImages.length > MAX_CARDS_PER_BATCH;
      const cappedImages = didExceedLimit ? validImages.slice(0, MAX_CARDS_PER_BATCH) : validImages;
      const cappedOriginalImages = didExceedLimit
        ? validOriginalImages.slice(0, MAX_CARDS_PER_BATCH)
        : validOriginalImages;
      const cappedLabels = didExceedLimit ? labels.slice(0, MAX_CARDS_PER_BATCH) : labels;
      const nextImages = useSingle ? [validImages[0]] : cappedImages;
      const nextOriginalImages = useSingle ? [validOriginalImages[0]] : cappedOriginalImages;
      const nextLabels = useSingle ? [labels[0]] : cappedLabels;

      setSelectedImages(nextImages);
      setSelectedOriginalImages(nextOriginalImages);
      setSelectedFileLabels(nextLabels);
      setBulkMode(options?.forceBulk ? true : useSingle ? false : validImages.length > 1);
      setScannerView("scanner");
      setScanResults([]);
      setLastScanLatencyMs(null);
      setSelectedCondition("Near Mint");
      if (didExceedLimit) {
        setError(`You can scan up to ${MAX_CARDS_PER_BATCH} cards at a time. Extra files were skipped.`);
      } else if (hasError) {
        setError("Some files were skipped.");
      }
    }

    setEnhancing(false);
  };

  const handleCaptureInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processSelectedFiles([files[0]], { forceSingle: true });
    event.target.value = "";
  };

  const handleGalleryInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (bulkMode) {
      await processSelectedFiles(Array.from(files), { forceBulk: true });
    } else {
      await processSelectedFiles([files[0]], { forceSingle: true });
    }

    event.target.value = "";
  };

  const resetForAnotherScan = () => {
    setScannerView("scanner");
    setSelectedImages([]);
    setSelectedOriginalImages([]);
    setSelectedFileLabels([]);
    setScanResults([]);
    setError("");
    setLastScanLatencyMs(null);
    setSelectedCondition("Near Mint");
  };

  const handleAddToCollection = () => {
    if (!scanResults.length) return;

    const output = scanResults.map((result, index) => {
      if (index !== 0 || scannerView !== "result") return result;
      return {
        ...result,
        condition: selectedCondition,
      };
    });

    onScanComplete(output, {
      instantMode: false,
      autoAdd: false,
      avgLatencyMs: lastScanLatencyMs ?? undefined,
    });
  };

  const handleViewCardDetails = () => {
    if (!primaryResult?.name) return;
    const query = encodeURIComponent(primaryResult.name);
    router.push(`/dashboard/marketplace?search=${query}`);
  };

  const handleSellInMarketplace = async () => {
    if (!primaryResult) return;
    if (!userId) {
      setError("Sign in to list scanned cards in the marketplace.");
      return;
    }

    try {
      setSelling(true);
      setError("");

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("/api/scan-and-sell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: primaryPreviewImage || undefined,
          price: Number(primaryResult.estimatedValue || 0),
          condition: selectedCondition,
          scanResult: {
            ...primaryResult,
            condition: selectedCondition,
            imageUrl: primaryResult.imageUrl || primaryPreviewImage,
            photoUrl: primaryResult.photoUrl || primaryPreviewImage,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create marketplace listing");
      }

      if (!payload?.listingId) {
        throw new Error("Listing was created without an id");
      }

      router.push(`/dashboard/marketplace/${encodeURIComponent(payload.listingId)}`);
    } catch (sellError) {
      setError(sellError instanceof Error ? sellError.message : "Failed to create marketplace listing");
    } finally {
      setSelling(false);
    }
  };

  async function handleScan() {
    if (selectedImages.length === 0) return;

    if (selectedImages.length > MAX_CARDS_PER_BATCH) {
      setError(`You can scan up to ${MAX_CARDS_PER_BATCH} cards at a time.`);
      return;
    }

    if (!canScan) {
      setError(
        `You've reached your monthly scan limit (${scansRemaining} remaining). Upgrade your plan to continue scanning. Current plan: ${subscriptionPlan}`
      );
      return;
    }

    setScanning(true);
    setError("");
    setScanProgress({ current: 0, total: selectedImages.length });

    const effectiveUserId = userId || auth.currentUser?.uid || "";
    if (!effectiveUserId) {
      setScanning(false);
      setError("Sign in to scan cards so we can process your request.");
      return;
    }

    const results: CardScanResult[] = [];
    const skippedCards: string[] = [];
    let blockingError = "";

    try {
      const scanOutcomes: Array<
        | { ok: true; index: number; result: CardScanResult; latencyMs: number }
        | { ok: false; index: number; message: string; latencyMs: number; blocking: boolean }
      > = [];

      for (let index = 0; index < selectedImages.length; index += 1) {
        const image = selectedImages[index];
        const originalImage = selectedOriginalImages[index] || image;
        try {
          const requestStartedAt = performance.now();
          const scanMode = "instant";
          const response = await postScanRequest({
            image,
            userId: effectiveUserId,
            scanMode,
            useFastPath: true,
            aiVisionOnly: false,
          }, PRIMARY_SCAN_TIMEOUT_MS);

          let finalResponse = response;
          let resolvedErrorMessage = "Failed to identify card";
          let resolvedBlockingError = false;

          if (!response.ok) {
            let errorData: any = null;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: "Failed to scan" };
            }

            const message = normalizeErrorText(getScanErrorMessage(errorData));
            const isConfigurationError =
              String(errorData?.error || "").toLowerCase().includes("api key not configured") ||
              String(errorData?.debug || "").toLowerCase().includes("openai_api_key") ||
              String(errorData?.message || "").toLowerCase().includes("not properly configured");
            const isTimeoutError =
              String(errorData?.error || "").toLowerCase().includes("timed out") ||
              String(errorData?.message || "").toLowerCase().includes("timed out") ||
              String(errorData?.details || "").toLowerCase().includes("timed out") ||
              Number(response.status) === 504;

            resolvedErrorMessage = message;
            resolvedBlockingError = Boolean(
              errorData?.quotaExceeded || errorData?.providerQuotaExceeded || isConfigurationError || isTimeoutError
            );

            if (!resolvedBlockingError && !isNonRetryableScanError(resolvedErrorMessage)) {
              const aiOnlyResponse = await postScanRequest(
                {
                  image,
                  userId: effectiveUserId,
                  scanMode,
                  useFastPath: false,
                  aiVisionOnly: true,
                },
                FALLBACK_SCAN_TIMEOUT_MS
              );

              if (aiOnlyResponse.ok) {
                finalResponse = aiOnlyResponse;
              } else {
                let aiOnlyErrorData: any = null;
                try {
                  aiOnlyErrorData = await aiOnlyResponse.json();
                } catch {
                  aiOnlyErrorData = { error: "Failed to scan" };
                }

                const aiOnlyMessage = normalizeErrorText(getScanErrorMessage(aiOnlyErrorData));
                const aiOnlyConfigurationError =
                  String(aiOnlyErrorData?.error || "").toLowerCase().includes("api key not configured") ||
                  String(aiOnlyErrorData?.debug || "").toLowerCase().includes("openai_api_key") ||
                  String(aiOnlyErrorData?.message || "").toLowerCase().includes("not properly configured") ||
                  String(aiOnlyErrorData?.details || "").toLowerCase().includes("not configured");

                resolvedErrorMessage = aiOnlyMessage || resolvedErrorMessage;
                resolvedBlockingError =
                  resolvedBlockingError ||
                  Boolean(
                    aiOnlyErrorData?.quotaExceeded ||
                      aiOnlyErrorData?.providerQuotaExceeded ||
                      aiOnlyConfigurationError
                  );
              }
            }

            if (!finalResponse.ok) {
              scanOutcomes.push({
                ok: false,
                index,
                message: resolvedErrorMessage,
                latencyMs: Math.round(performance.now() - requestStartedAt),
                blocking: resolvedBlockingError,
              });
              continue;
            }
          }

          const result: CardScanResult = await finalResponse.json();
          result.imageUrl = originalImage || image;
          result.photoUrl = originalImage || image;

          if (!result.name) {
            const nameParts = [
              result.player,
              result.year ? String(result.year) : null,
              result.brand,
              result.sport !== "Other" ? result.sport : null,
            ].filter(Boolean);
            result.name = nameParts.length > 0 ? nameParts.join(" ") : "Sports Card";
          }

          if (!result.player) result.player = "Unknown Player";
          if (!result.estimatedValue) result.estimatedValue = 0;
          if (!result.sport) result.sport = "Other";
          if (!result.confidence) result.confidence = 0.3;
          if (!result.brand) result.brand = "Unknown";
          if (!result.condition) result.condition = "Good";
          if (!result.year) result.year = new Date().getFullYear();
          if (typeof result.cardNumber !== "string") result.cardNumber = "";
          if (typeof result.setName !== "string") result.setName = result.brand;

          const measuredLatencyMs = Math.round(performance.now() - requestStartedAt);
          const latencyMs = typeof result.processingMs === "number" ? result.processingMs : measuredLatencyMs;

          scanOutcomes.push({ ok: true, index, result, latencyMs });
        } catch (cardError) {
          const rawMessage = cardError instanceof Error ? cardError.message : "Unknown error";
          scanOutcomes.push({
            ok: false,
            index,
            message: normalizeErrorText(rawMessage),
            latencyMs: 0,
            blocking: false,
          });
        } finally {
          setScanProgress((previous) => ({
            ...previous,
            current: Math.min(previous.current + 1, previous.total),
          }));
        }
      }

      scanOutcomes
        .sort((a, b) => a.index - b.index)
        .forEach((outcome) => {
          if (outcome.ok) {
            results.push(outcome.result);
            return;
          }

          if ("blocking" in outcome && outcome.blocking && !blockingError) {
            blockingError = outcome.message;
            return;
          }

          const fallbackImage =
            selectedOriginalImages[outcome.index] ||
            selectedImages[outcome.index] ||
            "";
          const fallbackLabel = selectedFileLabels[outcome.index] || `Card ${outcome.index + 1}`;

          results.push({
            name: `Unidentified Card (${fallbackLabel})`,
            player: "Unknown Player",
            cardNumber: "",
            setName: "",
            year: new Date().getFullYear(),
            brand: "Unknown",
            sport: "Other",
            condition: "Good",
            isGraded: false,
            estimatedValue: 0,
            confidence: 0.05,
            imageUrl: fallbackImage,
            photoUrl: fallbackImage,
          });

          skippedCards.push(
            `Card ${outcome.index + 1}: ${"message" in outcome ? outcome.message : "Scan failed"} (added as Unidentified Card)`
          );
        });

      if (blockingError) {
        throw new Error(normalizeErrorText(blockingError));
      }

      if (results.length === 0) {
        const errorMessage =
          skippedCards.length > 0
            ? `Unable to process any cards. ${skippedCards.join(". ")}`
            : "No cards could be processed from the uploaded images. Please try different photos.";
        throw new Error(errorMessage);
      }

      const successfulOutcomes = scanOutcomes.filter((outcome) => outcome.ok);
      const avgLatencyMs =
        successfulOutcomes.length > 0
          ? Math.round(
              successfulOutcomes.reduce((sum, outcome) => sum + outcome.latencyMs, 0) /
                successfulOutcomes.length
            )
          : null;

      if (avgLatencyMs != null) {
        setLastScanLatencyMs(avgLatencyMs);
      }

      await Promise.allSettled(results.map(() => incrementScanCount()));

      setScanResults(results);
      setSelectedCondition(results[0]?.condition || "Near Mint");
      setScannerView(results.length > 1 || bulkMode ? "bulk" : "result");

      if (skippedCards.length > 0) {
        setError(
          `Scanned ${results.length} card(s). ${skippedCards.length} used fallback identification and need manual review: ${skippedCards.join(", ")}`
        );
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Failed to scan cards");
    } finally {
      setScanning(false);
      setScanProgress({ current: 0, total: 0 });
    }
  }

  const frameStateClass = scanning
    ? styles.frameCapturing
    : scannerView !== "scanner"
    ? styles.frameSuccess
    : hasSelectedImage
    ? styles.frameDetected
    : "";

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <button type="button" className={styles.menuLabel}>☰ Menu</button>
        <h2 className={styles.scannerTitle}>StackTrack Scanner</h2>
        <button className={styles.closeButton} onClick={onCancel} type="button">×</button>
      </header>

      <div className={styles.planPillWrap}>
        {!canScan ? (
          <span className={`${styles.planPill} ${styles.planPillAlert}`}>
            Scan limit reached • Plan: {subscriptionPlan}
          </span>
        ) : (
          <span className={styles.planPill}>
            {scansRemaining === 999999 ? "Unlimited scans" : `${scansRemaining} scans remaining this month`}
          </span>
        )}
      </div>

      {scannerView === "scanner" && (
        <>
          <div className={styles.modeRow}>
            <span className={styles.modeLabel}>Scan Mode:</span>
            <button
              type="button"
              className={`${styles.modeToggle} ${!bulkMode ? styles.modeActive : ""}`}
              onClick={() => {
                setBulkMode(false);
                setSelectedImages((prev) => (prev.length ? [prev[0]] : prev));
                setSelectedFileLabels((prev) => (prev.length ? [prev[0]] : prev));
              }}
            >
              Single
            </button>
            <button
              type="button"
              className={`${styles.modeToggle} ${bulkMode ? styles.modeActive : ""}`}
              onClick={() => setBulkMode(true)}
            >
              Bulk
            </button>
          </div>

          <section className={styles.cameraShell}>
            <div className={styles.cameraView}>
              {primaryPreviewImage ? (
                <img src={primaryPreviewImage} alt="Card preview" className={styles.cameraImage} />
              ) : (
                <div className={styles.cameraPlaceholder}>Camera View</div>
              )}

              <div className={`${styles.detectionFrame} ${frameStateClass}`}>
                <span className={styles.frameLabel}>Card detection frame</span>
                <div className={styles.edgeCorners}>
                  <span className={styles.cornerTl} />
                  <span className={styles.cornerTr} />
                  <span className={styles.cornerBl} />
                  <span className={styles.cornerBr} />
                </div>
              </div>
            </div>
          </section>

          <div className={styles.primaryActions}>
            <button
              type="button"
              className={styles.captureButton}
              onClick={() => captureInputRef.current?.click()}
              disabled={scanning || !canScan}
            >
              Capture Photo
            </button>
            <button
              type="button"
              className={styles.autoScanButton}
              onClick={() => galleryInputRef.current?.click()}
              disabled={scanning}
            >
              {bulkMode ? "Upload Batch" : "Upload Image"}
            </button>
          </div>

          <div className={styles.mobileControls}>
            <button
              type="button"
              className={`${styles.mobileButton} ${styles.mobileScanButton}`}
              onClick={() => {
                if (hasSelectedImage) {
                  void handleScan();
                } else {
                  captureInputRef.current?.click();
                }
              }}
              disabled={scanning || !canScan}
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          {selectedFileLabels.length > 0 && (
            <p className={styles.selectedHint}>
              {selectedFileLabels.length} selected: {selectedFileLabels.slice(0, 3).join(", ")}
              {selectedFileLabels.length > 3 ? "..." : ""}
            </p>
          )}
        </>
      )}

      {scanning && (
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(scanProgress.current / Math.max(1, scanProgress.total)) * 100}%` }}
            />
          </div>
          <p className={styles.progressText}>
            {scanProgress.current} / {scanProgress.total} scanned
          </p>
        </div>
      )}

      {enhancing && <p className={styles.feedbackMessage}>Enhancing image for faster recognition…</p>}
      {error && <div className={styles.error}>{error}</div>}

      {scannerView === "result" && primaryResult && (
        <section className={styles.resultScreen}>
          <h3 className={styles.resultHeader}>Card Identified</h3>

          <div className={styles.resultImageWrap}>
            <img
              src={primaryResult.imageUrl || "/placeholder-card.svg"}
              alt={primaryResult.name}
              className={styles.resultImage}
            />
          </div>

          <div className={styles.resultContent}>
            <h4 className={styles.resultName}>{primaryResult.name}</h4>
            <p className={styles.resultMeta}>{primaryResult.setName || primaryResult.brand}</p>
            <p className={styles.resultMeta}>{primaryResult.year}</p>
          </div>

          <div className={styles.resultMetricGrid}>
            <div className={styles.resultMetric}>
              <span>Confidence</span>
              <strong>{confidencePercent}%</strong>
              <em className={`${styles.confidenceBadge} ${confidenceMeta.className}`}>
                {confidenceMeta.icon} {confidenceMeta.label}
              </em>
            </div>
            <div className={styles.resultMetric}>
              <span>Market Value</span>
              <strong>{formatCurrency(Number(primaryResult.estimatedValue || 0), currency)}</strong>
            </div>
          </div>

          <label className={styles.conditionRow}>
            <span>Edit card condition (optional)</span>
            <select
              className={styles.conditionSelect}
              value={selectedCondition}
              onChange={(event) => setSelectedCondition(event.target.value)}
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.resultActions}>
            <button type="button" className={styles.primaryCta} onClick={handleAddToCollection}>
              Add to Collection
            </button>
            <button
              type="button"
              className={styles.primaryCta}
              onClick={handleSellInMarketplace}
              disabled={selling}
            >
              {selling ? "Listing..." : "Sell in Marketplace"}
            </button>
            <button type="button" className={styles.secondaryCta} onClick={resetForAnotherScan}>
              Scan Another
            </button>
            <button type="button" className={styles.secondaryCta} onClick={handleViewCardDetails}>
              View Card Details
            </button>
          </div>
        </section>
      )}

      {scannerView === "bulk" && (
        <section className={styles.bulkScreen}>
          <h3 className={styles.bulkTitle}>Recently Scanned</h3>
          <p className={styles.bulkSubtitle}>{scanResults.length} cards detected in bulk mode</p>

          <div className={styles.bulkList}>
            {scanResults.map((card, index) => (
              <div key={`${card.name}-${index}`} className={styles.bulkItem}>
                <span>{card.name}</span>
                <strong>{toConfidencePercent(card.confidence)}%</strong>
              </div>
            ))}
          </div>

          <div className={styles.bulkActions}>
            <button type="button" className={styles.primaryCta} onClick={handleAddToCollection}>
              Add All to Collection
            </button>
            <button type="button" className={styles.secondaryCta} onClick={resetForAnotherScan}>
              Scan Another Batch
            </button>
          </div>
        </section>
      )}

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={handleCaptureInput}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={bulkMode}
        className={styles.hiddenInput}
        onChange={handleGalleryInput}
      />
    </div>
  );
}
