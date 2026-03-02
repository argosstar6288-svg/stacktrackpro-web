/**
 * POST /api/admin/disputes/resolve
 * 
 * Allows admins to resolve disputes
 * Can approve buyer, approve seller, or suggest split
 */

'use server';

import { doc, updateDoc, getDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';

interface ResolveDisputeInput {
  disputeId: string;
  resolution: 'seller_approved' | 'buyer_approved' | 'split';
  notes: string;
}

export async function resolveDispute(input: ResolveDisputeInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify user is admin (you'll need to check this against admin list)
    // For now, we'll assume the backend handles this
    const disputeRef = doc(db, 'disputes', input.disputeId);
    const disputeSnap = await getDoc(disputeRef);

    if (!disputeSnap.exists()) {
      return { success: false, error: 'Dispute not found' };
    }

    const dispute = disputeSnap.data();

    // Get the auction
    const auctionRef = doc(db, 'auctions', dispute.auctionId);
    const auctionSnap = await getDoc(auctionRef);

    if (!auctionSnap.exists()) {
      return { success: false, error: 'Associated auction not found' };
    }

    const auctionData = auctionSnap.data();

    // Update dispute with resolution
    await updateDoc(disputeRef, {
      status: 'resolved',
      resolution: input.resolution,
      resolvedAt: Timestamp.now(),
      notes: input.notes,
      resolvedBy: user.uid,
    });

    // Update auction based on resolution
    let updatePayload: any = {
      'releaseHold.disputeResolved': true,
      'releaseHold.disputeResolution': input.resolution,
      'releaseHold.disputeResolvedAt': Timestamp.now(),
      disputeStatus: 'resolved',
    };

    if (input.resolution === 'buyer_approved') {
      // Refund buyer
      updatePayload['releaseHold.refundApproved'] = true;
      updatePayload.status = 'refund_pending';
    } else if (input.resolution === 'seller_approved') {
      // Release payout to seller
      updatePayload['releaseHold.releaseApproved'] = true;
      updatePayload.status = 'payout_pending';
    } else if (input.resolution === 'split') {
      // Split resolution (50-50)
      updatePayload['releaseHold.splitApproved'] = true;
      updatePayload.status = 'split_pending';
    }

    await updateDoc(auctionRef, updatePayload);

    return { success: true };
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve dispute',
    };
  }
}

export async function closeDispute(disputeId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const disputeRef = doc(db, 'disputes', disputeId);

    // Mark as closed without resolution
    await updateDoc(disputeRef, {
      status: 'closed',
      closedAt: Timestamp.now(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error closing dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close dispute',
    };
  }
}
