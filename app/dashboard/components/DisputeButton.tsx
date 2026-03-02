/**
 * DisputeButton Component
 * 
 * Allows buyers to open a dispute during the 24-hour shipping review window
 * Only appears when:
 * - User is the buyer
 * - Auction status is 'shipped_pending_release'
 * - Still within 24-hour window
 */

'use client';

import React, { useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { openDispute } from '@/lib/disputes';
import styles from './dispute-button.module.css';

interface DisputeButtonProps {
  auctionId: string;
  buyerId: string;
  status: string;
  releaseAt?: number; // seconds timestamp
  isDisputeOpen?: boolean;
}

export const DisputeButton: React.FC<DisputeButtonProps> = ({
  auctionId,
  buyerId,
  status,
  releaseAt,
  isDisputeOpen,
}) => {
  const { user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Only show if user is buyer, status is correct, and not already disputed
  if (!user || user.uid !== buyerId || status !== 'shipped_pending_release' || isDisputeOpen) {
    return null;
  }

  // Check if still within 24 hours
  if (releaseAt) {
    const now = Math.floor(Date.now() / 1000);
    if (now >= releaseAt) {
      return null; // Outside window
    }
  }

  const handleOpenDispute = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the dispute');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await openDispute(auctionId, reason);

      if (result.success) {
        setSuccessMessage('Dispute opened. Our team will review within 24 hours.');
        setReason('');
        setIsOpen(false);
        // Refresh or update parent component
      } else {
        setError(result.error || 'Failed to open dispute');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {!isOpen ? (
        <button
          className={styles.button}
          onClick={() => setIsOpen(true)}
          title="Open a dispute if the item didn't arrive or is not as described"
        >
          🚨 Open Dispute
        </button>
      ) : (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Open a Dispute</h3>
            <p>Please describe why you're opening this dispute:</p>

            <textarea
              className={styles.textarea}
              placeholder="e.g., Item not arrived, item not as described, communication issues, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
            />

            {error && <div className={styles.error}>{error}</div>}
            {successMessage && <div className={styles.success}>{successMessage}</div>}

            <div className={styles.actions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setIsOpen(false);
                  setReason('');
                  setError('');
                }}
              >
                Cancel
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleOpenDispute}
                disabled={isLoading}
              >
                {isLoading ? 'Opening...' : 'Open Dispute'}
              </button>
            </div>

            <p className={styles.info}>
              ⏰ You have 24 hours from the last shipping update to open a dispute.
              <br />
              Once opened, our team will review within 24 hours.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
