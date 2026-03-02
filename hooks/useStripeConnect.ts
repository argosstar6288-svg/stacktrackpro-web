/**
 * useStripeConnect Hook
 * 
 * Manages Stripe Connect account setup for sellers
 * Provides status checking and onboarding flow control
 */

'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '../lib/useCurrentUser';
import { useRouter } from 'next/navigation';

interface StripeConnectStatus {
  hasAccount: boolean;
  isVerified: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  stripeAccountId?: string;
  loading: boolean;
  error: string | null;
}

export function useStripeConnect() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [status, setStatus] = useState<StripeConnectStatus>({
    hasAccount: false,
    isVerified: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    requirements: [],
    loading: true,
    error: null,
  });

  // Check account status on mount and when user changes
  useEffect(() => {
    if (!user || userLoading) return;

    const checkStatus = async () => {
      try {
        const idToken = await user.getIdToken();

        const response = await fetch('/api/stripe/account-status', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();

        setStatus({
          hasAccount: data.hasAccount,
          isVerified: data.isVerified || false,
          chargesEnabled: data.chargesEnabled || false,
          payoutsEnabled: data.payoutsEnabled || false,
          requirements: data.requirements || [],
          stripeAccountId: data.id,
          loading: false,
          error: null,
        });
      } catch (error) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    checkStatus();
  }, [user, userLoading]);

  /**
   * Create a new Stripe Connect account for this user
   */
  const createAccount = async () => {
    if (!user) return;

    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      const idToken = await user.getIdToken();

      const response = await fetch('/api/stripe/create-connect-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create Stripe Connect account');
      }

      const data = await response.json();

      setStatus((prev) => ({
        ...prev,
        hasAccount: true,
        stripeAccountId: data.stripeAccountId,
        loading: false,
      }));

      return data.stripeAccountId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
      throw error;
    }
  };

  /**
   * Get onboarding link and redirect user
   */
  const startOnboarding = async () => {
    if (!user) return;

    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      const idToken = await user.getIdToken();

      const response = await fetch('/api/stripe/onboarding-link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get onboarding link');
      }

      const data = await response.json();

      // Redirect to Stripe onboarding
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
    }
  };

  /**
   * Check if seller can currently sell
   * Must have verified Stripe Connect account with payouts enabled
   */
  const canSell = (): boolean => {
    return status.hasAccount && status.isVerified && status.payoutsEnabled;
  };

  return {
    ...status,
    createAccount,
    startOnboarding,
    canSell,
  };
}
