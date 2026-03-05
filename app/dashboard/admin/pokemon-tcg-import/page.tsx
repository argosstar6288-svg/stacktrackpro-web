'use client';

import { useState } from 'react';
import {
  batchUploadCards,
  getCollectionStats,
  clearCardCollection,
} from '@/app/lib/firestore-cards';
import { PokemonCardData } from '@/app/lib/card-types';
import styles from './pokemon-tcg-import.module.css';

export default function PokemonTCGImportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [importProgress, setImportProgress] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const POPULAR_SETS = [
    'sv04pt', // Scarlet & Violet - Paldean Fates
    'sv4pt', // Scarlet & Violet - Obsidian Flames
    'sv04', // Scarlet & Violet - Paradox Rift
    'sv3pt', // Scarlet & Violet - 151
    'sv3', // Scarlet & Violet - Temporal Forces
  ];

  const fetchAndImportCards = async (setIds?: string[]) => {
    setIsLoading(true);
    setImportProgress('🔄 Fetching cards from Pokemon TCG API...');

    try {
      // Fetch from API
      const apiUrl = setIds && setIds.length > 0
        ? `https://api.pokemontcg.io/v2/cards?${setIds.map(id => `q=set.id:${id}`).join('&')}&pageSize=250`
        : 'https://api.pokemontcg.io/v2/cards?pageSize=250';

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid API response');
      }

      const cards: PokemonCardData[] = data.data;
      setImportProgress(
        `📥 Fetched ${cards.length} cards. Starting Firestore upload...`
      );

      // Upload to Firestore
      const importStats = await batchUploadCards(cards);
      setImportProgress(
        `✅ Import complete! Imported: ${importStats.imported}, Failed: ${importStats.failed}`
      );

      // Refresh stats
      const collectionStats = await getCollectionStats();
      setStats(collectionStats);
    } catch (error) {
      setImportProgress(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCollection = async () => {
    if (
      !confirm(
        '⚠️ This will DELETE all cards from Firestore. Are you absolutely sure?'
      )
    ) {
      return;
    }

    setIsLoading(true);
    setImportProgress('🗑️ Deleting all cards...');

    try {
      const count = await clearCardCollection();
      setImportProgress(`✅ Deleted ${count} cards`);
      setStats(null);
    } catch (error) {
      setImportProgress(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadStats = async () => {
    setIsLoading(true);
    try {
      const collectionStats = await getCollectionStats();
      setStats(collectionStats);
      setImportProgress('✅ Stats loaded');
    } catch (error) {
      setImportProgress(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setImportProgress('📖 Reading JSON file...');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const cardsToImport = Array.isArray(data) ? data : data.cards || data.data;

      if (!Array.isArray(cardsToImport)) {
        throw new Error('Invalid JSON format - expected array of cards');
      }

      setImportProgress(
        `📥 Loaded ${cardsToImport.length} cards. Starting Firestore upload...`
      );

      const importStats = await batchUploadCards(cardsToImport);
      setImportProgress(
        `✅ Import complete! Imported: ${importStats.imported}, Failed: ${importStats.failed}`
      );

      // Refresh stats
      const collectionStats = await getCollectionStats();
      setStats(collectionStats);
    } catch (error) {
      setImportProgress(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🎮 Pokemon TCG Card Database Manager</h1>
        <p>Fetch and manage Pokemon TCG card image data in Firestore</p>
      </div>

      <div className={styles.section}>
        <h2>📊 Collection Statistics</h2>
        {stats ? (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.totalCards}</div>
              <div className={styles.statLabel}>Total Cards</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.uniqueSets}</div>
              <div className={styles.statLabel}>Unique Sets</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.uniqueTypes}</div>
              <div className={styles.statLabel}>Card Types</div>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No data loaded yet</p>
        )}
        <button
          onClick={handleLoadStats}
          disabled={isLoading}
          className={styles.button}
        >
          📈 Load Statistics
        </button>
      </div>

      <div className={styles.section}>
        <h2>🔄 Import from API</h2>

        <div className={styles.importOptions}>
          <div>
            <h3>Popular Sets (Recommended)</h3>
            <p className={styles.subtitle}>
              Import the 5 most recent sets (~1000-1500 cards)
            </p>
            <button
              onClick={() => fetchAndImportCards(POPULAR_SETS)}
              disabled={isLoading}
              className={styles.buttonPrimary}
            >
              🚀 Import Popular Sets
            </button>
          </div>

          <div>
            <h3>All Available Sets</h3>
            <p className={styles.subtitle}>
              Import entire database (~20,000+ cards - takes longer)
            </p>
            <button
              onClick={() => fetchAndImportCards()}
              disabled={isLoading}
              className={styles.buttonPrimary}
            >
              💾 Import All Sets
            </button>
          </div>

          <div>
            <h3>Custom Sets</h3>
            <p className={styles.subtitle}>
              Import specific sets by entering their IDs
            </p>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="e.g., sv04pt,sv4pt,sv04 (comma-separated)"
                className={styles.input}
              />
              <button
                // onClick={() => fetchAndImportCards(customSets)}
                disabled={isLoading}
                className={styles.buttonSecondary}
              >
                📌 Import Custom Sets
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>📁 Import from JSON File</h2>
        <p className={styles.subtitle}>
          Upload a JSON file with Pokemon TCG card data (array format or object with{' '}
          <code>cards</code> or <code>data</code> property)
        </p>
        <div className={styles.fileUpload}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={isLoading}
            className={styles.fileInput}
          />
          {selectedFile && (
            <p className={styles.fileName}>Selected: {selectedFile.name}</p>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2>⚠️ Danger Zone</h2>
        <p className={styles.subtitle}>
          Permanently delete all cards from Firestore
        </p>
        <button
          onClick={handleClearCollection}
          disabled={isLoading}
          className={styles.buttonDanger}
        >
          🗑️ Clear All Cards
        </button>
      </div>

      {importProgress && (
        <div className={styles.progressBox}>
          <h3>Progress</h3>
          <p>{importProgress}</p>
          {isLoading && <div className={styles.spinner} />}
        </div>
      )}

      <div className={styles.info}>
        <h3>ℹ️ Information</h3>
        <ul>
          <li>
            <strong>Popular Sets:</strong> Contains the 5 most recent Scarlet &
            Violet sets (~1000-1500 cards)
          </li>
          <li>
            <strong>All Sets:</strong> Imports every available Pokemon TCG card
            (20,000+ cards, ~2-5 minutes)
          </li>
          <li>
            <strong>Firestore Batch Limit:</strong> Respects 500-write limit,
            automatically splits large imports
          </li>
          <li>
            <strong>Search Index:</strong> Cards are indexed by name, type, and
            set for fast searching
          </li>
          <li>
            <strong>Image Data:</strong> Uses official Pokemon TCG API card
            images (large and small formats)
          </li>
        </ul>
      </div>
    </div>
  );
}
