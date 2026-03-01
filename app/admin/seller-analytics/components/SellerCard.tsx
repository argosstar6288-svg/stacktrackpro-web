'use client';

import React from 'react';
import styles from './SellerCard.module.css';

interface SellerCardProps {
  seller: {
    id: string;
    displayName: string;
    photoUrl?: string;
    gmv: number;
    salesCount: number;
    avgPrice: number;
    platformFees?: number;
    isFounder?: boolean;
    lastSaleAt?: any;
    joinedAt?: any;
  };
  rank: number;
  isTopThree?: boolean;
}

export default function SellerCard({ seller, rank, isTopThree = false }: SellerCardProps) {
  const rankColor = {
    1: '#f97316', // Gold
    2: '#8b5cf6', // Silver
    3: '#ec4899', // Bronze
  }[rank as 1 | 2 | 3] || '#6366f1'; // Indigo for others

  const rankLabel = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  }[rank as 1 | 2 | 3] || `#${rank}`;

  const avatar = seller.photoUrl || '';
  const initials = seller.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const lastSaleDate = seller.lastSaleAt
    ? new Date(seller.lastSaleAt.toDate?.() || seller.lastSaleAt).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric' }
      )
    : 'Never';

  return (
    <div
      className={`${styles.card} ${isTopThree ? styles.featured : ''}`}
      style={isTopThree ? { borderColor: rankColor } : {}}
    >
      <div className={styles.rankBadge} style={{ backgroundColor: rankColor }}>
        {rankLabel}
      </div>

      <div className={styles.content}>
        <div className={styles.avatarSection}>
          {avatar ? (
            <img src={avatar} alt={seller.displayName} className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>{initials}</div>
          )}
        </div>

        <div className={styles.infoSection}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{seller.displayName}</h3>
            {seller.isFounder && (
              <span className={styles.founderBadge} title="Founding Member">
                ⭐
              </span>
            )}
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>GMV</span>
              <span className={styles.metricValue}>
                ${(seller.gmv / 1000).toFixed(1)}k
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Sales</span>
              <span className={styles.metricValue}>{seller.salesCount}</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Avg Price</span>
              <span className={styles.metricValue}>
                ${seller.avgPrice.toFixed(0)}
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Fees (15%)</span>
              <span className={styles.metricValue}>
                ${((seller.platformFees || 0) / 1000).toFixed(1)}k
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
