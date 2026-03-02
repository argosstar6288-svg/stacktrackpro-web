/**
 * Credit Balance Display Component
 * Shows user's current credit balance with styling
 */

'use client';

import React, { useEffect, useState } from 'react';
import { getUserCredits } from '@/lib/credits';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import styles from './credit-balance.module.css';

interface CreditBalanceProps {
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const CreditBalance: React.FC<CreditBalanceProps> = ({
  showLabel = true,
  size = 'medium',
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchCredits = async () => {
      const result = await getUserCredits(userId);
      setCredits(result.credits);
      setLoading(false);
    };

    fetchCredits();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (!userId || loading) return null;

  return (
    <div className={`${styles.container} ${styles[`size_${size}`]}`}>
      <span className={styles.icon}>💳</span>
      <span className={styles.amount}>{loading ? '...' : credits}</span>
      {showLabel && <span className={styles.label}>Credits</span>}
    </div>
  );
};
