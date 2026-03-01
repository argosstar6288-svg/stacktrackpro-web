/**
 * Custom hooks for tracking user interactions
 * Use these hooks in components to easily track user behavior
 */

import { useCallback } from 'react';
import { useCurrentUser } from './useCurrentUser';
import {
  recordBid,
  recordPurchase,
  recordView,
  recordFavorite,
} from './userAnalytics';

/**
 * Hook to track bid interactions
 */
export function useTrackBid() {
  const { user } = useCurrentUser();

  return useCallback(
    async (
      auctionId: string,
      itemName: string,
      category: string,
      bidAmount: number,
      currentPrice: number
    ) => {
      if (!user?.uid) return;

      try {
        await recordBid(
          user.uid,
          auctionId,
          itemName,
          category,
          bidAmount,
          currentPrice
        );
      } catch (error) {
        console.error('Error tracking bid:', error);
      }
    },
    [user?.uid]
  );
}

/**
 * Hook to track purchase interactions
 */
export function useTrackPurchase() {
  const { user } = useCurrentUser();

  return useCallback(
    async (
      auctionId: string,
      itemName: string,
      category: string,
      finalPrice: number,
      sellerRating?: number
    ) => {
      if (!user?.uid) return;

      try {
        await recordPurchase(
          user.uid,
          auctionId,
          itemName,
          category,
          finalPrice,
          sellerRating
        );
      } catch (error) {
        console.error('Error tracking purchase:', error);
      }
    },
    [user?.uid]
  );
}

/**
 * Hook to track view interactions
 */
export function useTrackView() {
  const { user } = useCurrentUser();

  return useCallback(
    async (
      auctionId: string,
      itemName: string,
      category: string,
      price: number,
      timeSpentSeconds?: number
    ) => {
      if (!user?.uid) return;

      try {
        await recordView(
          user.uid,
          auctionId,
          itemName,
          category,
          price,
          timeSpentSeconds
        );
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    },
    [user?.uid]
  );
}

/**
 * Hook to track favorite interactions
 */
export function useTrackFavorite() {
  const { user } = useCurrentUser();

  return useCallback(
    async (
      auctionId: string,
      itemName: string,
      category: string,
      price: number,
      favorited: boolean
    ) => {
      if (!user?.uid) return;

      try {
        await recordFavorite(
          user.uid,
          auctionId,
          itemName,
          category,
          price,
          favorited
        );
      } catch (error) {
        console.error('Error tracking favorite:', error);
      }
    },
    [user?.uid]
  );
}
