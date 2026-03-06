"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { importCardsIntoCollection, triggerPriceUpdate, getCatalogStats } from "@/lib/catalog";
import styles from "../system-check/system-check.module.css";

interface ImportStatus {
  category: string;
  running: boolean;
  progress: string;
  stats?: any;
}

export default function CatalogManagerPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [catalogStats, setCatalogStats] = useState<Record<string, number> | null>(null);
  const [imports, setImports] = useState<Record<string, ImportStatus>>({
    pokemon: { category: "pokemon", running: false, progress: "" },
    magic: { category: "magic", running: false, progress: "" },
    yugioh: { category: "yugioh", running: false, progress: "" },
  });
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceUpdateResult, setPriceUpdateResult] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    loadCatalogStats();
  }, []);

  const loadCatalogStats = async () => {
    try {
      const stats = await getCatalogStats();
      setCatalogStats(stats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleImport = async (category: string, setId?: string, limit = 100) => {
    setImports(prev => ({
      ...prev,
      [category]: { ...prev[category], running: true, progress: `Starting import...` }
    }));

    try {
      const result = await importCardsIntoCollection(category, setId, limit);
      
      setImports(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          running: false,
          progress: `✓ Complete: ${result.stats.imported} imported, ${result.stats.failed} failed`,
          stats: result.stats
        }
      }));

      // Refresh stats
      await loadCatalogStats();
    } catch (error) {
      setImports(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          running: false,
          progress: `✗ Failed: ${error instanceof Error ? error.message : "Unknown error"}`
        }
      }));
    }
  };

  const handlePriceUpdate = async () => {
    setUpdatingPrices(true);
    setPriceUpdateResult(null);

    try {
      const result = await triggerPriceUpdate();
      setPriceUpdateResult(result);
    } catch (error) {
      setPriceUpdateResult({
        error: error instanceof Error ? error.message : "Price update failed"
      });
    } finally {
      setUpdatingPrices(false);
    }
  };

  if (loading) {
    return <div className={styles.page}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Card Catalog Manager</h1>
          <p className={styles.subtitle}>Import and manage the global card database</p>
        </div>
        <Link href="/dashboard/admin" className={styles.backButton}>
          ← Back to Admin
        </Link>
      </div>

      {/* Catalog Statistics */}
      <div className={styles.panel}>
        <h2>📊 Catalog Statistics</h2>
        {catalogStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Pokemon TCG</div>
              <div className={styles.statValue}>{catalogStats.pokemon.toLocaleString()}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Magic: The Gathering</div>
              <div className={styles.statValue}>{catalogStats.magic.toLocaleString()}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Yu-Gi-Oh!</div>
              <div className={styles.statValue}>{catalogStats.yugioh.toLocaleString()}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Cards</div>
              <div className={styles.statValue} style={{ color: "#10b3f0" }}>
                {catalogStats.total.toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: "#999" }}>Loading stats...</p>
        )}
      </div>

      {/* Pokemon TCG Import */}
      <div className={styles.panel}>
        <h2>🎴 Pokemon TCG Import</h2>
        <p style={{ color: "#bbb", marginBottom: "16px" }}>
          Import cards from Pokemon TCG API (api.pokemontcg.io)
        </p>
        
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            className={styles.actionButton}
            onClick={() => handleImport("pokemon", undefined, 100)}
            disabled={imports.pokemon.running}
          >
            {imports.pokemon.running ? "⏳ Importing..." : "Import 100 Cards"}
          </button>
          
          <button
            className={styles.actionButton}
            onClick={() => handleImport("pokemon", "base1", 102)}
            disabled={imports.pokemon.running}
            style={{ background: "rgba(255, 200, 100, 0.1)" }}
          >
            Import Base Set (102)
          </button>
          
          <button
            className={styles.actionButton}
            onClick={() => handleImport("pokemon", "sv04pt", 250)}
            disabled={imports.pokemon.running}
            style={{ background: "rgba(150, 100, 255, 0.1)" }}
          >
            Import Paldean Fates
          </button>
        </div>

        {imports.pokemon.progress && (
          <div style={{ marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
            <code style={{ fontSize: "0.9em" }}>{imports.pokemon.progress}</code>
            {imports.pokemon.stats && (
              <div style={{ marginTop: "8px", fontSize: "0.85em", color: "#bbb" }}>
                Imported: {imports.pokemon.stats.imported} | Failed: {imports.pokemon.stats.failed} | Skipped: {imports.pokemon.stats.skipped}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Magic: The Gathering Import */}
      <div className={styles.panel}>
        <h2>✨ Magic: The Gathering Import</h2>
        <p style={{ color: "#bbb", marginBottom: "16px" }}>
          Import cards from Scryfall API (api.scryfall.com)
        </p>
        
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            className={styles.actionButton}
            onClick={() => handleImport("magic", undefined, 100)}
            disabled={imports.magic.running}
          >
            {imports.magic.running ? "⏳ Importing..." : "Import 100 Cards"}
          </button>
          
          <button
            className={styles.actionButton}
            onClick={() => handleImport("magic", "neo", 250)}
            disabled={imports.magic.running}
            style={{ background: "rgba(200, 100, 255, 0.1)" }}
          >
            Import Kamigawa: Neon Dynasty
          </button>
        </div>

        {imports.magic.progress && (
          <div style={{ marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
            <code style={{ fontSize: "0.9em" }}>{imports.magic.progress}</code>
            {imports.magic.stats && (
              <div style={{ marginTop: "8px", fontSize: "0.85em", color: "#bbb" }}>
                Imported: {imports.magic.stats.imported} | Failed: {imports.magic.stats.failed}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yu-Gi-Oh Import */}
      <div className={styles.panel}>
        <h2>🃏 Yu-Gi-Oh! Import</h2>
        <p style={{ color: "#bbb", marginBottom: "16px" }}>
          Import cards from YGOPRODeck API (db.ygoprodeck.com)
        </p>
        
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            className={styles.actionButton}
            onClick={() => handleImport("yugioh", undefined, 100)}
            disabled={imports.yugioh.running}
          >
            {imports.yugioh.running ? "⏳ Importing..." : "Import 100 Cards"}
          </button>
        </div>

        {imports.yugioh.progress && (
          <div style={{ marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
            <code style={{ fontSize: "0.9em" }}>{imports.yugioh.progress}</code>
            {imports.yugioh.stats && (
              <div style={{ marginTop: "8px", fontSize: "0.85em", color: "#bbb" }}>
                Imported: {imports.yugioh.stats.imported} | Failed: {imports.yugioh.stats.failed}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price Update */}
      <div className={styles.panel}>
        <h2>💰 Price Updates</h2>
        <p style={{ color: "#bbb", marginBottom: "16px" }}>
          Manually trigger catalog price updates (normally runs daily at 3 AM)
        </p>
        
        <button
          className={styles.actionButton}
          onClick={handlePriceUpdate}
          disabled={updatingPrices}
          style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}
        >
          {updatingPrices ? "⏳ Updating Prices..." : "💰 Update All Prices"}
        </button>

        {priceUpdateResult && (
          <div style={{ marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
            {priceUpdateResult.error ? (
              <div style={{ color: "#ef4444" }}>✗ {priceUpdateResult.error}</div>
            ) : (
              <div>
                <div style={{ color: "#22c55e", marginBottom: "8px" }}>✓ Price update complete!</div>
                <div style={{ fontSize: "0.85em", color: "#bbb" }}>
                  Updated: {priceUpdateResult.stats?.updated} | Failed: {priceUpdateResult.stats?.failed} | Skipped: {priceUpdateResult.stats?.skipped}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Notes */}
      <div className={styles.panel} style={{ background: "rgba(255, 200, 100, 0.05)", border: "1px solid rgba(255, 200, 100, 0.2)" }}>
        <h3>📝 Import Notes</h3>
        <ul style={{ color: "#bbb", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li><strong>Pokemon TCG:</strong> ~30,000 total cards. Import by set or in batches.</li>
          <li><strong>Magic:</strong> ~100,000+ cards. Best to import specific sets to avoid timeout.</li>
          <li><strong>Yu-Gi-Oh:</strong> ~20,000 cards. Can import all at once or by set.</li>
          <li><strong>Sports Cards:</strong> Use PriceCharting CSV exports (1M+ cards).</li>
          <li><strong>Rate Limits:</strong> APIs have rate limits. Import in batches of 100-250.</li>
          <li><strong>Storage:</strong> Each card ~2KB. 100,000 cards = ~200MB in Firestore.</li>
        </ul>
      </div>
    </div>
  );
}
