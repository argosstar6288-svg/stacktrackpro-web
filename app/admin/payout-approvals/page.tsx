'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRouter } from 'next/navigation';
import {
  getPayoutRequests,
  approvePayoutRequest,
  rejectPayoutRequest,
  processStripeTransfer,
  getAdminPayoutStats,
  getAdminLedger,
  calculateSellerEarnings,
  getAllSellerBalances,
  type PayoutRequest,
  type AdminPayoutStats,
  type PayoutLedgerEntry,
} from '../../lib/revenueMetrics';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import styles from './payout-approvals.module.css';

export default function PayoutApprovalsPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const router = useRouter();

  const [stats, setStats] = useState<AdminPayoutStats | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutRequest[]>([]);
  const [allPayouts, setAllPayouts] = useState<PayoutRequest[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<PayoutRequest[]>([]);
  const [ledger, setLedger] = useState<PayoutLedgerEntry[]>([]);
  const [sellerBalances, setSellerBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'ledger' | 'stats' | 'sellers'>('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Verify admin access and load data
  useEffect(() => {
    if (!user || authLoading) return;

    const verifyAndLoad = async () => {
      try {
        setLoading(true);

        // Verify admin
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        // Load initial data
        const [statsData, pendingData, allData, ledgerData, sellersData] = await Promise.all([
          getAdminPayoutStats(),
          getPayoutRequests('pending'),
          getPayoutRequests(),
          getAdminLedger(),
          getAllSellerBalances(),
        ]);

        setStats(statsData);
        setPendingPayouts(pendingData);
        setAllPayouts(allData);
        setLedger(ledgerData);

        // Build seller balances map
        const balancesMap = new Map<string, number>();
        for (const seller of sellersData) {
          balancesMap.set(seller.id, seller.currentBalance);
        }
        setSellerBalances(balancesMap);

        // Set up live listener for payout requests
        const payoutsRef = collection(db, 'payoutRequests');
        const unsubscribePayouts = onSnapshot(
          query(payoutsRef, where('status', '!=', 'completed')),
          async (snapshot) => {
            const updatedPayouts = snapshot.docs.map(d => d.data() as PayoutRequest);
            const allPayoutsUpdate = snapshot.docs.map(d => d.data() as PayoutRequest);

            setPendingPayouts(updatedPayouts.filter(p => p.status === 'pending'));
            setAllPayouts(allPayoutsUpdate);

            // Update stats
            const newStats = await getAdminPayoutStats();
            setStats(newStats);
          }
        );

        setLoading(false);
        return unsubscribePayouts;
      } catch (err) {
        console.error('Error loading payout data:', err);
        setError('Failed to load payout data');
        setLoading(false);
      }
    };

    const unsubscribe = verifyAndLoad();
    return () => {
      unsubscribe?.then((unsub) => unsub?.());
    };
  }, [user, authLoading, router]);

  // Apply filters to payouts
  useEffect(() => {
    let filtered = [...allPayouts];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(p => {
        const pDate = typeof p.requestedAt === 'object' && 'toDate' in p.requestedAt
          ? (p.requestedAt as any).toDate()
          : new Date(p.requestedAt as any);
        return pDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => {
        const pDate = typeof p.requestedAt === 'object' && 'toDate' in p.requestedAt
          ? (p.requestedAt as any).toDate()
          : new Date(p.requestedAt as any);
        return pDate <= toDate;
      });
    }

    // Search by seller name or email
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.sellerName.toLowerCase().includes(q) ||
          p.sellerEmail.toLowerCase().includes(q)
      );
    }

    setFilteredPayouts(filtered);
  }, [allPayouts, statusFilter, dateFrom, dateTo, searchQuery]);

  // Handle approve
  const handleApprove = async (payoutId: string) => {
    try {
      setProcessingId(payoutId);
      setError(null);
      setSuccess(null);

      if (!user) return;

      await approvePayoutRequest(payoutId, user.uid);

      setSuccess('Payout request approved successfully');

      // Reload data
      const [pendingData, allData] = await Promise.all([
        getPayoutRequests('pending'),
        getPayoutRequests(),
      ]);
      setPendingPayouts(pendingData);
      setAllPayouts(allData);
    } catch (err: any) {
      setError(err.message || 'Failed to approve payout');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle reject
  const handleReject = async (payoutId: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingId(payoutId);
      setError(null);
      setSuccess(null);

      if (!user) return;

      await rejectPayoutRequest(payoutId, rejectionReason, user.uid);

      setSuccess('Payout request rejected');
      setRejectingId(null);
      setRejectionReason('');

      // Reload data
      const [pendingData, allData] = await Promise.all([
        getPayoutRequests('pending'),
        getPayoutRequests(),
      ]);
      setPendingPayouts(pendingData);
      setAllPayouts(allData);
    } catch (err: any) {
      setError(err.message || 'Failed to reject payout');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle process transfer
  const handleProcessTransfer = async (payoutId: string) => {
    try {
      setProcessingId(payoutId);
      setError(null);
      setSuccess(null);

      if (!user) return;

      // In production, get the seller's Stripe Connect ID
      const payout = allPayouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      await processStripeTransfer(payoutId, payout.payoutMethod === 'stripe_connect' ? 'acct_xxx' : '', user.uid);

      setSuccess('Payout transferred successfully');

      // Reload data
      const [allData, statsData] = await Promise.all([
        getPayoutRequests(),
        getAdminPayoutStats(),
      ]);
      setAllPayouts(allData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to process transfer');
    } finally {
      setProcessingId(null);
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Access denied. Please log in as admin.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Loading payout data...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Unable to load payout information.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Payout Approvals</h1>
          <p className={styles.subtitle}>Manage seller payout requests and transfers</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Payouts</div>
          <div className={styles.statValue} style={{ color: '#f59e0b' }}>
            {stats.pendingPayouts}
          </div>
          <div className={styles.statSubtext}>
            ${stats.pendingAmount.toFixed(2)} awaiting approval
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Platform Fees</div>
          <div className={styles.statValue} style={{ color: '#10b981' }}>
            ${stats.totalFeesCollected.toFixed(2)}
          </div>
          <div className={styles.statSubtext}>From completed auctions</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Paid Out</div>
          <div className={styles.statValue} style={{ color: '#3b82f6' }}>
            ${stats.totalPaidOut.toFixed(2)}
          </div>
          <div className={styles.statSubtext}>
            {stats.completedPayouts} completed transfers
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg Payout Amount</div>
          <div className={styles.statValue} style={{ color: '#8b5cf6' }}>
            ${stats.averagePayoutAmount.toFixed(2)}
          </div>
          <div className={styles.statSubtext}>Per request</div>
        </div>
      </div>

      {/* Messages */}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {/* Filter Controls */}
      <div className={styles.filterPanel}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Search Seller</label>
            <input
              type="text"
              placeholder="Name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
            className={styles.clearFiltersBtn}
          >
            Clear Filters
          </button>
        </div>

        <div className={styles.filterStats}>
          <span>Showing {filteredPayouts.length} of {allPayouts.length} requests</span>
          <span className={styles.totals}>
            Pending: ${stats?.pendingAmount.toFixed(2)} | 
            Paid Out: ${stats?.totalPaidOut.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'pending' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({stats.pendingPayouts})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Requests ({stats.payoutRequestsCount})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ledger' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          Ledger
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stats' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Pending Payouts Tab */}
        {activeTab === 'pending' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Pending Approval</h2>
            {filteredPayouts.filter(p => p.status === 'pending').length === 0 ? (
              <div className={styles.empty}>No pending payout requests</div>
            ) : (
              <div className={styles.payoutsList}>
                {filteredPayouts.filter(p => p.status === 'pending').map(payout => (
                  <div key={payout.id} className={styles.payoutCard}>
                    <div className={styles.payoutHeader}>
                      <div>
                        <div className={styles.sellerName}>{payout.sellerName}</div>
                        <div className={styles.sellerEmail}>{payout.sellerEmail}</div>
                        <div className={styles.sellerBalance}>
                          Balance: ${(sellerBalances.get(payout.sellerId) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className={styles.amount}>${payout.amount.toFixed(2)}</div>
                    </div>

                    <div className={styles.payoutDetails}>
                      <div>
                        <span className={styles.detailLabel}>Requested:</span>
                        {new Date(typeof payout.requestedAt === 'object' && 'toDate' in payout.requestedAt 
                          ? (payout.requestedAt as any).toDate() 
                          : payout.requestedAt as any).toLocaleDateString()}
                      </div>
                      <div>
                        <span className={styles.detailLabel}>Method:</span>
                        {payout.payoutMethod === 'stripe_connect' ? 'Stripe Connect' : 'Bank Transfer'}
                      </div>
                    </div>

                    <div className={styles.payoutActions}>
                      <button
                        onClick={() => handleApprove(payout.id)}
                        disabled={processingId === payout.id}
                        className={styles.approveBtn}
                      >
                        {processingId === payout.id ? 'Processing...' : '✓ Approve'}
                      </button>

                      {rejectingId === payout.id ? (
                        <div className={styles.rejectForm}>
                          <input
                            type="text"
                            placeholder="Rejection reason..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className={styles.rejectInput}
                          />
                          <button
                            onClick={() => handleReject(payout.id)}
                            disabled={processingId === payout.id}
                            className={styles.confirmRejectBtn}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason('');
                            }}
                            className={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(payout.id)}
                          className={styles.rejectBtn}
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Requests Tab */}
        {activeTab === 'all' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>All Payout Requests</h2>
            {filteredPayouts.length === 0 ? (
              <div className={styles.empty}>No payout requests</div>
            ) : (
              <div className={styles.payoutsList}>
                {filteredPayouts.map(payout => (
                  <div key={payout.id} className={styles.payoutCard}>
                    <div className={styles.payoutHeader}>
                      <div>
                        <div className={styles.sellerName}>{payout.sellerName}</div>
                        <div className={styles.sellerEmail}>{payout.sellerEmail}</div>
                        <div className={styles.sellerBalance}>
                          Balance: ${(sellerBalances.get(payout.sellerId) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className={styles.amountWithStatus}>
                        <div className={styles.amount}>${payout.amount.toFixed(2)}</div>
                        <div className={`${styles.status} ${styles[`status_${payout.status}`]}`}>
                          {payout.status}
                        </div>
                      </div>
                    </div>

                    <div className={styles.payoutDetails}>
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
                    </div>

                    {payout.status === 'approved' && (
                      <div className={styles.payoutActions}>
                        <button
                          onClick={() => handleProcessTransfer(payout.id)}
                          disabled={processingId === payout.id}
                          className={styles.processBtn}
                        >
                          {processingId === payout.id ? 'Processing...' : '💳 Process Transfer'}
                        </button>
                      </div>
                    )}
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
              <div className={styles.empty}>No transactions</div>
            ) : (
              <div className={styles.ledgerTable}>
                <div className={styles.ledgerHeader}>
                  <div className={styles.colSeller}>Seller</div>
                  <div className={styles.colType}>Type</div>
                  <div className={styles.colDate}>Date</div>
                  <div className={styles.colAmount}>Amount</div>
                </div>
                {ledger.slice(0, 50).map(entry => (
                  <div key={entry.id} className={styles.ledgerRow}>
                    <div className={styles.colSeller}>{entry.sellerName}</div>
                    <div className={styles.colType}>
                      {entry.transactionType.replace('_', ' ')}
                    </div>
                    <div className={styles.colDate}>
                      {new Date(typeof entry.createdAt === 'object' && 'toDate' in entry.createdAt 
                        ? (entry.createdAt as any).toDate() 
                        : entry.createdAt as any).toLocaleDateString()}
                    </div>
                    <div className={styles.colAmount}>
                      <span className={entry.amount > 0 ? styles.income : styles.expense}>
                        {entry.amount >= 0 ? '+' : '-'}${Math.abs(entry.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Payout Statistics</h2>
            <div className={styles.statsDetailGrid}>
              <div className={styles.statDetail}>
                <div className={styles.statDetailLabel}>Total Earnings Tracked</div>
                <div className={styles.statDetailValue}>
                  ${stats.totalEarningsTracked.toFixed(2)}
                </div>
              </div>
              <div className={styles.statDetail}>
                <div className={styles.statDetailLabel}>Total Fees Collected</div>
                <div className={styles.statDetailValue}>
                  ${stats.totalFeesCollected.toFixed(2)}
                </div>
              </div>
              <div className={styles.statDetail}>
                <div className={styles.statDetailLabel}>Processing Payouts</div>
                <div className={styles.statDetailValue}>{stats.processingPayouts}</div>
              </div>
              <div className={styles.statDetail}>
                <div className={styles.statDetailLabel}>Total Requests</div>
                <div className={styles.statDetailValue}>{stats.payoutRequestsCount}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
