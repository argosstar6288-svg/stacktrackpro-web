/**
 * Premium Scan Unlock Component
 * Shows locked premium card analysis data with unlock mechanism
 */

'use client';

import React, { useState } from 'react';
import { BuyCreditsModal } from './BuyCreditsModal';
import type { PremiumScanData } from '@/lib/premium-scan';
import styles from './premium-scan-unlock.module.css';

interface PremiumScanUnlockProps {
  cardName: string;
  basicData?: any;
  onUnlock: () => Promise<PremiumScanData | null>;
  cost?: number;
  canAfford: boolean;
  currentCredits: number;
}

export const PremiumScanUnlock: React.FC<PremiumScanUnlockProps> = ({
  cardName,
  basicData,
  onUnlock,
  cost = 1,
  canAfford,
  currentCredits,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [premiumData, setPremiumData] = useState<PremiumScanData | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!canAfford) {
      setShowBuyModal(true);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await onUnlock();

      if (data) {
        setPremiumData(data);
        setIsUnlocked(true);
      } else {
        setError('Failed to unlock premium data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnlocked && premiumData) {
    return <PremiumScanData data={premiumData} />;
  }

  return (
    <>
      <div className={styles.lockedSection}>
        <div className={styles.blurredContent}>
          <div className={styles.placeholder}>
            <p>🔍 Advanced Card Analysis</p>
            <p>Value estimates • Grading guidance • Market trends</p>
          </div>
        </div>

        <div className={styles.unlockOverlay}>
          <div className={styles.unlockContent}>
            <div className={styles.lockIcon}>🔒</div>

            <h3>Unlock Premium Analysis</h3>

            <p className={styles.description}>
              Get estimated value, PSA grade guidance, and recent sale comparisons for
              {' '}
              <strong>{cardName}</strong>
            </p>

            <div className={styles.costBadge}>
              <span className={styles.creditIcon}>💳</span>
              <span>{cost} Credit</span>
              <span className={styles.price}>${(cost * 0.40).toFixed(2)}</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.unlockBtn}
              onClick={handleUnlock}
              disabled={isLoading}
            >
              {isLoading && (
                <>
                  <span className={styles.spinner}>⟳</span>
                  {' '}
                  Analyzing...
                </>
              )}
              {!isLoading && canAfford && 'Use 1 Credit'}
              {!isLoading && !canAfford && `Buy Credits (${currentCredits} available)`}
            </button>

            {!canAfford && (
              <p className={styles.warning}>
                You have {currentCredits} credit{currentCredits !== 1 ? 's' : ''}.
                {' '}
                <button
                  className={styles.buyLink}
                  onClick={() => setShowBuyModal(true)}
                >
                  Buy more credits
                </button>
              </p>
            )}

            <p className={styles.note}>
              ✓ Premium analysis runs instantly
              <br />✓ No refunds if not satisfied (but we stand behind our data)
            </p>
          </div>
        </div>
      </div>

      <BuyCreditsModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        onSuccess={() => {
          setShowBuyModal(false);
          // Refresh credits from parent or trigger unlock
        }}
        reason="Not enough credits for premium scan. Buy more to unlock advanced analysis."
      />
    </>
  );
};

/**
 * Premium Data Display Component
 * Shows the unlocked premium scan results with animation
 */
interface PremiumScanDataProps {
  data: PremiumScanData;
}

const PremiumScanData: React.FC<PremiumScanDataProps> = ({ data }) => {
  return (
    <div className={`${styles.unlockedSection} ${styles.animated}`}>
      <div className={styles.dataGrid}>
        {/* Estimated Value */}
        <div className={styles.dataCard}>
          <div className={styles.cardLabel}>Estimated Raw Value</div>
          <div className={styles.cardValue}>
            ${data.estimatedRawValue.toFixed(2)}
          </div>
          <div className={styles.cardDetail}>Current market baseline</div>
        </div>

        {/* PSA Grade Estimate */}
        <div className={styles.dataCard}>
          <div className={styles.cardLabel}>PSA Grade Estimate</div>
          <div className={styles.cardValue}>
            {data.psaGradeEstimate.low} - {data.psaGradeEstimate.high}
          </div>
          <div className={styles.cardDetail}>Based on visible condition</div>
        </div>

        {/* Rarity */}
        <div className={styles.dataCard}>
          <div className={styles.cardLabel}>Rarity Level</div>
          <div className={styles.cardValue}>
            {data.rarityLevel.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div className={styles.cardDetail}>Collector demand indicator</div>
        </div>

        {/* Population */}
        {data.populationInsight && (
          <div className={styles.dataCard}>
            <div className={styles.cardLabel}>Population Insight</div>
            <div className={styles.cardValue}>
              {data.populationInsight.psa10Count}
              {' '}
              <span className={styles.small}>of</span>
              {' '}
              {data.populationInsight.totalGraded}
            </div>
            <div className={styles.cardDetail}>PSA 10s in circulation</div>
          </div>
        )}
      </div>

      {/* Recent Sale Averages */}
      <div className={styles.salesCard}>
        <div className={styles.cardLabel}>Recent Sale Averages</div>
        <div className={styles.salesGrid}>
          <div className={styles.saleItem}>
            <span>PSA 8:</span>
            <strong>${data.recentSaleAverages.psa8.toFixed(2)}</strong>
          </div>
          <div className={styles.saleItem}>
            <span>PSA 9:</span>
            <strong>${data.recentSaleAverages.psa9.toFixed(2)}</strong>
          </div>
          <div className={styles.saleItem}>
            <span>PSA 10:</span>
            <strong>${data.recentSaleAverages.psa10.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Condition Guidance */}
      <div className={styles.guidanceCard}>
        <div className={styles.cardLabel}>Condition Guidance</div>
        <p className={styles.guidance}>{data.conditionGuidance}</p>
      </div>
    </div>
  );
};
