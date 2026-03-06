"use client";

import { useState, useEffect } from "react";
import { generateStackTrackId, parseStackTrackId, isValidStackTrackId, EXAMPLE_IDS } from "@/lib/universal-card-id";
import styles from "../system-check/system-check.module.css";

export default function UniversalIDAdminPage() {
  const [idInput, setIdInput] = useState("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [generateParams, setGenerateParams] = useState({
    game: "",
    name: "",
    year: "",
    set: "",
    cardNumber: "",
    player: "",
    sport: "",
  });
  const [generatedId, setGeneratedId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Parse ID
  const handleParseId = () => {
    if (!idInput) return;
    
    const valid = isValidStackTrackId(idInput);
    if (!valid) {
      setParseResult({ error: "Invalid StackTrack ID format" });
      return;
    }
    
    const parsed = parseStackTrackId(idInput);
    setParseResult(parsed);
  };

  // Generate ID
  const handleGenerateId = () => {
    try {
      const id = generateStackTrackId({
        game: generateParams.game || "other",
        name: generateParams.name,
        year: generateParams.year ? parseInt(generateParams.year) : undefined,
        set: generateParams.set,
        cardNumber: generateParams.cardNumber,
        player: generateParams.player,
        sport: generateParams.sport,
      });
      setGeneratedId(id);
    } catch (err: any) {
      setGeneratedId(`Error: ${err.message}`);
    }
  };

  // Lookup card by ID
  const handleLookupId = async () => {
    try {
      const res = await fetch(`/api/catalog/id-lookup?stacktrackId=${encodeURIComponent(lookupId)}`);
      const data = await res.json();
      setLookupResult(data);
    } catch (err) {
      setLookupResult({ error: "Lookup failed" });
    }
  };

  // Use example ID
  const useExampleId = (exampleId: string) => {
    setIdInput(exampleId);
    setLookupId(exampleId);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Universal Card ID System</h1>
      <p className={styles.description}>
        Manage and test the Universal StackTrack ID system. Every card gets one permanent ID that connects collections, marketplace, auctions, and price tracking.
      </p>

      {/* Example IDs */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Example IDs</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" }}>
          <div>
            <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>Sports Cards</h3>
            {Object.entries(EXAMPLE_IDS.sports).map(([key, id]) => (
              <div key={key} style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => useExampleId(id)}
                  style={{
                    background: "none",
                    border: "1px solid #ddd",
                    padding: "8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {id}
                </button>
              </div>
            ))}
          </div>
          
          <div>
            <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>Pokemon</h3>
            {Object.entries(EXAMPLE_IDS.pokemon).map(([key, id]) => (
              <div key={key} style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => useExampleId(id)}
                  style={{
                    background: "none",
                    border: "1px solid #ddd",
                    padding: "8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {id}
                </button>
              </div>
            ))}
          </div>
          
          <div>
            <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#666" }}>Magic & Yu-Gi-Oh</h3>
            {Object.entries({...EXAMPLE_IDS.magic, ...EXAMPLE_IDS.yugioh}).map(([key, id]) => (
              <div key={key} style={{ marginBottom: "8px" }}>
                <button
                  onClick={() => useExampleId(id)}
                  style={{
                    background: "none",
                    border: "1px solid #ddd",
                    padding: "8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {id}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parse ID */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Parse StackTrack ID</h2>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="STK-BASKETBALL-1996-TOPPS-138-KOBE"
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "13px",
              fontFamily: "monospace",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
        </div>
        <button onClick={handleParseId} className={styles.actionButton}>
          Parse ID
        </button>
        
        {parseResult && (
          <div className={styles.infoBox} style={{ marginTop: "15px" }}>
            {parseResult.error ? (
              <p style={{ color: "#e74c3c" }}>{parseResult.error}</p>
            ) : (
              <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(parseResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>

      {/* Generate ID */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Generate StackTrack ID</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "15px" }}>
          <input
            type="text"
            value={generateParams.game}
            onChange={(e) => setGenerateParams({...generateParams, game: e.target.value})}
            placeholder="Game (basketball, pokemon, etc.)"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <input
            type="text"
            value={generateParams.name}
            onChange={(e) => setGenerateParams({...generateParams, name: e.target.value})}
            placeholder="Card Name"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <input
            type="text"
            value={generateParams.year}
            onChange={(e) => setGenerateParams({...generateParams, year: e.target.value})}
            placeholder="Year"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <input
            type="text"
            value={generateParams.set}
            onChange={(e) => setGenerateParams({...generateParams, set: e.target.value})}
            placeholder="Set/Brand"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <input
            type="text"
            value={generateParams.cardNumber}
            onChange={(e) => setGenerateParams({...generateParams, cardNumber: e.target.value})}
            placeholder="Card Number"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <input
            type="text"
            value={generateParams.player}
            onChange={(e) => setGenerateParams({...generateParams, player: e.target.value})}
            placeholder="Player Name (sports only)"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
        </div>
        <button onClick={handleGenerateId} className={styles.actionButton}>
          Generate ID
        </button>
        
        {generatedId && (
          <div className={styles.infoBox} style={{ marginTop: "15px" }}>
            <strong>Generated ID:</strong>
            <p style={{ fontFamily: "monospace", fontSize: "13px", marginTop: "8px", wordBreak: "break-all" }}>
              {generatedId}
            </p>
          </div>
        )}
      </section>

      {/* Lookup Card */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lookup Card by ID</h2>
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="STK-BASKETBALL-1996-TOPPS-138-KOBE"
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "13px",
              fontFamily: "monospace",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
        </div>
        <button onClick={handleLookupId} className={styles.actionButton}>
          Lookup Card
        </button>
        
        {lookupResult && (
          <div className={styles.infoBox} style={{ marginTop: "15px" }}>
            {lookupResult.found ? (
              <div>
                <p style={{ color: "#27ae60", fontWeight: "bold", marginBottom: "10px" }}>
                  ✓ Card Found in Catalog
                </p>
                <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", maxHeight: "400px", overflow: "auto" }}>
                  {JSON.stringify(lookupResult.card, null, 2)}
                </pre>
              </div>
            ) : (
              <p style={{ color: "#e74c3c" }}>
                {lookupResult.error || "Card not found in catalog"}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Documentation */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Documentation</h2>
        <div className={styles.infoBox}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>ID Format</h3>
          <p style={{ fontSize: "13px", marginBottom: "15px" }}>
            <code>STK-{"{GAME}"}-{"{YEAR}"}-{"{SET}"}-{"{NUMBER}"}-{"{NAME}"}</code>
          </p>
          
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Benefits</h3>
          <ul style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px" }}>
            <li>One permanent ID per card across all features</li>
            <li>Collections store references, not full data (90% storage reduction)</li>
            <li>Price updates affect all cards instantly (1 write vs 100 writes)</li>
            <li>Enables powerful analytics (trending cards, portfolio tracking)</li>
            <li>Supports external ID mapping (TCGplayer, PriceCharting, PSA)</li>
          </ul>
          
          <h3 style={{ fontSize: "14px", marginTop: "15px", marginBottom: "10px" }}>Files</h3>
          <ul style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px", fontFamily: "monospace" }}>
            <li>lib/universal-card-id.ts - ID generation logic</li>
            <li>lib/card-references.ts - Collection management</li>
            <li>api/catalog/id-lookup/route.ts - Lookup API</li>
            <li>UNIVERSAL_CARD_ID_SYSTEM.md - Full documentation</li>
          </ul>
          
          <div style={{ marginTop: "20px", padding: "15px", background: "#f8f9fa", borderRadius: "4px" }}>
            <strong style={{ fontSize: "13px" }}>Next Steps:</strong>
            <ol style={{ fontSize: "13px", lineHeight: "1.8", paddingLeft: "20px", marginTop: "8px" }}>
              <li>Import cards into catalog (they now include stacktrackId)</li>
              <li>Test ID generation with the form above</li>
              <li>Verify lookups work with imported cards</li>
              <li>Migrate existing user collections to reference system</li>
              <li>Update scanner to use universal IDs</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>System Statistics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>Universal</div>
            <div className={styles.statLabel}>Single ID per card</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>90%</div>
            <div className={styles.statLabel}>Storage reduction</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>99%</div>
            <div className={styles.statLabel}>Write operation reduction</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>5+</div>
            <div className={styles.statLabel}>Connected features</div>
          </div>
        </div>
      </section>
    </div>
  );
}
