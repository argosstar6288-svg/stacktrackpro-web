import React, { useRef, useState } from "react";
import axios from "axios";

export default function Scanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to access camera");
    }
  };

  // Capture image
  const capture = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera feed is not ready yet.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError("Failed to capture image.");
        return;
      }

      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");

      setLoading(true);
      setError("");

      try {
        const scanRes = await axios.post("http://localhost:3000/api/scan", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const scanData = scanRes.data;
        const suggestedQuery = scanData?.suggestedQuery || scanData?.query;

        if (!suggestedQuery) {
          setResult(scanData);
          return;
        }

        const valueRes = await axios.get("http://localhost:3000/api/value", {
          params: {
            query: suggestedQuery,
          },
        });

        setResult({
          ...scanData,
          ...valueRes.data,
          suggestedQuery,
          price: valueRes.data?.price ?? scanData?.price ?? null,
          comparables: valueRes.data?.comparables ?? scanData?.comparables ?? [],
          valuation: valueRes.data?.valuation ?? scanData?.valuation,
        });
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Scan failed");
      } finally {
        setLoading(false);
      }
    }, "image/jpeg", 0.92);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 20 }}>
      <h2>StackTrack Scanner</h2>

      <video ref={videoRef} autoPlay style={{ width: 300, borderRadius: 12 }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={startCamera}>Start Camera</button>
        <button onClick={capture}>Scan Card</button>
      </div>

      {loading && <p>Scanning...</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {result?.valuation && (
        <div style={{ marginTop: 16 }}>
          <h3>Value</h3>
          {result.price !== null && result.price !== undefined && (
            <p><strong>Estimated Price:</strong> ${result.price}</p>
          )}
          <p><strong>Detected Text:</strong> {result.detectedText?.trim() || "(none)"}</p>
          <p><strong>Search Query:</strong> {result.suggestedQuery || result.query || "(none)"}</p>
          <p><strong>AI Scan Service:</strong> {result.aiScanUsed ? "online" : "fallback OCR"}</p>
          {!!result.salesSource && <p><strong>Listing Source:</strong> {result.salesSource}</p>}
          {result.prediction?.label && (
            <p>
              <strong>AI Prediction:</strong> {result.prediction.label} ({result.prediction.confidence}% confidence)
            </p>
          )}
          <p>Low: ${result.valuation.low}</p>
          <p>Avg: ${result.valuation.average}</p>
          <p>High: ${result.valuation.high}</p>
          <p>Trend: {result.valuation.trend}</p>
          <p>Confidence: {result.valuation.confidence}%</p>
          <p>Sales Count: {result.valuation.salesCount}</p>
          {result.valuation.salesCount === 0 && (
            <p style={{ color: "#92400e" }}>No matching listings found. Try better lighting or move closer to the card text.</p>
          )}
          {Array.isArray(result.comparables) && result.comparables.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Comparables</h4>
              {result.comparables.map((item, index) => (
                <p key={`${item.title || "sale"}-${index}`}>
                  ${(Number(item.price) || 0).toFixed(2)} - {item.title || "eBay sale"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
