/**
 * Admin Disputes Dashboard
 * /dashboard/admin/disputes
 * 
 * Shows all open disputes that need admin review
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { resolveDispute, closeDispute } from '@/lib/admin-disputes';
import styles from './disputes.module.css';

interface Dispute {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  openedAt: Timestamp;
  reason: string;
  trackingNumber?: string | null;
  status: 'open' | 'under_review' | 'resolved';
  resolution?: 'seller_approved' | 'buyer_approved' | 'split' | null;
  resolvedAt?: Timestamp;
  notes?: string;
}

interface AuctionInfo {
  title: string;
  winningBidAmount: number;
  buyerName?: string;
  sellerName?: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [auctionInfo, setAuctionInfo] = useState<Record<string, AuctionInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState<'seller_approved' | 'buyer_approved' | 'split'>('buyer_approved');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const q = query(collection(db, 'disputes'), where('status', '==', 'open'));
        const snapshot = await getDocs(q);

        const disputeList: Dispute[] = [];
        const auctionIds = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          disputeList.push({
            id: doc.id,
            auctionId: data.auctionId,
            buyerId: data.buyerId,
            sellerId: data.sellerId,
            openedAt: data.openedAt,
            reason: data.reason,
            trackingNumber: data.trackingNumber,
            status: data.status,
            resolution: data.resolution,
          });
          auctionIds.add(data.auctionId);
        });

        // Fetch auction details
        const auctions: Record<string, AuctionInfo> = {};
        for (const auctionId of auctionIds) {
          const auctionRef = doc(db, 'auctions', auctionId);
          const auctionSnap = await getDoc(auctionRef);

          if (auctionSnap.exists()) {
            const auctionData = auctionSnap.data();
            auctions[auctionId] = {
              title: auctionData.title,
              winningBidAmount: auctionData.winningBidAmount,
              buyerName: auctionData.buyerName,
              sellerName: auctionData.sellerName,
            };
          }
        }

        setDisputes(disputeList);
        setAuctionInfo(auctions);
      } catch (error) {
        console.error('Error fetching disputes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDisputes();
  }, []);

  const handleResolveDispute = async () => {
    if (!selectedDispute) return;

    setProcessing(true);
    try {
      const result = await resolveDispute({
        disputeId: selectedDispute.id,
        resolution,
        notes,
      });

      if (result.success) {
        // Remove from list
        setDisputes(disputes.filter((d) => d.id !== selectedDispute.id));
        setSelectedDispute(null);
        setNotes('');
      } else {
        alert(result.error || 'Failed to resolve dispute');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseDispute = async () => {
    if (!selectedDispute) return;

    setProcessing(true);
    try {
      const result = await closeDispute(selectedDispute.id);

      if (result.success) {
        setDisputes(disputes.filter((d) => d.id !== selectedDispute.id));
        setSelectedDispute(null);
      } else {
        alert(result.error || 'Failed to close dispute');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <h1>Loading disputes...</h1>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>🚨 Open Disputes ({disputes.length})</h1>

      {disputes.length === 0 ? (
        <div className={styles.empty}>
          <p>No open disputes at this time.</p>
        </div>
      ) : (
        <div className={styles.disputeList}>
          {disputes.map((dispute) => {
            const auction = auctionInfo[dispute.auctionId];
            const openedDate = dispute.openedAt
              ? new Date(dispute.openedAt.seconds * 1000).toLocaleDateString()
              : 'Unknown';

            return (
              <div
                key={dispute.id}
                className={styles.disputeCard}
                onClick={() => setSelectedDispute(dispute)}
              >
                <div className={styles.header}>
                  <h3>{auction?.title || 'Unknown Auction'}</h3>
                  <span className={styles.amount}>
                    ${(auction?.winningBidAmount || 0).toFixed(2)}
                  </span>
                </div>

                <p className={styles.reason}>
                  <strong>Reason:</strong> {dispute.reason.substring(0, 100)}...
                </p>

                <div className={styles.meta}>
                  <span>📅 {openedDate}</span>
                  {dispute.trackingNumber && (
                    <span>📦 {dispute.trackingNumber}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDispute && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <button
              className={styles.closeBtn}
              onClick={() => setSelectedDispute(null)}
            >
              ✕
            </button>

            <h2>Dispute Details</h2>

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Auction:</span>
                <span>
                  {auctionInfo[selectedDispute.auctionId]?.title || 'Unknown'}
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>Amount:</span>
                <span>
                  $
                  {(auctionInfo[selectedDispute.auctionId]?.winningBidAmount || 0).toFixed(
                    2
                  )}
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>Opened:</span>
                <span>
                  {new Date(
                    selectedDispute.openedAt.seconds * 1000
                  ).toLocaleDateString()}
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>Reason:</span>
                <p>{selectedDispute.reason}</p>
              </div>

              {selectedDispute.trackingNumber && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>Tracking:</span>
                  <span>{selectedDispute.trackingNumber}</span>
                </div>
              )}
            </div>

            <div className={styles.resolution}>
              <h3>Resolution</h3>

              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    value="buyer_approved"
                    checked={resolution === 'buyer_approved'}
                    onChange={(e) =>
                      setResolution(e.target.value as typeof resolution)
                    }
                  />
                  Approve Buyer (Full Refund)
                </label>

                <label>
                  <input
                    type="radio"
                    value="seller_approved"
                    checked={resolution === 'seller_approved'}
                    onChange={(e) =>
                      setResolution(e.target.value as typeof resolution)
                    }
                  />
                  Approve Seller (Full Payout)
                </label>

                <label>
                  <input
                    type="radio"
                    value="split"
                    checked={resolution === 'split'}
                    onChange={(e) =>
                      setResolution(e.target.value as typeof resolution)
                    }
                  />
                  Split Resolution (50-50)
                </label>
              </div>

              <textarea
                className={styles.textarea}
                placeholder="Add notes about this dispute (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />

              <div className={styles.actions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => handleCloseDispute()}
                  disabled={processing}
                >
                  Close Without Resolution
                </button>

                <button
                  className={styles.resolveBtn}
                  onClick={() => handleResolveDispute()}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Resolve Dispute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
