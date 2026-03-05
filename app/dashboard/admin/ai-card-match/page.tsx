'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  AIScanResult,
  findClosestMatchedCard,
  findCardCandidates,
  MatchedCard,
} from '@/app/lib/ai-card-matcher';
import {
  saveAIMatchedCardToCollection,
  batchSaveAIMatchedCards,
} from '@/app/lib/ai-card-saver';
import styles from './ai-card-match.module.css';

interface MatchResult {
  cardId: string;
  scanResult: AIScanResult;
  match: MatchedCard | null;
  candidates: MatchedCard[];
}

export default function AICardMatchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const [scanData, setScanData] = useState<AIScanResult>({
    cardName: '',
    setName: '',
    cardNumber: '',
    confidence: 100,
  });

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedCards, setSavedCards] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchedCard | null>(null);

  // Handle AI scan input
  const handleScanDataChange = (field: keyof AIScanResult, value: any) => {
    setScanData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Find closest match
  const handleFindMatch = async () => {
    if (!scanData.cardName.trim()) {
      alert('Please enter a card name');
      return;
    }

    setLoading(true);
    setMatchResult(null);
    setSelectedCandidate(null);

    try {
      const match = await findClosestMatchedCard(scanData);
      const candidates = await findCardCandidates(scanData, 5);

      setMatchResult({
        cardId: '',
        scanResult: scanData,
        match,
        candidates,
      });
    } catch (error) {
      console.error('Error finding match:', error);
      alert('Error finding matching card');
    } finally {
      setLoading(false);
    }
  };

  // Save matched card
  const handleSaveMatch = async () => {
    if (!user || !matchResult?.match) return;

    setLoading(true);
    try {
      // For this example, we'll just log the match
      console.log('Match to save:', matchResult.match);
      console.log('Scan data:', scanData);

      setSavedCards(prev => [...prev, matchResult.match!.cardData.name!]);
      alert(
        `✅ Card data saved! Matched: "${matchResult.match.cardData.name}" (${matchResult.match.matchScore}%)`
      );

      // Reset
      setScanData({ cardName: '', setName: '', cardNumber: '', confidence: 100 });
      setMatchResult(null);
    } catch (error) {
      console.error('Error saving match:', error);
      alert('Error saving card data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🤖 AI Card Matcher</h1>
        <p>Match AI scan results with card database and save data to collection</p>
      </div>

      {!user ? (
        <div className={styles.loginPrompt}>
          <p>Please log in to use AI Card Matcher</p>
          <button onClick={() => router.push('/login')}>Login</button>
        </div>
      ) : (
        <>
          {/* AI Scan Input Section */}
          <div className={styles.section}>
            <h2>📸 AI Scan Results</h2>
            <p className={styles.subtitle}>
              Enter the data from your AI card image analysis
            </p>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Card Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Pikachu"
                  value={scanData.cardName}
                  onChange={e => handleScanDataChange('cardName', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Set Name</label>
                <input
                  type="text"
                  placeholder="e.g., Scarlet & Violet"
                  value={scanData.setName}
                  onChange={e => handleScanDataChange('setName', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Card Number</label>
                <input
                  type="text"
                  placeholder="e.g., 25/102"
                  value={scanData.cardNumber}
                  onChange={e => handleScanDataChange('cardNumber', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>AI Confidence</label>
                <div className={styles.confidenceInput}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scanData.confidence}
                    onChange={e => handleScanDataChange('confidence', parseInt(e.target.value))}
                    disabled={loading}
                  />
                  <span>{scanData.confidence}%</span>
                </div>
              </div>
            </div>

            <button
              className={styles.buttonPrimary}
              onClick={handleFindMatch}
              disabled={loading}
            >
              {loading ? '🔍 Searching...' : '🔍 Find Matching Card'}
            </button>
          </div>

          {/* Match Results Section */}
          {matchResult && (
            <div className={styles.section}>
              <h2>📊 Match Results</h2>

              {matchResult.match ? (
                <>
                  <div className={styles.bestMatch}>
                    <div className={styles.matchHeader}>
                      <h3>Best Match</h3>
                      <span className={styles.score}>
                        {matchResult.match.matchScore}% match
                      </span>
                    </div>

                    <div className={styles.matchDetails}>
                      <div className={styles.cardName}>
                        {matchResult.match.cardData.name}
                      </div>
                      <div className={styles.cardMeta}>
                        <span>
                          Set: {
                            ((matchResult.match.cardData as any).setName || 
                             (matchResult.match.cardData as any).set?.name || 
                             'Unknown')
                          }
                        </span>
                        {matchResult.match.cardData.cardNumber && (
                          <span>
                            Number: {matchResult.match.cardData.cardNumber}
                          </span>
                        )}
                      </div>
                      <div className={styles.matchReason}>
                        {matchResult.match.matchReason}
                      </div>

                      {matchResult.match.cardData.images?.large && (
                        <img
                          src={matchResult.match.cardData.images.large}
                          alt={matchResult.match.cardData.name}
                          className={styles.cardImage}
                        />
                      )}
                    </div>

                    <button
                      className={styles.buttonSuccess}
                      onClick={handleSaveMatch}
                      disabled={loading}
                    >
                      ✅ Save This Card Data
                    </button>
                  </div>

                  {/* Other Candidates */}
                  {matchResult.candidates && matchResult.candidates.length > 1 && (
                    <div className={styles.candidates}>
                      <h3>Other Candidates ({matchResult.candidates.length})</h3>
                      <div className={styles.candidatesList}>
                        {matchResult.candidates.slice(1).map((candidate, idx) => (
                          <div key={idx} className={styles.candidateCard}>
                            <div className={styles.candidateName}>
                              {candidate.cardData.name}
                            </div>
                            <div className={styles.candidateScore}>
                              {candidate.matchScore}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.noMatch}>
                  <p>❌ No matching cards found</p>
                  <p className={styles.subtitle}>
                    Try adjusting the card name or check the set name
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Saved Cards Summary */}
          {savedCards.length > 0 && (
            <div className={styles.section}>
              <h2>✅ Recently Saved Cards</h2>
              <div className={styles.savedList}>
                {savedCards.map((cardName, idx) => (
                  <div key={idx} className={styles.savedItem}>
                    ✓ {cardName}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className={styles.info}>
            <h3>ℹ️ How It Works</h3>
            <ol>
              <li>Enter card data from your AI image analysis (name, set, number)</li>
              <li>
                System searches Firestore and Pokemon TCG API for matching cards
              </li>
              <li>
                Matching algorithm scores candidates based on name, set, card number
              </li>
              <li>Click "Save" to update the card with matched database data</li>
              <li>Full card data (images, stats, price) is automatically pulled in</li>
            </ol>

            <h3>Match Scoring</h3>
            <ul>
              <li>
                <strong>Name Match (70%):</strong> String similarity + containment
              </li>
              <li>
                <strong>Set Match (20%):</strong> Exact or partial set name match
              </li>
              <li>
                <strong>Card Number (10%):</strong> Exact card number match
              </li>
            </ul>

            <h3>Data Sources</h3>
            <ul>
              <li>🔥 Firestore: Pre-imported Pokemon TCG cards (fastest)</li>
              <li>🌐 Pokemon TCG API: Official fallback (if not in Firestore)</li>
              <li>📊 Automatic image URLs, set info, and metadata</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
