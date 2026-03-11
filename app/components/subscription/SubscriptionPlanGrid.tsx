'use client';

import React, { useState } from 'react';
import { useCurrentUser } from '@/app/lib/useCurrentUser';
import { PRICING_TIERS, formatPrice, getAnnualSavings } from '@/app/lib/stripe';
import { getPriceId } from '@/app/lib/stripe-config';
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
    : ['PRO_MONTHLY', 'PREMIUM_MONTHLY'];

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
          const priceDisplay = formatPrice(plan.price, plan.currency);

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
                  {!isLifetime && (
                    <span className={styles.period}>/{plan.interval === 'month' ? 'month' : 'year'}</span>
                  )}
                </div>
                {isLifetime && (
                  <p className={styles.lifetimeNote}>one-time payment</p>
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
                {isLoading ? 'Processing...' : isSelected ? 'Current Plan' : 'Get Started'}
              </button>

              {/* Note */}
              {isLifetime && (
                <p className={styles.limitedNote}>
                  ⭐ Limited to 50 customers
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Free Tier Info */}
      <div className={styles.freeInfo}>
        <p>
          Want to try before committing?{' '}
          <a href="/dashboard/collection" className={styles.link}>
            Start with our free plan
          </a>
        </p>
      </div>
    </div>
  );
}
