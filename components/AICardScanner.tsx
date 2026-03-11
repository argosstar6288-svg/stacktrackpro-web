"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
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
type DetectionPhase = "detecting" | "matching" | "identified";

const TARGET_SCAN_IMAGE_SIZE = 800;

const CONDITION_OPTIONS = ["Mint", "Excellent", "Good", "Fair", "Poor", "Near Mint"];

function getScanErrorMessage(errorData: any): string {
  const errorMessage = String(errorData?.message || errorData?.error || "Failed to scan");

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

function toConfidencePercent(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;

  if (value <= 1) {
    return Math.max(0, Math.min(100, Math.round(value * 100)));
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function toBaseCardName(name: string): string {
  if (!name) return "Charizard";
  return name.split(" ")[0] || "Charizard";
}

export default function AICardScanner({ onScanComplete, onCancel, userId }: AICardScannerProps) {
  const router = useRouter();
  const { canScan, scansRemaining, incrementScanCount, subscriptionPlan } = useFeatureAccess();

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFileLabels, setSelectedFileLabels] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<CardScanResult[]>([]);
  const [scannerView, setScannerView] = useState<ScannerView>("scanner");
  const [scanning, setScanning] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState("Near Mint");
  const [detectionPhase, setDetectionPhase] = useState<DetectionPhase>("detecting");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [lastScanLatencyMs, setLastScanLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const autoCaptureKeyRef = useRef("");

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

  const possibleMatches = useMemo(() => {
    const base = toBaseCardName(primaryResult?.name || "Charizard");
    return [
      `${base} Base Set`,
      `${base} Legendary Collection`,
      `${base} XY Evolutions`,
    ];
  }, [primaryResult?.name]);

  const liveDetectedName = primaryResult?.name || "Charizard";
  const liveDetectedSet = primaryResult?.setName || primaryResult?.brand || "Base Set";
  const liveDetectedNumber = primaryResult?.cardNumber || "4/102";

  const playFeedbackTone = (mode: "capture" | "success") => {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    try {
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = mode === "capture" ? 620 : 860;
      gainNode.gain.value = 0.03;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.frequency.exponentialRampToValueAtTime(
        mode === "capture" ? 760 : 1060,
        audioContext.currentTime + 0.1
      );
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.14);
      oscillator.stop(audioContext.currentTime + 0.14);

      window.setTimeout(() => {
        void audioContext.close();
      }, 180);
    } catch {
      // Best effort only
    }
  };

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

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const contrast = 1.2;
        const brightness = 10;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128 + brightness));
          data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128 + brightness));
          data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128 + brightness));
        }

        context.putImageData(imageData, 0, 0);

        const maxLength = 3_500_000;
        let quality = 0.85;
        let currentCanvas = canvas;
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
        return new Promise<{ dataUrl: string; label: string } | null>((resolve) => {
          reader.onloadend = async () => {
            const originalImage = reader.result as string;
            const label = file.name.replace(/\.[^/.]+$/, "") || "Scanned card";
            try {
              const enhanced = await enhanceImage(originalImage);
              resolve({ dataUrl: enhanced, label });
            } catch {
              resolve({ dataUrl: originalImage, label });
            }
          };
          reader.readAsDataURL(file);
        });
      })
    );

    processedImages.forEach((item) => {
      if (item) {
        validImages.push(item.dataUrl);
        labels.push(item.label);
      }
    });

    if (validImages.length > 0) {
      const useSingle = Boolean(options?.forceSingle);
      const nextImages = useSingle ? [validImages[0]] : validImages;
      const nextLabels = useSingle ? [labels[0]] : labels;

      setSelectedImages(nextImages);
      setSelectedFileLabels(nextLabels);
      setBulkMode(options?.forceBulk ? true : useSingle ? false : validImages.length > 1);
      setScannerView("scanner");
      setScanResults([]);
      setLastScanLatencyMs(null);
      setSelectedCondition("Near Mint");
      setFeedbackMessage(useSingle ? "Card centered. Preparing auto-detection…" : "Bulk cards ready for fast scan.");
      autoCaptureKeyRef.current = "";
      if (hasError) {
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
    setSelectedFileLabels([]);
    setScanResults([]);
    setError("");
    setFeedbackMessage("");
    setLastScanLatencyMs(null);
    setSelectedCondition("Near Mint");
    autoCaptureKeyRef.current = "";
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
      instantMode: autoScanEnabled,
      autoAdd: false,
      avgLatencyMs: lastScanLatencyMs ?? undefined,
    });
  };

  const handleViewCardDetails = () => {
    if (!primaryResult?.name) return;
    const query = encodeURIComponent(primaryResult.name);
    router.push(`/dashboard/marketplace?search=${query}`);
  };

  async function handleScan() {
    if (selectedImages.length === 0) return;

    if (!canScan) {
      setError(
        `You've reached your monthly scan limit (${scansRemaining} remaining). Upgrade your plan to continue scanning. Current plan: ${subscriptionPlan}`
      );
      return;
    }

    playFeedbackTone("capture");
    setScanning(true);
    setError("");
    setFeedbackMessage("Scanning...");
    setScanProgress({ current: 0, total: selectedImages.length });

    const results: CardScanResult[] = [];
    const skippedCards: string[] = [];
    let blockingError = "";

    try {
      const scanOutcomes = await Promise.all(
        selectedImages.map(async (image, index) => {
          try {
            const requestStartedAt = performance.now();
            const response = await fetch("/api/scan-card", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                image,
                userId,
                scanMode: autoScanEnabled ? "instant" : "standard",
              }),
            });

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

              return {
                ok: false,
                index,
                message,
                latencyMs: Math.round(performance.now() - requestStartedAt),
                blocking: Boolean(errorData?.quotaExceeded || errorData?.providerQuotaExceeded || isConfigurationError),
              };
            }

            const result: CardScanResult = await response.json();
            result.imageUrl = image;
            result.photoUrl = image;

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

            return { ok: true, index, result, latencyMs };
          } catch (cardError) {
            const rawMessage = cardError instanceof Error ? cardError.message : "Unknown error";
            return {
              ok: false,
              index,
              message: normalizeErrorText(rawMessage),
              latencyMs: 0,
              blocking: false,
            };
          } finally {
            setScanProgress((previous) => ({
              ...previous,
              current: Math.min(previous.current + 1, previous.total),
            }));
          }
        })
      );

      scanOutcomes
        .sort((a, b) => a.index - b.index)
        .forEach((outcome) => {
          if (outcome.ok) {
            results.push(outcome.result);
            return;
          }

          if (outcome.blocking && !blockingError) {
            blockingError = outcome.message;
            return;
          }

          skippedCards.push(`Card ${outcome.index + 1}: ${outcome.message}`);
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

      playFeedbackTone("success");
      setScanResults(results);
      setSelectedCondition(results[0]?.condition || "Near Mint");
      setFeedbackMessage("Scan successful ✓");
      setScannerView(results.length > 1 || bulkMode ? "bulk" : "result");

      if (skippedCards.length > 0) {
        setError(`Successfully scanned ${results.length} card(s). Skipped ${skippedCards.length}: ${skippedCards.join(", ")}`);
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Failed to scan cards");
      setFeedbackMessage("");
    } finally {
      setScanning(false);
      setScanProgress({ current: 0, total: 0 });
    }
  }

  useEffect(() => {
    if (scannerView !== "scanner" || scanning) return;

    const phases: DetectionPhase[] = ["detecting", "matching", "identified"];
    let currentIndex = hasSelectedImage ? 1 : 0;
    setDetectionPhase(phases[currentIndex]);

    const timer = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % phases.length;
      setDetectionPhase(phases[currentIndex]);
    }, 850);

    return () => {
      window.clearInterval(timer);
    };
  }, [scannerView, scanning, hasSelectedImage]);

  useEffect(() => {
    if (scannerView !== "scanner") return;
    if (!autoScanEnabled || scanning) return;
    if (selectedImages.length !== 1) return;

    const captureKey = selectedImages[0];
    if (!captureKey || autoCaptureKeyRef.current === captureKey) return;

    setFeedbackMessage("Card stable... auto capture");

    const timer = window.setTimeout(() => {
      autoCaptureKeyRef.current = captureKey;
      void handleScan();
    }, 950);

    return () => window.clearTimeout(timer);
  }, [scannerView, autoScanEnabled, scanning, selectedImages]);

  const frameStateClass = scanning
    ? styles.frameCapturing
    : scannerView !== "scanner"
    ? styles.frameSuccess
    : hasSelectedImage
    ? styles.frameDetected
    : "";

  const showPossibleMatches = scannerView === "result" && confidencePercent < 80;

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

          <div className={styles.detectedText}>✔ Card Detected: {liveDetectedName}</div>

          <section className={styles.liveDetectionPanel}>
            <p className={styles.liveDetectionTitle}>
              {detectionPhase === "detecting"
                ? "Detecting..."
                : detectionPhase === "matching"
                ? "Matching card..."
                : "Card identified"}
            </p>
            <strong className={styles.liveCardName}>{liveDetectedName}</strong>
            <span className={styles.liveCardMeta}>{liveDetectedSet}</span>
            <span className={styles.liveCardMeta}>{liveDetectedNumber}</span>
          </section>

          <div className={styles.feedbackSteps}>
            <span className={`${styles.feedbackStep} ${detectionPhase === "detecting" ? styles.feedbackActive : ""}`}>
              Scanning...
            </span>
            <span className={`${styles.feedbackStep} ${detectionPhase === "matching" ? styles.feedbackActive : ""}`}>
              Matching card...
            </span>
            <span className={`${styles.feedbackStep} ${detectionPhase === "identified" ? styles.feedbackActive : ""}`}>
              Card identified
            </span>
          </div>

          {feedbackMessage && <div className={styles.feedbackMessage}>{feedbackMessage}</div>}

          <div className={styles.primaryActions}>
            <button
              type="button"
              className={styles.captureButton}
              onClick={() => captureInputRef.current?.click()}
              disabled={scanning || !canScan}
            >
              Capture Card
            </button>
            <button
              type="button"
              className={`${styles.autoScanButton} ${autoScanEnabled ? styles.autoScanOn : ""}`}
              onClick={() => setAutoScanEnabled((prev) => !prev)}
            >
              {autoScanEnabled ? "Auto Scan ON" : "Auto Scan OFF"}
            </button>
          </div>

          <div className={styles.mobileControls}>
            <button
              type="button"
              className={`${styles.mobileButton} ${flashOn ? styles.flashOn : ""}`}
              onClick={() => setFlashOn((prev) => !prev)}
            >
              {flashOn ? "Flash On" : "Flash"}
            </button>

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
              {scanning ? "Scanning..." : "Scan Button"}
            </button>

            <button
              type="button"
              className={styles.mobileButton}
              onClick={() => galleryInputRef.current?.click()}
              disabled={scanning}
            >
              Gallery Upload
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
              <strong>${Number(primaryResult.estimatedValue || 0).toFixed(0)}</strong>
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

          {showPossibleMatches && (
            <div className={styles.possibleMatches}>
              <p className={styles.possibleMatchesTitle}>Possible Matches</p>
              {possibleMatches.map((match) => (
                <button key={match} type="button" className={styles.matchItem}>
                  {match}
                </button>
              ))}
            </div>
          )}

          <div className={styles.resultActions}>
            <button type="button" className={styles.primaryCta} onClick={handleAddToCollection}>
              Add to Collection
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
