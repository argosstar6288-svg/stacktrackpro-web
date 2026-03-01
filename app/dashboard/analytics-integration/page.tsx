'use client';

import styles from './integration.module.css';

export default function IntegrationGuidePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Analytics Integration Guide</h1>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>📊 System Overview</h2>
        <p>
          The User Analytics system tracks all user interactions and builds comprehensive preference profiles. This enables:
        </p>
        <ul>
          <li>✅ Personalized recommendations</li>
          <li>✅ Buyer segmentation (whale, regular, casual, new)</li>
          <li>✅ Category affinity analysis</li>
          <li>✅ Win rate and bidding pattern detection</li>
          <li>✅ Engagement scoring</li>
          <li>✅ Actionable insights for engagement</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>🎯 Tracked Interactions</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>🏷️ Bids</h3>
            <code>recordBid(userId, auctionId, itemName, category, bidAmount, currentPrice)</code>
            <p>Track when users place bids. Enables win rate calculation and bidding pattern analysis.</p>
          </div>
          <div className={styles.card}>
            <h3>💳 Purchases</h3>
            <code>recordPurchase(userId, auctionId, itemName, category, finalPrice, sellerRating)</code>
            <p>Track completed purchases. Used for spending analysis and buyer segmentation.</p>
          </div>
          <div className={styles.card}>
            <h3>👁️ Views</h3>
            <code>recordView(userId, auctionId, itemName, category, price, timeSpentSeconds)</code>
            <p>Track item views. Enables interest prediction and engagement tracking.</p>
          </div>
          <div className={styles.card}>
            <h3>❤️ Favorites</h3>
            <code>recordFavorite(userId, auctionId, itemName, category, price, favorited)</code>
            <p>Track favorites/saves. Indicates strong intent to purchase.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>💻 Implementation Examples</h2>

        <div className={styles.example}>
          <h3 className={styles.heading3}>1. Track a Bid (in a Bidding Component)</h3>
          <pre className={styles.code}>{`import { useTrackBid } from '@/lib/useTrackInteractions';

export function BiddingComponent() {
  const trackBid = useTrackBid();

  const handlePlaceBid = async (bidAmount: number) => {
    // Place the bid
    await submitBid(bidAmount);

    // Track the interaction
    await trackBid(
      auctionId,
      'Pokemon Card - Charizard Base Set',
      'Trading Cards',
      bidAmount,
      currentPrice
    );
  };

  return <button onClick={() => handlePlaceBid(150)}>Place Bid</button>;
}`}</pre>
        </div>

        <div className={styles.example}>
          <h3 className={styles.heading3}>2. Track a Purchase (in Checkout)</h3>
          <pre className={styles.code}>{`import { useTrackPurchase } from '@/lib/useTrackInteractions';

export function CheckoutComponent() {
  const trackPurchase = useTrackPurchase();

  const handleConfirmPurchase = async () => {
    await completeTransaction();

    await trackPurchase(
      auctionId,
      'Pokemon Card - Charizard Base Set',
      'Trading Cards',
      1200,
      4.8 // seller rating
    );

    showSuccessMessage();
  };

  return <button onClick={handleConfirmPurchase}>Confirm Purchase</button>;
}`}</pre>
        </div>

        <div className={styles.example}>
          <h3 className={styles.heading3}>3. Track Item Views (in Product Details)</h3>
          <pre className={styles.code}>{`import { useTrackView } from '@/lib/useTrackInteractions';
import { useEffect, useRef } from 'react';

export function ItemDetailsPage() {
  const trackView = useTrackView();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleUnload = async () => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      await trackView(
        auctionId,
        item.name,
        item.category,
        item.price,
        timeSpent
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return <div>{/* item details */}</div>;
}`}</pre>
        </div>

        <div className={styles.example}>
          <h3 className={styles.heading3}>4. Track Favorites (in Wishlist Button)</h3>
          <pre className={styles.code}>{`import { useTrackFavorite } from '@/lib/useTrackInteractions';
import { useState } from 'react';

export function WishlistButton() {
  const trackFavorite = useTrackFavorite();
  const [isFavorited, setIsFavorited] = useState(false);

  const handleToggleFavorite = async () => {
    const newState = !isFavorited;
    setIsFavorited(newState);

    await trackFavorite(
      auctionId,
      item.name,
      item.category,
      item.price,
      newState
    );
  };

  return (
    <button onClick={handleToggleFavorite}>
      {isFavorited ? '❤️' : '🤍'} Add to Wishlist
    </button>
  );
}`}</pre>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>📈 Accessing User Profile Data</h2>
        <div className={styles.example}>
          <h3>Get Complete User Preference Profile</h3>
          <pre className={styles.code}>{`import { getUserPreferenceProfile } from '@/lib/userAnalytics';

// In a dashboard or admin page
const profile = await getUserPreferenceProfile(userId);

// Access profile data:
console.log(profile.buyerSegment);        // 'whale', 'regular', 'casual', 'new'
console.log(profile.bidPattern);          // 'aggressive', 'moderate', 'conservative'
console.log(profile.engagementScore);     // 0-100
console.log(profile.topCategories);       // Array of categories with affinity scores
console.log(profile.preferredPriceRange); // { min, max, avg }
console.log(profile.winRate);             // 0-100
console.log(profile.totalSpent);          // Total purchase amount`}</pre>
        </div>

        <div className={styles.example}>
          <h3>Get Interaction History</h3>
          <pre className={styles.code}>{`import { getInteractionHistory } from '@/lib/userAnalytics';

// Get all interactions (last 50)
const allInteractions = await getInteractionHistory(userId);

// Get only bids
const bids = await getInteractionHistory(userId, 'bid', 50);

// Get only purchases
const purchases = await getInteractionHistory(userId, 'purchase', 50);`}</pre>
        </div>

        <div className={styles.example}>
          <h3>Get Actionable Insights</h3>
          <pre className={styles.code}>{`import { getUserAnalyticsInsights } from '@/lib/userAnalytics';

const insights = await getUserAnalyticsInsights(userId);

insights.forEach(insight => {
  console.log(insight.insight);           // Human-readable insight
  console.log(insight.recommendedAction); // Action to take
});`}</pre>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>🎯 Buyer Segments</h2>
        <div className={styles.grid}>
          <div className={`${styles.card} ${styles.whale}`}>
            <h3 className={styles.heading3}>🐋 Whale</h3>
            <p>High spenders (&gt;$5000), consistent engagement</p>
            <p className={styles.action}>→ VIP status, concierge service, early access</p>
          </div>
          <div className={`${styles.card} ${styles.regular}`}>
            <h3 className={styles.heading3}>👥 Regular</h3>
            <p>Active buyers ($1000-$5000), steady participation</p>
            <p className={styles.action}>→ Loyalty rewards, frequent recommendations</p>
          </div>
          <div className={`${styles.card} ${styles.casual}`}>
            <h3 className={styles.heading3}>🎯 Casual</h3>
            <p>Sporadic buyers ($100-$1000), occasional bidding</p>
            <p className={styles.action}>→ Incentive offers, engagement campaigns</p>
          </div>
          <div className={`${styles.card} ${styles.new}`}>
            <h3 className={styles.heading3}>🆕 New</h3>
            <p>Limited history (&lt;$100), learning phase</p>
            <p className={styles.action}>→ Onboarding guides, first-purchase bonus</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>📊 Where to View Analytics</h2>
        <div className={styles.cardList}>
          <div className={styles.listCard}>
            <h3 className={styles.heading3}>/admin/user-analytics</h3>
            <p>Comprehensive user behavior dashboard with all metrics and insights</p>
          </div>
          <div className={styles.listCard}>
            <h3 className={styles.heading3}>/dashboard/buyer-recommendations</h3>
            <p>Uses preference profiles to show personalized items</p>
          </div>
          <div className={styles.listCard}>
            <h3 className={styles.heading3}>/dashboard/discover</h3>
            <p>4-section discovery feed powered by interaction data</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>🔧 Available Functions Reference</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
              <th>Returns</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.code}>recordBid()</td>
              <td>Track a bid interaction</td>
              <td>interaction ID (string)</td>
            </tr>
            <tr>
              <td className={styles.code}>recordPurchase()</td>
              <td>Track a purchase</td>
              <td>interaction ID (string)</td>
            </tr>
            <tr>
              <td className={styles.code}>recordView()</td>
              <td>Track an item view</td>
              <td>interaction ID (string)</td>
            </tr>
            <tr>
              <td className={styles.code}>recordFavorite()</td>
              <td>Track a favorite action</td>
              <td>interaction ID (string)</td>
            </tr>
            <tr>
              <td className={styles.code}>getUserPreferenceProfile()</td>
              <td>Get complete preference profile</td>
              <td>UserPreferenceProfile object</td>
            </tr>
            <tr>
              <td className={styles.code}>getInteractionHistory()</td>
              <td>Get user's interaction history</td>
              <td>UserInteraction[] array</td>
            </tr>
            <tr>
              <td className={styles.code}>getUserAnalyticsInsights()</td>
              <td>Get actionable insights</td>
              <td>UserAnalyticsInsight[] array</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>💡 Pro Tips</h2>
        <ul className={styles.tipsList}>
          <li>
            <strong>Track views at the right time:</strong> Track item views when users leave the page or close the browser to capture actual time spent
          </li>
          <li>
            <strong>Include metadata:</strong> Pass additional context in the metadata parameter for deeper insights
          </li>
          <li>
            <strong>Use profiles in recommendations:</strong> Check buyerSegment and topCategories before showing items
          </li>
          <li>
            <strong>Monitor engagement scores:</strong> Users with dropping engagement scores are at churn risk
          </li>
          <li>
            <strong>Segment by behavior:</strong> Create different experiences for aggressive vs conservative bidders
          </li>
          <li>
            <strong>Time-based actions:</strong> Use lastActiveAt to trigger re-engagement campaigns
          </li>
        </ul>
      </section>
    </div>
  );
}
