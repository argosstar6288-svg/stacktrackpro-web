"use client";

import { useState } from "react";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
import styles from "./AICardScanner.module.css";

interface CardScanResult {
  name: string;
  player: string;
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
}

interface AICardScannerProps {
  onScanComplete: (results: CardScanResult[]) => void;
  onCancel: () => void;
  userId?: string;
}

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

export default function AICardScanner({ onScanComplete, onCancel, userId }: AICardScannerProps) {
  const { canScan, scansRemaining, incrementScanCount, subscriptionPlan } = useFeatureAccess();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string>("");
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setEnhancing(true);
    const validImages: string[] = [];
    let hasError = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError(`File ${file.name} is not a valid image`);
        hasError = true;
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} exceeds 10MB limit`);
        hasError = true;
        continue;
      }

      // Read and enhance image
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve) => {
        reader.onloadend = async () => {
          const originalImage = reader.result as string;
          
          // Enhance image for better AI recognition
          try {
            const enhanced = await enhanceImage(originalImage);
            resolve(enhanced);
          } catch (err) {
            console.error('Image enhancement failed, using original:', err);
            resolve(originalImage);
          }
        };
        reader.readAsDataURL(file);
      });

      validImages.push(imageData);
    }

    setEnhancing(false);
    if (validImages.length > 0) {
      setSelectedImages(validImages);
      setError(hasError ? "Some files were skipped" : "");
    }
  };

  // Enhance image contrast, brightness, and sharpness for better AI recognition
  const enhanceImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Downscale large images to reduce payload size
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetWidth = Math.round(img.width * scale);
        const targetHeight = Math.round(img.height * scale);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw original image scaled down
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Enhance: increase contrast and brightness
        const contrast = 1.2; // 20% more contrast
        const brightness = 10; // slight brightness increase

        for (let i = 0; i < data.length; i += 4) {
          // Apply contrast and brightness to RGB channels
          data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128 + brightness));     // R
          data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128 + brightness)); // G
          data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128 + brightness)); // B
        }

        // Put enhanced image back
        ctx.putImageData(imageData, 0, 0);

        // Return enhanced image as data URL (adaptive compression)
        const maxLength = 3_500_000; // ~3.5MB base64 string
        let quality = 0.85;
        let currentCanvas = canvas;
        let outputUrl = currentCanvas.toDataURL("image/jpeg", quality);

        while (outputUrl.length > maxLength && currentCanvas.width > 900) {
          const shrink = 0.8;
          const nextWidth = Math.round(currentCanvas.width * shrink);
          const nextHeight = Math.round(currentCanvas.height * shrink);
          const nextCanvas = document.createElement("canvas");
          const nextCtx = nextCanvas.getContext("2d");

          if (!nextCtx) {
            break;
          }

          nextCanvas.width = nextWidth;
          nextCanvas.height = nextHeight;
          nextCtx.drawImage(currentCanvas, 0, 0, nextWidth, nextHeight);

          currentCanvas = nextCanvas;
          quality = Math.max(0.6, quality - 0.1);
          outputUrl = currentCanvas.toDataURL("image/jpeg", quality);
        }

        resolve(outputUrl);
      };
      img.src = dataUrl;
    });
  };

  const handleScan = async () => {
    if (selectedImages.length === 0) return;

    // Check scan limits
    if (!canScan) {
      setError(
        `You've reached your monthly scan limit (${scansRemaining} remaining). ` +
        `Upgrade your plan to continue scanning. Current plan: ${subscriptionPlan}`
      );
      return;
    }

    setScanning(true);
    setError("");
    setScanProgress({ current: 0, total: selectedImages.length });

    const results: CardScanResult[] = [];

    const skippedCards: string[] = [];
    let blockingError = "";
    
    try {
      for (let i = 0; i < selectedImages.length; i++) {
        setScanProgress({ current: i + 1, total: selectedImages.length });

        try {
          const response = await fetch("/api/scan-card", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: selectedImages[i], userId }),
          });

          if (!response.ok) {
            let errorData: any = null;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: "Failed to scan" };
            }

            const message = normalizeErrorText(getScanErrorMessage(errorData));
            console.error(`Failed to scan card ${i + 1}:`, message);

            const isConfigurationError =
              String(errorData?.error || "").toLowerCase().includes("api key not configured") ||
              String(errorData?.debug || "").toLowerCase().includes("openai_api_key") ||
              String(errorData?.message || "").toLowerCase().includes("not properly configured");

            if (errorData?.quotaExceeded || errorData?.providerQuotaExceeded || isConfigurationError) {
              blockingError = message;
              break;
            }

            skippedCards.push(`Card ${i + 1}: ${message}`);
            continue;
          }

          const result: CardScanResult = await response.json();
          
          // Attach the scanned image to the result
          result.imageUrl = selectedImages[i];
          result.photoUrl = selectedImages[i];
          
          // Very lenient validation - accept almost anything
          // Build name from any available info
          if (!result.name) {
            const nameParts = [
              result.player,
              result.year ? String(result.year) : null,
              result.brand,
              result.sport !== 'Other' ? result.sport : null
            ].filter(Boolean);
            result.name = nameParts.length > 0 ? nameParts.join(' ') : 'Sports Card';
          }
          
          // Set defaults for any missing fields
          if (!result.player) result.player = 'Unknown Player';
          if (!result.estimatedValue) result.estimatedValue = 0;
          if (!result.sport) result.sport = "Other";
          if (!result.confidence) result.confidence = 0.3;
          if (!result.brand) result.brand = 'Unknown';
          if (!result.condition) result.condition = 'Good';
          if (!result.year) result.year = new Date().getFullYear();
          
          // Fetch real-time market price from PriceCharting
          try {
            const priceResponse = await fetch("/api/price-lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cardName: result.name,
                player: result.player,
                year: result.year,
                brand: result.brand,
                sport: result.sport,
                condition: result.condition,
              }),
            });
            
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              if (priceData.found && priceData.suggestedPrice) {
                result.estimatedValue = priceData.suggestedPrice;
                console.log(`[Scanner] Updated price for "${result.name}": $${priceData.suggestedPrice}`);
              }
            }
          } catch (priceError) {
            // Don't fail the scan if price lookup fails
            console.warn(`[Scanner] Price lookup failed for "${result.name}":`, priceError);
          }
          
          // Accept any result - even if confidence is low
          results.push(result);
        } catch (cardError) {
          console.error(`Error scanning card ${i + 1}:`, cardError);
          const rawMessage = cardError instanceof Error ? cardError.message : "Unknown error";
          skippedCards.push(`Card ${i + 1}: ${normalizeErrorText(rawMessage)}`);
        }
      }

      if (blockingError) {
        throw new Error(normalizeErrorText(blockingError));
      }

      if (results.length === 0) {
        const errorMsg = skippedCards.length > 0 
          ? `Unable to process any cards. ${skippedCards.join('. ')}`
          : "No cards could be processed from the uploaded images. Please try different photos.";
        throw new Error(errorMsg);
      }

      // Show warning if some cards were skipped
      if (skippedCards.length > 0) {
        setError(`Successfully scanned ${results.length} card(s). Skipped ${skippedCards.length}: ${skippedCards.join(', ')}`);
      }

      // Increment scan count for successful scans
      for (let i = 0; i < results.length; i++) {
        await incrementScanCount();
      }

      // Reset scanning state before completing
      setScanning(false);
      setScanProgress({ current: 0, total: 0 });
      
      onScanComplete(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan cards");
      setScanning(false);
      setScanProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className={styles.scanner}>
      <div className={styles.header}>
        <div>
          <h2>Scan Cards with AI</h2>
          {!canScan ? (
            <p style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              ⚠️ Scan limit reached - Upgrade to continue
            </p>
          ) : (
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              {scansRemaining === 999999 ? "Unlimited scans" : `${scansRemaining} scans remaining this month`}
            </p>
          )}
        </div>
        <button className={styles.closeButton} onClick={onCancel} type="button">
          ×
        </button>
      </div>

      <div className={styles.content}>
        {selectedImages.length === 0 ? (
          <div className={styles.uploadArea}>
            <label className={styles.uploadLabel}>
              <div className={styles.uploadIcon}>📷</div>
              <div className={styles.uploadText}>
                <p>Upload one or more photos</p>
                <span>Works with any quality - even blurry photos! (max 10MB each)</span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className={styles.fileInput}
              />
            </label>
          </div>
        ) : (
          <div className={styles.preview}>
            <div className={styles.imageGrid}>
              {selectedImages.map((img, idx) => (
                <div key={idx} className={styles.imagePreview}>
                  <img src={img} alt={`Card ${idx + 1}`} className={styles.previewImage} />
                  <span className={styles.imageNumber}>{idx + 1}</span>
                </div>
              ))}
            </div>
            <div className={styles.imageCount}>
              {selectedImages.length} card{selectedImages.length > 1 ? 's' : ''} selected
            </div>
            <button
              className={styles.changeButton}
              onClick={() => setSelectedImages([])}
              type="button"
              disabled={scanning}
            >
              Change Photos
            </button>
          </div>
        )}

        {enhancing && (
          <div className={styles.progress}>
            <p>🔧 Enhancing images for better AI recognition...</p>
          </div>
        )}

        {scanning && (
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
            <p>Scanning card {scanProgress.current} of {scanProgress.total}...</p>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.info}>
          <p>💡 <strong>AI Enhancement Active:</strong></p>
          <ul>
            <li>✅ Photos are automatically enhanced (contrast, brightness)</li>
            <li>✅ AI scans every pixel top-to-bottom, left-to-right</li>
            <li>✅ Zooms into text areas and card details</li>
            <li>✅ Blurry or out-of-focus images</li>
            <li>✅ Dark or poorly lit photos</li>
            <li>✅ Partial card visibility or cards at angles</li>
            <li><strong>Upload any card photo - AI will extract maximum info!</strong></li>
          </ul>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelButton} onClick={onCancel} type="button" disabled={scanning}>
          Cancel
        </button>
        <button
          className={styles.scanButton}
          onClick={handleScan}
          disabled={selectedImages.length === 0 || scanning}
          type="button"
        >
          {scanning ? `Scanning ${scanProgress.current}/${scanProgress.total}...` : `Scan ${selectedImages.length} Card${selectedImages.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
