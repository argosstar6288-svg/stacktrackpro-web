/**
 * useCardScanner Hook
 * 
 * Integration with microservices pipeline
 * Handles image scanning through:
 * 1. Python AI Service (YOLO + OCR)
 * 2. Node.js Matching Engine (Card identification)
 * 3. Pricing Engine (eBay + catalog)
 * 4. Result aggregation
 */

import { useState, useCallback } from "react";

interface ScanResult {
  success: boolean;
  result?: {
    card?: {
      id: string;
      name: string;
      player: string;
      team: string;
      cardNumber: string;
      year: number;
      set: string;
      rarity: string;
      game: string;
      price: number;
    };
    cardName: string;
    confidence: number;
    autoSelected: boolean;
    estimatedPrice: number;
    priceSource: string;
    game: string;
  };
  pipeline?: {
    aiService: any;
    matching: any;
    pricing: any;
  };
  timing?: {
    aiService: number;
    matching: number;
    pricing: number;
    total: number;
  };
  error?: string;
  message?: string;
}

interface ScanState {
  loading: boolean;
  progress: string;
  error: string | null;
  result: ScanResult | null;
  startTime: number | null;
}

export function useCardScanner(gameType?: string) {
  const [state, setState] = useState<ScanState>({
    loading: false,
    progress: "",
    error: null,
    result: null,
    startTime: null
  });

  const updateProgress = useCallback((message: string) => {
    setState(prev => ({ ...prev, progress: message }));
  }, []);

  const scanImage = useCallback(
    async (file: File | Blob): Promise<ScanResult | null> => {
      try {
        setState({
          loading: true,
          progress: "Starting scan...",
          error: null,
          result: null,
          startTime: Date.now()
        });

        // Step 1: Prepare form data
        updateProgress("Preparing image...");
        const formData = new FormData();
        formData.append("file", file);

        // Step 2: Send to pipeline
        updateProgress("Sending to AI service...");
        const url = new URL("/api/scan-pipeline", window.location.origin);
        if (gameType) {
          url.searchParams.append("gameType", gameType);
        }

        const response = await fetch(url.toString(), {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        updateProgress("Processing results...");
        const result: ScanResult = await response.json();

        const finalState: ScanState = {
          loading: false,
          progress: result.success ? "Scan complete!" : "Scan failed",
          error: result.success ? null : result.error || "Unknown error",
          result,
          startTime: null
        };

        setState(finalState);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
          progress: "Error occurred"
        }));
        return null;
      }
    },
    [gameType, updateProgress]
  );

  const scanImageFile = useCallback(
    async (file: File): Promise<ScanResult | null> => {
      return scanImage(file);
    },
    [scanImage]
  );

  const scanImageFromUrl = useCallback(
    async (url: string): Promise<ScanResult | null> => {
      try {
        updateProgress("Downloading image...");
        const response = await fetch(url);
        const blob = await response.blob();
        return scanImage(blob);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to download image";
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
          progress: "Error occurred"
        }));
        return null;
      }
    },
    [scanImage, updateProgress]
  );

  const reset = useCallback(() => {
    setState({
      loading: false,
      progress: "",
      error: null,
      result: null,
      startTime: null
    });
  }, []);

  return {
    // State
    loading: state.loading,
    progress: state.progress,
    error: state.error,
    result: state.result,

    // Methods
    scanImage,
    scanImageFile,
    scanImageFromUrl,
    reset,

    // Computed
    isSuccess: state.result?.success ?? false,
    card: state.result?.result?.card,
    confidence: state.result?.result?.confidence ?? 0,
    price: state.result?.result?.estimatedPrice ?? 0,
    game: state.result?.result?.game
  };
}

/**
 * Example usage in a React component:
 * 
 * function ScannerComponent() {
 *   const { 
 *     scanImageFile, 
 *     loading, 
 *     result, 
 *     error, 
 *     progress 
 *   } = useCardScanner("pokemon");
 *
 *   const handleFileSelect = async (file: File) => {
 *     const result = await scanImageFile(file);
 *     if (result?.success) {
 *       console.log("Card found:", result.result.cardName);
 *       console.log("Price:", result.result.estimatedPrice);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {loading && <p>Scanning... {progress}</p>}
 *       {error && <p>Error: {error}</p>}
 *       {result?.success && (
 *         <div>
 *           <h2>{result.result.cardName}</h2>
 *           <p>Confidence: {(result.result.confidence * 100).toFixed(1)}%</p>
 *           <p>Price: ${result.result.estimatedPrice}</p>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 */
