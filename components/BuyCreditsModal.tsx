/**
 * Buy Credits Modal Component
 * Displays credit packs and handles purchases
 */

'use client';

import React, { useState } from 'react';
import { CREDIT_PACKS } from '@/lib/credits';
import styles from './buy-credits-modal.module.css';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (creditsAdded: number) => void;
  reason?: string; // Optional context (e.g., "Not enough credits for premium scan")
}

export const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reason,
}) => {
  const [selectedPack, setSelectedPack] = useState<string>(CREDIT_PACKS[0].id);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const pack = CREDIT_PACKS.find((p) => p.id === selectedPack);

  const handlePurchase = async () => {
    if (!pack) return;

    setProcessing(true);
    setError('');

    try {
      // TODO: Integrate with Stripe/payment processor
      // Call POST /api/credits/purchase with { packId, packName, credits, amount }
      
      // For now, simulate successful purchase
      setTimeout(() => {
        onSuccess?.(pack.credits);
        setProcessing(false);
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>

        <div className={styles.header}>
          <h2>💳 Buy Credits</h2>
          {reason && <p className={styles.reason}>{reason}</p>}
        </div>

        <div className={styles.packs}>
          {CREDIT_PACKS.map((p) => {
            const perCredit = (p.price / p.credits).toFixed(2);
            const savings = p.id !== CREDIT_PACKS[0].id
              ? Math.round(((1 - parseFloat(perCredit) / 0.5) * 100))
              : 0;

            return (
              <label
                key={p.id}
                className={`${styles.packCard} ${
                  selectedPack === p.id ? styles.selected : ''
                }`}
              >
                <input
                  type="radio"
                  name="pack"
                  value={p.id}
                  checked={selectedPack === p.id}
                  onChange={(e) => setSelectedPack(e.target.value)}
                />
                <div className={styles.packContent}>
                  <div className={styles.packTitle}>{p.credits} Credits</div>
                  <div className={styles.packPrice}>${p.price.toFixed(2)}</div>
                  <div className={styles.packPerCredit}>
                    ${perCredit} per credit
                  </div>
                  {savings > 0 && (
                    <div className={styles.savings}>Save {savings}%</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.terms}>
          <p>✓ Non-refundable | ✓ No expiration | ✓ No cash value</p>
        </div>

        <button
          className={styles.purchaseBtn}
          onClick={handlePurchase}
          disabled={processing || !pack}
        >
          {processing ? 'Processing...' : `Buy ${pack?.credits} Credits for $${pack?.price.toFixed(2)}`}
        </button>

        <p className={styles.info}>
          Secure payments processed by Stripe. Credits appear instantly.
        </p>
      </div>
    </div>
  );
};
