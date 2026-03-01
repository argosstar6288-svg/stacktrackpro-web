'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRouter } from 'next/navigation';
import {
  calculateSellerEarnings,
  createPayoutRequest,
  getSellerPayouts,
  getSellerLedger,
  type SellerEarnings,
  type PayoutRequest,
  type PayoutLedgerEntry,
} from '../../lib/revenueMetrics';
import styles from './payouts.module.css';

export default function SellerPayoutsPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const router = useRouter();

  const [earnings, setEarnings] = useState<SellerEarnings | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [ledger, setLedger] = useState<PayoutLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestAmount, setRequestAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'ledger'>('overview');

  // Load data
  useEffect(() => {
    if (!user || authLoading) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [earningsData, payoutData, ledgerData] = await Promise.all([
          calculateSellerEarnings(user.uid),
          getSellerPayouts(user.uid),
          getSellerLedger(user.uid),
        ]);

        setEarnings(earningsData);
        setPayouts(payoutData);
        setLedger(ledgerData);
      } catch (err) {
        console.error('Error loading payout data:', err);
        setError('Failed to load payout information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading]);

  // Handle payout request
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !earnings) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const amount = parseFloat(requestAmount);

      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const request = await createPayoutRequest(user.uid, amount, earnings.stripeConnectId);

      setSuccess(`Payout request created for $${amount.toFixed(2)}`);
      setRequestAmount('');

      // Reload data
      const [updatedEarnings, updatedPayouts] = await Promise.all([
        calculateSellerEarnings(user.uid),
        getSellerPayouts(user.uid),
      ]);

      setEarnings(updatedEarnings);
      setPayouts(updatedPayouts);
    } catch (err: any) {
      setError(err.message || 'Failed to create payout request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Please log in to view payouts.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Loading payout information...</div>
      </div>
    );
  }

  if (!earnings) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Unable to load payout information.</div>
      </div>
    );
  }

  // Payout statistics
  const stats = [
    {
      label: 'Available Balance',
      value: `$${earnings.currentBalance.toFixed(2)}`,
      color: '#10b981',
      subtext: 'Ready to withdraw',
    },
    {
      label: 'Pending Earnings',
      value: `$${earnings.pendingEarnings.toFixed(2)}`,
      color: '#f59e0b',
      subtext: 'Awaiting approval',
    },
    {
      label: 'All-Time Earned',
      value: `$${earnings.totalEarned.toFixed(2)}`,
      color: '#3b82f6',
      subtext: 'Before platform fees',
    },
    {
      label: 'Total Paid Out',
      value: `$${earnings.allTimePaid.toFixed(2)}`,
      color: '#8b5cf6',
      subtext: 'Successfully transferred',
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Seller Payouts</h1>
          <p className={styles.subtitle}>Manage your earnings and request withdrawals</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        {stats.map((stat, idx) => (
          <div key={idx} className={styles.statCard}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statValue} style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className={styles.statSubtext}>{stat.subtext}</div>
          </div>
        ))}
      </div>

      {/* Error/Success Messages */}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {/* Payout Request Form */}
      {earnings.nextPayoutEligible ? (
        <div className={styles.requestSection}>
          <h2 className={styles.sectionTitle}>Request Payout</h2>
          <form onSubmit={handleRequestPayout} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="amount" className={styles.label}>
                Amount to Withdraw
              </label>
              <div className={styles.inputContainer}>
                <span className={styles.currency}>$</span>
                <input
                  type="number"
                  id="amount"
                  min="100"
                  step="0.01"
                  max={earnings.currentBalance}
                  value={requestAmount}
                  onChange={e => setRequestAmount(e.target.value)}
                  placeholder="1000.00"
                  className={styles.input}
                  disabled={submitting}
                />
              </div>
              <div className={styles.helper}>
                Minimum $100 • Maximum ${earnings.currentBalance.toFixed(2)}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !requestAmount}
              className={styles.submitBtn}
            >
              {submitting ? 'Processing...' : 'Request Payout'}
            </button>
          </form>
        </div>
      ) : (
        <div className={styles.minAmount}>
          <div className={styles.minIcon}>💰</div>
          <h3>Minimum Amount Required</h3>
          <p>
            You need at least $100 available to request a payout.
            <br />
            Current balance: ${earnings.currentBalance.toFixed(2)}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'requests' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Payout Requests ({payouts.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ledger' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          Transaction Ledger
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Earnings Information</h2>
            <div className={styles.infoGrid}>
              <div className={styles.infoCard}>
                <div className={styles.infoLabel}>Platform Fees Paid</div>
                <div className={styles.infoValue}>
                  ${earnings.totalFeesPaid.toFixed(2)}
                </div>
                <div className={styles.infoHelper}>15% of total earnings</div>
              </div>
              <div className={styles.infoCard}>
                <div className={styles.infoLabel}>Payment Method</div>
                <div className={styles.infoValue}>
                  {earnings.stripeConnectId ? '✓ Connected' : '⚠ Not Set'}
                </div>
                <div className={styles.infoHelper}>Stripe Connect account</div>
              </div>
              <div className={styles.infoCard}>
                <div className={styles.infoLabel}>Last Payout</div>
                <div className={styles.infoValue}>
                  {earnings.lastPayoutDate
                    ? new Date(typeof earnings.lastPayoutDate === 'object' && 'toDate' in earnings.lastPayoutDate 
                        ? (earnings.lastPayoutDate as any).toDate() 
                        : earnings.lastPayoutDate as any).toLocaleDateString()
                    : 'Never'}
                </div>
                <div className={styles.infoHelper}>Most recent</div>
              </div>
            </div>
          </div>
        )}

        {/* Payout Requests Tab */}
        {activeTab === 'requests' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Payout Requests</h2>
            {payouts.length === 0 ? (
              <div className={styles.empty}>No payout requests yet</div>
            ) : (
              <div className={styles.requestsList}>
                {payouts.map(payout => (
                  <div key={payout.id} className={styles.requestCard}>
                    <div className={styles.requestHeader}>
                      <div className={styles.requestAmount}>
                        ${payout.amount.toFixed(2)}
                      </div>
                      <div
                        className={`${styles.requestStatus} ${styles[`status_${payout.status}`]}`}
                      >
                        {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </div>
                    </div>
                    <div className={styles.requestDetails}>
                      <div>
                        <span className={styles.detailLabel}>Requested:</span>
                        {new Date(typeof payout.requestedAt === 'object' && 'toDate' in payout.requestedAt 
                          ? (payout.requestedAt as any).toDate() 
                          : payout.requestedAt as any).toLocaleDateString()}
                      </div>
                      {payout.approvedAt && (
                        <div>
                          <span className={styles.detailLabel}>Approved:</span>
                          {new Date(typeof payout.approvedAt === 'object' && 'toDate' in payout.approvedAt 
                            ? (payout.approvedAt as any).toDate() 
                            : payout.approvedAt as any).toLocaleDateString()}
                        </div>
                      )}
                      {payout.transferredAt && (
                        <div>
                          <span className={styles.detailLabel}>Transferred:</span>
                          {new Date(typeof payout.transferredAt === 'object' && 'toDate' in payout.transferredAt 
                            ? (payout.transferredAt as any).toDate() 
                            : payout.transferredAt as any).toLocaleDateString()}
                        </div>
                      )}
                      {payout.rejectionReason && (
                        <div className={styles.rejectionReason}>
                          <span className={styles.detailLabel}>Reason:</span>
                          {payout.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Transaction Ledger</h2>
            {ledger.length === 0 ? (
              <div className={styles.empty}>No transactions yet</div>
            ) : (
              <div className={styles.ledgerTable}>
                <div className={styles.ledgerHeader}>
                  <div className={styles.colType}>Type</div>
                  <div className={styles.colDate}>Date</div>
                  <div className={styles.colAmount}>Amount</div>
                  <div className={styles.colBalance}>Balance</div>
                </div>
                {ledger.map(entry => (
                  <div key={entry.id} className={styles.ledgerRow}>
                    <div className={styles.colType}>
                      <span className={styles.txType}>
                        {entry.transactionType.replace('_', ' ')}
                      </span>
                    </div>
                    <div className={styles.colDate}>
                      {new Date(typeof entry.createdAt === 'object' && 'toDate' in entry.createdAt 
                        ? (entry.createdAt as any).toDate() 
                        : entry.createdAt as any).toLocaleDateString()}
                    </div>
                    <div className={styles.colAmount}>
                      <span className={entry.amount > 0 ? styles.income : styles.expense}>
                        {entry.amount > 0 ? '+' : '-'}${Math.abs(entry.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.colBalance}>
                      ${entry.balance.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
