'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { getUserPreferenceProfile, getInteractionHistory, getUserAnalyticsInsights, UserPreferenceProfile, UserInteraction, UserAnalyticsInsight } from '@/lib/userAnalytics';
import styles from './analytics.module.css';

export default function UserAnalyticsPage() {
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [insights, setInsights] = useState<UserAnalyticsInsight[]>([]);
  const [selectedType, setSelectedType] = useState<'bid' | 'purchase' | 'view' | 'favorite' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    async function loadData() {
      try {
        setLoading(true);
        const [profileData, interactionData, insightsData] = await Promise.all([
          getUserPreferenceProfile(user.uid),
          getInteractionHistory(user.uid),
          getUserAnalyticsInsights(user.uid),
        ]);

        setProfile(profileData);
        setInteractions(interactionData);
        setInsights(insightsData);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  const handleFilterByType = async (type: 'bid' | 'purchase' | 'view' | 'favorite') => {
    if (!user?.uid) return;
    setSelectedType(type);
    const data = await getInteractionHistory(user.uid, type);
    setInteractions(data);
  };

  const handleShowAll = async () => {
    if (!user?.uid) return;
    setSelectedType(null);
    const data = await getInteractionHistory(user.uid);
    setInteractions(data);
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading analytics...</div></div>;
  }

  if (!profile) {
    return <div className={styles.container}><div className={styles.loading}>No profile data available</div></div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Analytics Dashboard</h1>

      {/* Key Metrics Overview */}
      <h2 className={styles.subtitle}>Key Metrics Overview</h2>
      <section className={styles.metricsOverview}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Interactions</div>
          <div className={styles.metricValue}>{profile.totalInteractions}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Bids</div>
          <div className={styles.metricValue}>{profile.totalBids}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Purchases</div>
          <div className={styles.metricValue}>{profile.totalPurchases}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Spent</div>
          <div className={styles.metricValue}>${profile.totalSpent}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Win Rate</div>
          <div className={styles.metricValue}>{profile.winRate}%</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Engagement</div>
          <div className={styles.metricValue}>{profile.engagementScore}/100</div>
        </div>
      </section>

      {/* Buyer Segment & Classification */}
      <h2 className={styles.subtitle}>Buyer Segment & Classification</h2>
      <section className={styles.segmentSection}>
        <div className={styles.segmentCard}>
          <h3>Buyer Segment</h3>
          <div className={`${styles.segment} ${styles[profile.buyerSegment]}`}>
            {profile.buyerSegment.toUpperCase()}
          </div>
          <p className={styles.segmentDesc}>
            {profile.buyerSegment === 'whale' && 'Premium buyer - High spending, consistent engagement'}
            {profile.buyerSegment === 'regular' && 'Active buyer - Regular purchases and bidding'}
            {profile.buyerSegment === 'casual' && 'Occasional buyer - Sporadic engagement'}
            {profile.buyerSegment === 'new' && 'New buyer - Limited interaction history'}
          </p>
        </div>

        <div className={styles.segmentCard}>
          <h3>Bid Pattern</h3>
          <div className={`${styles.pattern} ${styles[profile.bidPattern]}`}>
            {profile.bidPattern.toUpperCase()}
          </div>
          <p className={styles.segmentDesc}>
            {profile.bidPattern === 'aggressive' && 'Wins bids frequently, high competition tolerance'}
            {profile.bidPattern === 'moderate' && 'Balanced bidding approach, selective participation'}
            {profile.bidPattern === 'conservative' && 'Cautious bidding, prefers lower-competition items'}
          </p>
        </div>

        <div className={styles.segmentCard}>
          <h3>Engagement Level</h3>
          <div className={`${styles.engagement} ${styles[profile.engagementLevel]}`}>
            {profile.engagementLevel.toUpperCase()}
          </div>
          <p className={styles.segmentDesc}>
            Recent activity: {profile.lastActiveAt ? new Date(profile.lastActiveAt.toMillis()).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </section>

      {/* Price Preferences */}
      <section className={styles.preferencesSection}>
        <h2 className={styles.subtitle}>Price Preferences</h2>
        <div className={styles.priceGrid}>
          <div className={styles.priceCard}>
            <span className={styles.label}>Min Price</span>
            <span className={styles.value}>${profile.preferredPriceRange.min}</span>
          </div>
          <div className={styles.priceCard}>
            <span className={styles.label}>Average Price</span>
            <span className={styles.value}>${profile.preferredPriceRange.avg}</span>
          </div>
          <div className={styles.priceCard}>
            <span className={styles.label}>Max Price</span>
            <span className={styles.value}>${profile.preferredPriceRange.max}</span>
          </div>
          <div className={styles.priceCard}>
            <span className={styles.label}>Bid Frequency (30d)</span>
            <span className={styles.value}>{profile.bidFrequency} bids</span>
          </div>
        </div>
      </section>

      {/* Top Categories */}
      <section className={styles.categoriesSection}>
        <h2 className={styles.subtitle}>Top Categories</h2>
        <div className={styles.categoriesGrid}>
          {profile.topCategories.map((category, index) => (
            <div key={index} className={styles.categoryCard}>
              <div className={styles.categoryRank}>#{index + 1}</div>
              <div className={styles.categoryName}>{category.category}</div>
              <div className={styles.categoryStats}>
                <div className={styles.stat}>
                  <span>Interactions:</span> <strong>{category.interactions}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Purchases:</span> <strong>{category.purchases}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Avg Price:</span> <strong>${category.avgPrice}</strong>
                </div>
              </div>
              <div className={styles.affinityBar}>
                <div className={styles.affinityFill} style={{ width: `${category.affinity}%` }}></div>
                <span className={styles.affinityLabel}>{Math.round(category.affinity)}% affinity</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actionable Insights */}
      {insights.length > 0 && (
        <section className={styles.insightsSection}>
          <h2 className={styles.subtitle}>📊 Actionable Insights</h2>
          <div className={styles.insightsList}>
            {insights.map((insight, index) => (
              <div key={index} className={styles.insightCard}>
                <div className={styles.insightText}>{insight.insight}</div>
                {insight.recommendedAction && (
                  <div className={styles.recommendedAction}>
                    💡 {insight.recommendedAction}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interaction History */}
      <section className={styles.historySection}>
        <h2 className={styles.subtitle}>Interaction History</h2>
        <div className={styles.filterButtons}>
          <button
            className={`${styles.filterBtn} ${!selectedType ? styles.active : ''}`}
            onClick={handleShowAll}
          >
            All ({profile.totalInteractions})
          </button>
          <button
            className={`${styles.filterBtn} ${selectedType === 'bid' ? styles.active : ''}`}
            onClick={() => handleFilterByType('bid')}
          >
            Bids ({profile.totalBids})
          </button>
          <button
            className={`${styles.filterBtn} ${selectedType === 'purchase' ? styles.active : ''}`}
            onClick={() => handleFilterByType('purchase')}
          >
            Purchases ({profile.totalPurchases})
          </button>
          <button
            className={`${styles.filterBtn} ${selectedType === 'view' ? styles.active : ''}`}
            onClick={() => handleFilterByType('view')}
          >
            Views ({profile.totalViews})
          </button>
          <button
            className={`${styles.filterBtn} ${selectedType === 'favorite' ? styles.active : ''}`}
            onClick={() => handleFilterByType('favorite')}
          >
            Favorites ({profile.totalFavorites})
          </button>
        </div>

        <div className={styles.historyTable}>
          <div className={styles.tableHeader}>
            <div className={styles.colType}>Type</div>
            <div className={styles.colItem}>Item Name</div>
            <div className={styles.colCategory}>Category</div>
            <div className={styles.colPrice}>Price</div>
            <div className={styles.colDate}>Date</div>
          </div>

          {interactions.map(interaction => (
            <div key={interaction.id} className={styles.tableRow}>
              <div className={styles.colType}>
                <span className={`${styles.badge} ${styles[interaction.type]}`}>
                  {interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1)}
                </span>
              </div>
              <div className={styles.colItem}>{interaction.itemName}</div>
              <div className={styles.colCategory}>{interaction.category}</div>
              <div className={styles.colPrice}>${interaction.price}</div>
              <div className={styles.colDate}>
                {interaction.timestamp ? new Date(interaction.timestamp.toMillis()).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          ))}

          {interactions.length === 0 && (
            <div className={styles.emptyState}>
              <p>No interactions found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
