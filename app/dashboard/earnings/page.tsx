/**
 * Seller Earnings Dashboard
 * /dashboard/earnings
 * 
 * Shows seller's current balance, pending payouts, and earnings history
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { getPayoutHoldDuration } from '@/lib/fees';
import styles from './earnings.module.css';

interface AuctionTransaction {
  id: string;
  title: string;
  winningBidAmount: number;
  saleDate: Timestamp;
  status: string;
  releaseAt?: Timestamp;
  platformFee: number;
}

export default function EarningsPage() {
  const { user } = useCurrentUser();
  const [transactions, setTransactions] = useState<AuctionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [stats, setStats] = useState({
    totalEarned: 0,
    currentBalance: 0,
    pending: 0,
    releasedCount: 0,
  });

  const holdDuration = getPayoutHoldDuration(subscriptionTier as any);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchSubscriptionTier = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSubscriptionTier(userData.subscriptionTier || 'free');
        }
      } catch (error) {
        console.error('Error fetching subscription tier:', error);
      }
    };

    fetchSubscriptionTier();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchEarnings = async () => {
      try {
        // Get all completed auctions by this seller
        const q = query(
          collection(db, 'auctions'),
          where('sellerId', '==', user.uid),
          where('status', 'in', [
            'shipped_pending_release',
            'payout_pending',
            'payout_completed',
            'refund_pending',
            'split_pending',
          ]),
          orderBy('saleDate', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);

        const txList: AuctionTransaction[] = [];
        let totalEarned = 0;
        let pending = 0;
        let currentBalance = 0;
        let releasedCount = 0;

        const now = new Date();

        snapshot.forEach((doc) => {
          const data = doc.data();
          const winningBid = data.winningBidAmount || 0;
          const platformFee = winningBid * (data.platformFeePercentage || 0.05);
          const earnedAmount = winningBid - platformFee;

          txList.push({
            id: doc.id,
            title: data.title,
            winningBidAmount: winningBid,
            saleDate: data.saleDate,
            status: data.status,
            releaseAt: data.releaseHold?.releaseAt,
            platformFee,
          });

          totalEarned += earnedAmount;

          if (data.status === 'shipped_pending_release') {
            pending += earnedAmount;
          } else if (data.status === 'payout_pending') {
            currentBalance += earnedAmount;
            releasedCount += 1;
          } else if (data.status === 'payout_completed') {
            releasedCount += 1;
          }
        });

        setTransactions(txList);
        setStats({
          totalEarned,
          currentBalance,
          pending,
          releasedCount,
        });
      } catch (error) {
        console.error('Error fetching earnings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [user?.uid]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const getTimeUntilRelease = (releaseAt?: Timestamp): string => {
    if (!releaseAt) return 'N/A';

    const releaseDate = new Date(releaseAt.seconds * 1000);
    const now = new Date();
    const diffMs = releaseDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'Ready to release';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading your earnings...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>💰 Earnings Dashboard</h1>
        {subscriptionTier === 'pro' || subscriptionTier === 'lifetime' ? (
          <div className={styles.badge}>
            ⭐ Pro Seller - {holdDuration}h Hold
          </div>
        ) : (
          <div className={styles.badge}>
            {holdDuration}h Hold
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💵</div>
          <div className={styles.statContent}>
            <h3>Total Earned</h3>
            <p className={styles.amount}>{formatCurrency(stats.totalEarned)}</p>
            <span className={styles.subtext}>All-time Platform Earnings</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statContent}>
            <h3>Pending</h3>
            <p className={styles.amount}>{formatCurrency(stats.pending)}</p>
            <span className={styles.subtext}>In {holdDuration}-hour hold</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statContent}>
            <h3>Available Payout</h3>
            <p className={styles.amount}>{formatCurrency(stats.currentBalance)}</p>
            <span className={styles.subtext}>Ready to payout</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <h3>Completed Sales</h3>
            <p className={styles.amount}>{stats.releasedCount}</p>
            <span className={styles.subtext}>Successfully released</span>
          </div>
        </div>
      </div>

      {/* Pro Benefits Info */}
      {subscriptionTier !== 'pro' && subscriptionTier !== 'lifetime' && (
        <div className={styles.proPromotion}>
          <h3>⭐ Upgrade to Pro</h3>
          <p>
            Cut your payout hold time in half! Pro sellers get <strong>12-hour holds</strong> instead of 24 hours.
          </p>
          <button className={styles.upgradeBtn}>Upgrade Now</button>
        </div>
      )}

      {/* Transaction History */}
      <div className={styles.section}>
        <h2>Recent Transactions</h2>

        {transactions.length === 0 ? (
          <div className={styles.empty}>
            <p>No recent transactions. Start selling to earn!</p>
          </div>
        ) : (
          <div className={styles.transactionList}>
            {transactions.map((tx) => {
              const earnedAmount = tx.winningBidAmount - tx.platformFee;
              const releaseTime = getTimeUntilRelease(tx.releaseAt);
              const statusColor = {
                shipped_pending_release: '#ff9800',
                payout_pending: '#4caf50',
                payout_completed: '#2196f3',
                refund_pending: '#f44336',
              }[tx.status as string] || '#999';

              return (
                <div key={tx.id} className={styles.transactionRow}>
                  <div className={styles.txInfo}>
                    <h4>{tx.title}</h4>
                    <p className={styles.txDate}>
                      {new Date(tx.saleDate.seconds * 1000).toLocaleDateString()}
                    </p>
                  </div>

                  <div className={styles.txStatus}>
                    <span
                      className={styles.statusBadge}
                      style={{ borderColor: statusColor, color: statusColor }}
                    >
                      {tx.status.replace(/_/g, ' ')}
                    </span>
                    {tx.status === 'shipped_pending_release' && (
                      <p className={styles.releaseTime}>Releases in {releaseTime}</p>
                    )}
                  </div>

                  <div className={styles.txAmount}>
                    <p className={styles.sold}>Sale: {formatCurrency(tx.winningBidAmount)}</p>
                    <p className={styles.fee}>
                      Fee: -{formatCurrency(tx.platformFee)}
                    </p>
                    <p className={styles.earned}>You earn: {formatCurrency(earnedAmount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payout Information */}
      <div className={styles.section}>
        <h2>How Payouts Work</h2>
        <div className={styles.infoBox}>
          <h4>✅ 1. Auction Ends</h4>
          <p>Buyer wins your auction and you receive payment.</p>

          <h4>📦 2. Shipping Window</h4>
          <p>
            You have up to 30 days to ship. Once you provide tracking,
            your payout enters a {holdDuration}-hour review period.
          </p>

          <h4>⏳ 3. Hold Period</h4>
          <p>
            During this time, we verify the shipment and handle any disputes.
            No fee is charged during the hold.
          </p>

          <h4>💰 4. Automatic Release</h4>
          <p>
            After the hold period expires (and no disputes), your funds
            automatically release to your bank account via Stripe.
          </p>

          <h4>🚨 5. Disputes</h4>
          <p>
            If the buyer opens a dispute, we'll contact you for resolution.
            Most disputes are resolved within 24-48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
