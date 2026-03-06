"use client";

import { useState } from "react";
import { normalizeText, generateCardDNA, formatDNABreakdown, CONFIDENCE_THRESHOLDS, type CardDNA } from "@/lib/card-dna";
import styles from "../system-check/system-check.module.css";

export default function DNAMatchingAdminPage() {
  const [scanData, setScanData] = useState({
    player: "",
    team: "",
    year: "",
    set: "",
    cardNumber: "",
    brand: "",
    sport: "",
    name: "",
    type: "",
  });
  
  const [dnaPreview, setDnaPreview] = useState<CardDNA | null>(null);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [autoMatch, setAutoMatch] = useState<any>(null);
  const [error, setError] = useState("");

  // Update DNA preview when inputs change
  const handleInputChange = (field: string, value: string) => {
    const updated = { ...scanData, [field]: value };
    setScanData(updated);
    
    // Generate DNA preview
    const dna = generateCardDNA(updated);
    setDnaPreview(dna);
  };

  // Test with example data
  const useExample = (example: string) => {
    const examples: { [key: string]: any } = {
      kobe: {
        player: "Kobe Bryant",
        team: "LA Lakers",
        year: "1996",
        set: "Topps",
        cardNumber: "138",
        sport: "basketball",
      },
      kobeError: {
        player: "Kobe Braynt", // Typo
        team: "Los Angeles", // Partial
        year: "1996",
        set: "Tops", // Missing letter
        cardNumber: "138",
        sport: "basketball",
      },
      charizard: {
        name: "Charizard",
        year: "1999",
        set: "Base Set",
        cardNumber: "4",
      },
      blackLotus: {
        name: "Black Lotus",
        year: "1993",
        set: "Alpha",
        cardNumber: "1",
      },
    };
    
    if (examples[example]) {
      Object.entries(examples[example]).forEach(([field, value]) => {
        handleInputChange(field, String(value));
      });
    }
  };

  // Run DNA matching
  const handleMatch = async () => {
    setMatching(true);
    setError("");
    setMatches([]);
    setAutoMatch(null);
    
    try {
      const response = await fetch("/api/catalog/dna-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scanData,
          year: scanData.year ? parseInt(scanData.year) : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMatches(data.matches || []);
        setAutoMatch(data.autoMatch);
      } else {
        setError(data.message || "No matches found");
      }
    } catch (err: any) {
      setError(`Matching failed: ${err.message}`);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Card DNA Matching System</h1>
      <p className={styles.description}>
        Fuzzy matching that handles OCR errors and text variations. Score cards based on normalized DNA fields 
        instead of exact string matching.
      </p>

      {/* Examples */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Examples</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => useExample("kobe")}
            className={styles.actionButton}
            style={{ width: "auto" }}
          >
            Kobe 1996 (Correct)
          </button>
          <button
            onClick={() => useExample("kobeError")}
            className={styles.actionButton}
            style={{ width: "auto" }}
          >
            Kobe 1996 (OCR Errors)
          </button>
          <button
            onClick={() => useExample("charizard")}
            className={styles.actionButton}
            style={{ width: "auto" }}
          >
            Charizard Base Set
          </button>
          <button
            onClick={() => useExample("blackLotus")}
            className={styles.actionButton}
            style={{ width: "auto" }}
          >
            Black Lotus Alpha
          </button>
        </div>
      </section>

      {/* Input Form */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Scan Data (Simulated OCR Output)</h2>
        
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>Sports Cards</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <input
              type="text"
              value={scanData.player}
              onChange={(e) => handleInputChange("player", e.target.value)}
              placeholder="Player (e.g., Kobe Bryant)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={scanData.team}
              onChange={(e) => handleInputChange("team", e.target.value)}
              placeholder="Team (e.g., LA Lakers)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={scanData.sport}
              onChange={(e) => handleInputChange("sport", e.target.value)}
              placeholder="Sport (basketball, football, etc.)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>TCG Cards (Pokemon, Magic, Yu-Gi-Oh)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <input
              type="text"
              value={scanData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Card Name (e.g., Charizard)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={scanData.type}
              onChange={(e) => handleInputChange("type", e.target.value)}
              placeholder="Type (e.g., Pokémon, Creature)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>Common Fields</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <input
              type="text"
              value={scanData.year}
              onChange={(e) => handleInputChange("year", e.target.value)}
              placeholder="Year (e.g., 1996)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={scanData.set}
              onChange={(e) => handleInputChange("set", e.target.value)}
              placeholder="Set/Brand (e.g., Topps)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <input
              type="text"
              value={scanData.cardNumber}
              onChange={(e) => handleInputChange("cardNumber", e.target.value)}
              placeholder="Card Number (e.g., 138)"
              style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
          </div>
        </div>
        
        <button
          onClick={handleMatch}
          disabled={matching}
          className={styles.actionButton}
          style={{ width: "200px" }}
        >
          {matching ? "Matching..." : "🔍 Find Matches"}
        </button>
      </section>

      {/* DNA Preview */}
      {dnaPreview && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DNA Preview (Normalized Fields)</h2>
          <div className={styles.infoBox}>
            <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(dnaPreview, null, 2)}
            </pre>
          </div>
        </section>
      )}

      {/* Auto Match */}
      {autoMatch && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎯 Auto Match (≥95% Confidence)</h2>
          <div className={styles.infoBox} style={{ background: "#d4edda", borderColor: "#c3e6cb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "5px" }}>
                  {autoMatch.name}
                </h3>
                <p style={{ fontSize: "13px", color: "#666", margin: "0" }}>
                  {autoMatch.stacktrackId}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#27ae60" }}>
                  {autoMatch.percentage}%
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {autoMatch.score}/{autoMatch.maxScore}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
              <strong>Breakdown:</strong> {formatDNABreakdown(autoMatch.breakdown)}
            </div>
          </div>
        </section>
      )}

      {/* All Matches */}
      {matches.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            All Matches ({matches.length} found)
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {matches.map((match: any, index: number) => {
              let bgColor = "#fff";
              let borderColor = "#ddd";
              
              if (match.percentage >= CONFIDENCE_THRESHOLDS.AUTO_MATCH) {
                bgColor = "#d4edda";
                borderColor = "#c3e6cb";
              } else if (match.percentage >= CONFIDENCE_THRESHOLDS.HIGH) {
                bgColor = "#d1ecf1";
                borderColor = "#bee5eb";
              } else if (match.percentage >= CONFIDENCE_THRESHOLDS.MEDIUM) {
                bgColor = "#fff3cd";
                borderColor = "#ffeeba";
              }
              
              return (
                <div
                  key={index}
                  style={{
                    padding: "15px",
                    border: `1px solid ${borderColor}`,
                    borderRadius: "4px",
                    background: bgColor,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                        <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                          #{index + 1}
                        </span>
                        <h3 style={{ fontSize: "15px", fontWeight: "bold", margin: 0 }}>
                          {match.name}
                        </h3>
                      </div>
                      <p style={{ fontSize: "12px", color: "#666", margin: "5px 0", fontFamily: "monospace" }}>
                        {match.stacktrackId}
                      </p>
                      <p style={{ fontSize: "12px", color: "#666", margin: "5px 0" }}>
                        <strong>Confidence:</strong> {match.confidence.toUpperCase()} • 
                        <strong> Breakdown:</strong> {formatDNABreakdown(match.breakdown)}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                        {match.percentage}%
                      </div>
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        {match.score}/{match.maxScore}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Error */}
      {error && (
        <section className={styles.section}>
          <div className={styles.infoBox} style={{ background: "#f8d7da", borderColor: "#f5c6cb" }}>
            <p style={{ color: "#721c24", margin: 0 }}>{error}</p>
          </div>
        </section>
      )}

      {/* Documentation */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How DNA Matching Works</h2>
        <div className={styles.infoBox}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Scoring Weights</h3>
          <ul style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px" }}>
            <li><strong>Player/Name:</strong> 40 points</li>
            <li><strong>Year:</strong> 25 points</li>
            <li><strong>Set/Brand:</strong> 20 points</li>
            <li><strong>Card Number:</strong> 10 points</li>
            <li><strong>Team:</strong> 5 points</li>
            <li style={{ marginTop: "10px" }}><strong>Total Possible:</strong> 100 points</li>
          </ul>
          
          <h3 style={{ fontSize: "14px", marginTop: "20px", marginBottom: "10px" }}>Confidence Levels</h3>
          <ul style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px" }}>
            <li><strong>≥95%:</strong> Auto-match (use automatically)</li>
            <li><strong>80-94%:</strong> High confidence (top result)</li>
            <li><strong>60-79%:</strong> Medium confidence (possible match)</li>
            <li><strong>40-59%:</strong> Low confidence (show as option)</li>
            <li><strong>&lt;40%:</strong> No match</li>
          </ul>
          
          <h3 style={{ fontSize: "14px", marginTop: "20px", marginBottom: "10px" }}>Handles OCR Errors</h3>
          <ul style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px" }}>
            <li>"Tops" → "topps" (missing letter)</li>
            <li>"LA Lakers" → "lakers" (team normalization)</li>
            <li>"Kobe Braynt" → partial match still scores points</li>
            <li>"138A" matches "138" (number variations)</li>
          </ul>
        </div>
      </section>

      {/* System Stats */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>System Statistics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>95%</div>
            <div className={styles.statLabel}>Auto-match threshold</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>7</div>
            <div className={styles.statLabel}>DNA attributes scored</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>100</div>
            <div className={styles.statLabel}>Maximum score</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>Fuzzy</div>
            <div className={styles.statLabel}>Matching mode</div>
          </div>
        </div>
      </section>
    </div>
  );
}
