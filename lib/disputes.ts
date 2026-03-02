/**
 * POST /api/disputes/open
 * 
 * Allows a buyer to open a dispute on an auction
 * Only valid during the 24-hour shipping review window
 */

'use server';

import { doc, updateDoc, getDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';

export async function openDispute(
  auctionId: string,
  reason: string
): Promise<{ success: boolean; error?: string; disputeId?: string }> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get auction
    const auctionRef = doc(db, 'auctions', auctionId);
    const auctionSnap = await getDoc(auctionRef);

    if (!auctionSnap.exists()) {
      return { success: false, error: 'Auction not found' };
    }

    const auctionData = auctionSnap.data();

    // Verify user is the buyer
    if (auctionData.highestBidderId !== user.uid) {
      return { success: false, error: 'Only the buyer can open a dispute' };
    }

    // Verify status is shipped_pending_release (24h window)
    if (auctionData.status !== 'shipped_pending_release') {
      return {
        success: false,
        error: 'Disputes can only be opened during the 24-hour review window after shipment',
      };
    }

    // Verify still within 24 hours
    if (auctionData.releaseHold?.releaseAt) {
      const releaseAt = new Date(auctionData.releaseHold.releaseAt.seconds * 1000);
      const now = new Date();
      const hoursSinceShip = (now.getTime() - releaseAt.getTime() + 24 * 60 * 60 * 1000) / (60 * 60 * 1000);

      if (hoursSinceShip >= 24) {
        return { success: false, error: 'Dispute window has closed (24 hours passed)' };
      }
    }

    // Create dispute record
    const dispute = {
      auctionId,
      buyerId: user.uid,
      sellerId: auctionData.sellerId,
      openedAt: Timestamp.now(),
      reason,
      trackingNumber: auctionData.shippingInfo?.trackingNumber || null,
      status: 'open',
      resolution: null,
      resolvedAt: null,
      notes: '',
    };

    const disputeRef = await addDoc(collection(db, 'disputes'), dispute);

    // Update auction to mark dispute as open
    await updateDoc(auctionRef, {
      'releaseHold.disputeOpened': true,
      'releaseHold.disputeOpenedAt': Timestamp.now(),
      disputeStatus: 'open',
    });

    return {
      success: true,
      disputeId: disputeRef.id,
    };
  } catch (error) {
    console.error('Error opening dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open dispute',
    };
  }
}

export interface DisputeData {
  auctionId: string;
  buyerId: string;
  sellerId: string;
  openedAt: any;
  reason: string;
  trackingNumber?: string | null;
  status: 'open' | 'under_review' | 'resolved';
  resolution?: 'seller_approved' | 'buyer_approved' | 'split' | null;
  resolvedAt?: any;
  notes?: string;
}
