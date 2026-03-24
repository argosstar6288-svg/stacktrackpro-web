'use client';

import React, { useState } from 'react';
import { useCurrentUser } from '@/app/lib/useCurrentUser';
import { PRICING_TIERS } from '@/app/lib/stripe';
import { getPriceId } from '@/app/lib/stripe-config';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/lib/currency';
import styles from './subscription-plan-grid.module.css';

interface SubscriptionPlanGridProps {
  onPlanAction?: (planId: string, action: string) => void;
  layout?: 'grid' | 'list';
  selectedPlan?: string;
}

export default function SubscriptionPlanGrid({
  onPlanAction,
  layout = 'grid',
  selectedPlan,
}: SubscriptionPlanGridProps) {
  const { user } = useCurrentUser();
  const { currency } = useCurrency();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');

  const handlePlanSelection = async (planId: string) => {
    if (!user) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }

    setLoadingPlanId(planId);

    try {
      // Map plan ID to Stripe price ID
      let tierId = planId;
      let priceId = '';
      let billingPeriod: 'monthly' | 'yearly' | 'once' = 'monthly';

      if (planId === 'pro_monthly') {
        tierId = 'pro';
        billingPeriod = 'monthly';
        priceId = getPriceId('pro', 'monthly');
      } else if (planId === 'pro_yearly') {
        tierId = 'pro';
        billingPeriod = 'yearly';
        priceId = getPriceId('pro', 'yearly');
      } else if (planId === 'premium_monthly') {
        tierId = 'premium';
        billingPeriod = 'monthly';
        priceId = getPriceId('premium', 'monthly');
      } else if (planId === 'premium_yearly') {
        tierId = 'premium';
        billingPeriod = 'yearly';
        priceId = getPriceId('premium', 'yearly');
      } else if (planId === 'lifetime') {
        tierId = 'lifetime';
        billingPeriod = 'once';
        priceId = getPriceId('lifetime', 'once');
      }

      if (!priceId) {
        console.error('Price ID not configured for plan:', planId);
        alert('Price configuration missing. Please contact support.');
        setLoadingPlanId(null);
        return;
      }

      // Call API to create checkout session
      const response = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          tierId,
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
      alert(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const visiblePlans = billingPeriod === 'yearly'
    ? ['PRO_YEARLY', 'PREMIUM_YEARLY', 'LIFETIME']
    : ['PRO_MONTHLY', 'PREMIUM_MONTHLY', 'LIFETIME'];

  return (
    <div className={styles.container}>
      {/* Billing Period Toggle */}
      <div className={styles.toggleContainer}>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleButton} ${billingPeriod === 'monthly' ? styles.active : ''}`}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </button>
          <button
            className={`${styles.toggleButton} ${billingPeriod === 'yearly' ? styles.active : ''}`}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
            <span className={styles.saveBadge}>Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className={`${styles.planGrid} ${styles[layout]}`}>
        {visiblePlans.map((planKey) => {
          const plan = PRICING_TIERS[planKey];
          if (!plan) return null;

          const isSelected = selectedPlan === plan.id;
          const isLoading = loadingPlanId === plan.id;
          const isLifetime = plan.interval === 'once';
          const priceDisplay = formatCurrency(plan.price / 100, currency, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          return (
            <div
              key={plan.id}
              className={`${styles.card} ${isSelected ? styles.selected : ''} ${
                plan.popular ? styles.popular : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className={styles.popularBadge}>Most Popular</div>
              )}

              {/* Plan Header */}
              <div className={styles.header}>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.pricing}>
                  <span className={styles.price}>{priceDisplay}</span>
                  <span className={styles.period}>{isLifetime ? '/once' : `/${plan.interval === 'month' ? 'month' : 'year'}`}</span>
                </div>
                {isLifetime && (
                  <p className={styles.lifetimeNote}>One payment. Zero subscriptions. Ever.</p>
                )}
              </div>

              {/* Features List */}
              <ul className={styles.featuresList}>
                {plan.features.map((feature, index) => (
                  <li key={index} className={styles.feature}>
                    <span className={styles.checkmark}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                className={`${styles.ctaButton} ${isSelected ? styles.selected : ''}`}
                onClick={() => handlePlanSelection(plan.id)}
                disabled={isLoading}
              >
                {isLoading
                  ? 'Processing...'
                  : isSelected
                  ? 'Current Plan'
                  : isLifetime
                  ? 'Unlock Lifetime Access Now'
                  : 'Get Started'}
              </button>

              {isLifetime && (
                <p className={styles.limitedNote}>Limited offer - once it's gone, it's gone.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Free Tier Info */}
      <div className={styles.freeInfo}>
        <h4 className={styles.freeTitle}>Free Tier</h4>
        <ul className={styles.freeList}>
          <li>Basic collection tracking (cards/items)</li>
          <li>Manual item entry (no AI scan)</li>
          <li>Basic value tracking (no deep analytics)</li>
          <li>Limited collections</li>
          <li>View marketplace (no posting)</li>
          <li>Basic notifications</li>
        </ul>
        <p className={styles.trialNote}>
          Your first 30 days after signup include Premium features.
        </p>
        <p>
          <a href="/dashboard/collection" className={styles.link}>
            Start with Free Tier
          </a>
        </p>
      </div>
    </div>
  );
}
