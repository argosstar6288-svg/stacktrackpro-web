"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, updateCard } from "@/lib/cards";

export default function CSVImageUpdatePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const { cards, loading: cardsLoading } = useUserCards();
  const [csvData, setCsvData] = useState<Array<{ cardName: string; imageUrl: string }>>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<Array<{ cardName: string; status: "matched" | "not-found" | "invalid-url" | "updated" }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.trim().split("\n");
        
        if (lines.length < 2) {
          setError("CSV must have at least a header row and one data row");
          return;
        }

        // Parse header
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const cardNameIdx = headers.findIndex((h) => h.includes("card") || h.includes("name"));
        const imageUrlIdx = headers.findIndex((h) => h.includes("image") || h.includes("url"));

        if (cardNameIdx === -1 || imageUrlIdx === -1) {
          setError("CSV must have 'Card Name' and 'Image URL' columns");
          return;
        }

        // Parse data rows
        const data: typeof csvData = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim());
          if (parts[cardNameIdx] && parts[imageUrlIdx]) {
            data.push({
              cardName: parts[cardNameIdx],
              imageUrl: parts[imageUrlIdx],
            });
          }
        }

        if (data.length === 0) {
          setError("No valid rows found in CSV");
          return;
        }

        setCsvData(data);
        setError("");
        setResults([]);
      } catch (err) {
        setError("Failed to parse CSV: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpdate = async () => {
    if (csvData.length === 0 || cardsLoading) return;

    setIsUpdating(true);
    setProgress({ current: 0, total: csvData.length });
    setResults([]);

    const updateResults: typeof results = [];

    for (let i = 0; i < csvData.length; i++) {
      const { cardName, imageUrl } = csvData[i];
      setProgress({ current: i + 1, total: csvData.length });

      // Validate URL
      try {
        new URL(imageUrl);
      } catch {
        updateResults.push({ cardName, status: "invalid-url" });
        continue;
      }

      // Find matching card (case-insensitive)
      const matchingCard = cards.find(
        (c) => c.name.toLowerCase() === cardName.toLowerCase()
      );

      if (!matchingCard) {
        updateResults.push({ cardName, status: "not-found" });
        continue;
      }

      try {
        await updateCard(matchingCard.id, { imageUrl });
        updateResults.push({ cardName, status: "updated" });
        console.log(`✓ Updated: ${cardName}`);
      } catch (error) {
        console.error(`Error updating ${cardName}:`, error);
        updateResults.push({ cardName, status: "not-found" });
      }

      // Delay to avoid overloading
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setResults(updateResults);
    setIsUpdating(false);
  };

  const updatedCount = results.filter((r) => r.status === "updated").length;
  const notFoundCount = results.filter((r) => r.status === "not-found").length;
  const invalidCount = results.filter((r) => r.status === "invalid-url").length;

  if (!userId) {
    return <div style={{ padding: "2rem", color: "#fff" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "#fff" }}>
      <h1 style={{ marginBottom: "1rem", color: "#10b3f0" }}>CSV Image Upload</h1>

      <div style={{ backgroundColor: "#3a2a2a", padding: "1rem", borderRadius: "8px", marginBottom: "2rem", borderLeft: "4px solid #ff7a47" }}>
        <strong>How to use:</strong>
        <ol style={{ marginTop: "0.5rem", marginLeft: "1.5rem" }}>
          <li>Create a CSV file with columns: <code>"Card Name"</code> and <code>"Image URL"</code></li>
          <li>Upload the file below</li>
          <li>Review the preview and click "Update" to batch update all cards</li>
        </ol>
        <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.85em" }}>
          Example CSV:<br />
          Card Name,Image URL<br />
          Altaria Pokémon Card,https://example.com/altaria.jpg<br />
          Pikachu,https://example.com/pikachu.jpg
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#3a1a1a", padding: "1rem", borderRadius: "8px", marginBottom: "2rem", borderLeft: "4px solid #ff6b6b", color: "#ff6b6b" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <strong>Select CSV File:</strong>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUpdating}
            style={{
              display: "block",
              marginTop: "0.5rem",
              padding: "0.75rem",
              borderRadius: "6px",
              border: "1px solid #555",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              cursor: isUpdating ? "not-allowed" : "pointer",
            }}
          />
        </label>
      </div>

      {csvData.length > 0 && (
        <>
          <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.2em", marginBottom: "1rem" }}>Preview ({csvData.length} rows)</h2>
            <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "1rem" }}>
              {csvData.slice(0, 10).map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#10b3f0" }}>{row.cardName}</div>
                  <div style={{ color: "#999", wordBreak: "break-all", fontSize: "0.85em" }}>{row.imageUrl}</div>
                </div>
              ))}
              {csvData.length > 10 && (
                <div style={{ padding: "1rem", textAlign: "center", color: "#999" }}>
                  ... and {csvData.length - 10} more rows
                </div>
              )}
            </div>

            <button
              onClick={handleBulkUpdate}
              disabled={isUpdating || csvData.length === 0}
              style={{
                width: "100%",
                padding: "1rem",
                borderRadius: "6px",
                background: isUpdating ? "#555" : "#10b3f0",
                color: isUpdating ? "#999" : "#000",
                border: "none",
                fontWeight: "bold",
                cursor: isUpdating ? "not-allowed" : "pointer",
                fontSize: "1em",
              }}
            >
              {isUpdating ? `Updating... (${progress.current}/${progress.total})` : `Update ${csvData.length} Cards`}
            </button>
          </div>

          {isUpdating && (
            <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.9em", color: "#999", marginBottom: "0.5rem" }}>
                  Progress: {progress.current} / {progress.total}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "24px",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      backgroundColor: "#10b3f0",
                      width: `${(progress.current / progress.total) * 100}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px" }}>
              <h2 style={{ fontSize: "1.2em", marginBottom: "1rem" }}>Results</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ backgroundColor: "#1a3a2a", padding: "1rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.9em", color: "#999" }}>Updated</div>
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#4ade80" }}>{updatedCount}</div>
                </div>
                <div style={{ backgroundColor: "#3a2a2a", padding: "1rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.9em", color: "#999" }}>Not Found</div>
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#ff7a47" }}>{notFoundCount}</div>
                </div>
                <div style={{ backgroundColor: "#3a2a2a", padding: "1rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.9em", color: "#999" }}>Invalid URL</div>
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#ff7a47" }}>{invalidCount}</div>
                </div>
              </div>

              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {results
                  .sort((a, b) => {
                    const statusOrder = { updated: 0, "not-found": 1, "invalid-url": 2 };
                    return statusOrder[a.status] - statusOrder[b.status];
                  })
                  .map((result, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        backgroundColor:
                          result.status === "updated"
                            ? "#1a3a2a"
                            : "#3a2a2a",
                        borderLeft: `4px solid ${
                          result.status === "updated"
                            ? "#4ade80"
                            : "#ff7a47"
                        }`,
                        borderRadius: "4px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{result.cardName}</span>
                        <span
                          style={{
                            color:
                              result.status === "updated"
                                ? "#4ade80"
                                : "#ff7a47",
                            fontSize: "0.85em",
                          }}
                        >
                          {result.status === "updated"
                            ? "✓ Updated"
                            : result.status === "not-found"
                            ? "✗ Not Found"
                            : "✗ Invalid URL"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
