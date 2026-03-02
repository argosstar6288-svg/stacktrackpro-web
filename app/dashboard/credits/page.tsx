/**
 * Credits Purchase Page
 * /dashboard/credits
 * 
 * Allows Collector & Pro users to purchase credit packs.
 * Free users are redirected to upgrade page.
 */

'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { CREDIT_PACKS } from '@/lib/credits';
import { CreditBalance } from '@/components/CreditBalance';
import styles from './credits.module.css';

function CreditsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<string>('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/login');
      } else {
        setUser(currentUser);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Check payment result
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
    
    if (canceled === 'true') {
      setShowCanceled(true);
      setTimeout(() => setShowCanceled(false), 5000);
    }

    // Fetch user subscription tier
    const fetchUserTier = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const tier = userData?.subscription || 'free';
        
        setUserTier(tier);
        
        // Redirect free users to upgrade page
        if (tier === 'free' || tier === 'starter') {
          router.push('/dashboard/pricing?reason=credits');
          return;
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch user tier:', error);
        setLoading(false);
      }
    };

    fetchUserTier();
  }, [user, router, searchParams]);

  const handlePurchase = async (packId: string) => {
    if (!user) return;
    
    setPurchasing(packId);
    
    try {
      // Call checkout API
      const response = await fetch('/api/create-credit-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId,
          userId: user.uid,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Failed to start checkout. Please try again.');
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Buy Credits</h1>
        <p className={styles.subtitle}>
          Purchase credits to unlock premium AI features like advanced card scanning,
          market analysis, and grading predictions.
        </p>
        <div className={styles.balanceCard}>
          <CreditBalance size="large" showLabel={true} />
        </div>
      </div>

      {/* Success/Cancel Messages */}
      {showSuccess && (
        <div className={styles.alert} data-type="success">
          ✅ Purchase successful! Your credits have been added.
        </div>
      )}
      
      {showCanceled && (
        <div className={styles.alert} data-type="warning">
          ⚠️ Purchase canceled. No charges were made.
        </div>
      )}

      {/* Credit Packs */}
      <div className={styles.packs}>
        {CREDIT_PACKS.map((pack) => {
          // Calculate savings compared to base price ($0.50/credit)
          const basePrice = 0.50;
          const actualPricePerCredit = pack.price / pack.credits;
          const savingsPercent = pack.id === 'pack_10' ? 0 : Math.round((1 - actualPricePerCredit / basePrice) * 100);
          
          const isPurchasing = purchasing === pack.id;

          return (
            <div key={pack.id} className={styles.pack}>
              {savingsPercent > 0 && <div className={styles.badge}>Save {savingsPercent}%</div>}
              
              <div className={styles.packHeader}>
                <div className={styles.credits}>{pack.credits}</div>
                <div className={styles.creditsLabel}>Credits</div>
              </div>

              <div className={styles.packPrice}>
                <span className={styles.currency}>$</span>
                {pack.price.toFixed(2)}
                <span className={styles.priceLabel}>CAD</span>
              </div>

              <div className={styles.perCredit}>
                ${(pack.price / pack.credits).toFixed(2)} per credit
              </div>

              <button
                className={styles.buyButton}
                onClick={() => handlePurchase(pack.id)}
                disabled={isPurchasing}
              >
                {isPurchasing ? (
                  <>
                    <span className={styles.spinner}></span>
                    Processing...
                  </>
                ) : (
                  <>Buy Now</>
                )}
              </button>

              <div className={styles.features}>
                <div className={styles.feature}>✓ Never expires</div>
                <div className={styles.feature}>✓ Use anytime</div>
                <div className={styles.feature}>✓ All premium features</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Section */}
      <div className={styles.info}>
        <h2 className={styles.infoTitle}>How Credits Work</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.infoIcon}>🔍</div>
            <h3>Premium AI Scan</h3>
            <p>1 credit per scan</p>
            <p className={styles.infoDetail}>
              Get detailed card analysis including condition assessment,
              market value estimates, and grading predictions.
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoIcon}>📊</div>
            <h3>Market Analysis</h3>
            <p>2 credits (Coming Soon)</p>
            <p className={styles.infoDetail}>
              Deep dive into market trends, price history, and
              investment potential for specific cards.
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoIcon}>🎯</div>
            <h3>Grading Prediction</h3>
            <p>3 credits (Coming Soon)</p>
            <p className={styles.infoDetail}>
              AI-powered grading prediction based on card condition,
              centering, corners, edges, and surface analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className={styles.terms}>
        <h3>Terms & Conditions</h3>
        <ul>
          <li>Credits never expire and can be used anytime</li>
          <li>Credits are non-refundable once purchased</li>
          <li>Credits have no cash value and cannot be transferred</li>
          <li>Collector accounts receive 5 bonus credits monthly</li>
          <li>Pro accounts receive 15 bonus credits monthly</li>
          <li>All prices shown in CAD (Canadian Dollars)</li>
        </ul>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <CreditsPageContent />
    </Suspense>
  );
}
