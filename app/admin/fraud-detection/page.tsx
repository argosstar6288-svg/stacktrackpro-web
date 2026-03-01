"use client";

import { useState, useEffect } from "react";
import { 
  detectPriceSpikeAlerts,
  detectBidManipulation,
  detectSelfBiddingAlerts,
  detectSuspiciousAccountClusters,
  SuddenPriceSpikeAlert,
  BidManipulationAlert,
  SelfBiddingAlert,
  SuspiciousAccountCluster
} from "../../lib/revenueMetrics";
import styles from "./fraud-detection.module.css";

type TabType = 'overview' | 'spikes' | 'bidding' | 'self-bid' | 'clusters';

export default function FraudDetectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [priceSpikes, setPriceSpikes] = useState<SuddenPriceSpikeAlert[]>([]);
  const [bidManipulation, setBidManipulation] = useState<BidManipulationAlert[]>([]);
  const [selfBidding, setSelfBidding] = useState<SelfBiddingAlert[]>([]);
  const [accountClusters, setAccountClusters] = useState<SuspiciousAccountCluster[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadFraudAlerts();
  }, []);

  const loadFraudAlerts = async () => {
    try {
      setLoading(true);
      setError("");

      const [spikes, bidding, selfBid, clusters] = await Promise.all([
        detectPriceSpikeAlerts(50),
        detectBidManipulation(),
        detectSelfBiddingAlerts(),
        detectSuspiciousAccountClusters(),
      ]);

      setPriceSpikes(spikes);
      setBidManipulation(bidding);
      setSelfBidding(selfBid);
      setAccountClusters(clusters);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error loading fraud alerts:", err);
      setError("Failed to load fraud detection data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const rarityClass = (score: number) => {
    if (score >= 80) return styles.critical;
    if (score >= 60) return styles.high;
    if (score >= 40) return styles.medium;
    return styles.low;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>Loading fraud detection analysis...</div>
      </div>
    );
  }

  const totalAlerts = priceSpikes.length + bidManipulation.length + selfBidding.length + accountClusters.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🔍 Fraud Detection</h1>
        <p className={styles.subtitle}>Real-time anomaly detection and suspicious activity monitoring</p>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* OVERVIEW STATS */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.critical}`}>
          <div className={styles.statNumber}>{priceSpikes.length}</div>
          <div className={styles.statLabel}>Price Spikes</div>
        </div>
        <div className={`${styles.statCard} ${styles.high}`}>
          <div className={styles.statNumber}>{bidManipulation.length}</div>
          <div className={styles.statLabel}>Bid Manipulation</div>
        </div>
        <div className={`${styles.statCard} ${styles.medium}`}>
          <div className={styles.statNumber}>{selfBidding.length}</div>
          <div className={styles.statLabel}>Self-Bidding</div>
        </div>
        <div className={`${styles.statCard} ${styles.high}`}>
          <div className={styles.statNumber}>{accountClusters.length}</div>
          <div className={styles.statLabel}>Account Clusters</div>
        </div>
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'spikes' ? styles.active : ''}`}
          onClick={() => setActiveTab('spikes')}
        >
          🚀 Price Spikes ({priceSpikes.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'bidding' ? styles.active : ''}`}
          onClick={() => setActiveTab('bidding')}
        >
          🎯 Bid Manipulation ({bidManipulation.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'self-bid' ? styles.active : ''}`}
          onClick={() => setActiveTab('self-bid')}
        >
          🔄 Self-Bidding ({selfBidding.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'clusters' ? styles.active : ''}`}
          onClick={() => setActiveTab('clusters')}
        >
          🕸️ Account Clusters ({accountClusters.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className={styles.section}>
          <h2>Fraud Detection Summary</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h3>🚀 Sudden Price Spikes</h3>
              <p>Items with abnormal price increases (50%+ spike)</p>
              {priceSpikes.length === 0 ? (
                <div className={styles.empty}>No price spikes detected</div>
              ) : (
                <div className={styles.topAlerts}>
                  {priceSpikes.slice(0, 3).map(alert => (
                    <div key={alert.id} className={styles.alertPreview}>
                      <strong>{alert.auctionTitle}</strong>
                      <div className={styles.alertDetail}>
                        ↑ {alert.spikePercentage}% spike (${alert.previousPrice} → ${alert.currentPrice})
                      </div>
                      <div className={styles.riskBadge} style={{ background: '#ff4757' }}>
                        Risk: {alert.riskScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.summaryCard}>
              <h3>🎯 Bid Manipulation</h3>
              <p>Rapid bidding, coordinated activity, or artificial price inflation</p>
              {bidManipulation.length === 0 ? (
                <div className={styles.empty}>No bid manipulation detected</div>
              ) : (
                <div className={styles.topAlerts}>
                  {bidManipulation.slice(0, 3).map(alert => (
                    <div key={alert.id} className={styles.alertPreview}>
                      <strong>{alert.auctionTitle}</strong>
                      <div className={styles.alertDetail}>
                        {alert.suspiciousActivity.replace(/_/g, ' ')} - {alert.bidCount} bids
                      </div>
                      <div className={styles.riskBadge} style={{ background: '#ffa502' }}>
                        Risk: {alert.riskScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.summaryCard}>
              <h3>🔄 Self-Bidding</h3>
              <p>Sellers bidding on their own items to inflate prices</p>
              {selfBidding.length === 0 ? (
                <div className={styles.empty}>No self-bidding detected</div>
              ) : (
                <div className={styles.topAlerts}>
                  {selfBidding.slice(0, 3).map(alert => (
                    <div key={alert.id} className={styles.alertPreview}>
                      <strong>{alert.auctionTitle}</strong>
                      <div className={styles.alertDetail}>
                        {alert.sellerName} - {alert.bidCount} bids on own item
                      </div>
                      <div className={styles.riskBadge} style={{ background: '#ff6348' }}>
                        Risk: {alert.riskScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.summaryCard}>
              <h3>🕸️ Account Clusters</h3>
              <p>Networks of suspicious accounts working together</p>
              {accountClusters.length === 0 ? (
                <div className={styles.empty}>No account clusters detected</div>
              ) : (
                <div className={styles.topAlerts}>
                  {accountClusters.slice(0, 3).map(alert => (
                    <div key={alert.id} className={styles.alertPreview}>
                      <strong>{alert.clusterName}</strong>
                      <div className={styles.alertDetail}>
                        {alert.accountCount} accounts, {alert.totalSuspiciousAuctions} suspicious auctions
                      </div>
                      <div className={styles.riskBadge} style={{ background: '#ee5a6f' }}>
                        Risk: {alert.riskScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRICE SPIKES TAB */}
      {activeTab === 'spikes' && (
        <div className={styles.section}>
          <h2>🚀 Sudden Price Spikes</h2>
          {priceSpikes.length === 0 ? (
            <div className={styles.empty}>No price spikes detected</div>
          ) : (
            <div className={styles.alertsList}>
              {priceSpikes.map(alert => (
                <div key={alert.id} className={`${styles.alertCard} ${rarityClass(alert.riskScore)}`}>
                  <div className={styles.alertHeader}>
                    <div>
                      <h3>{alert.auctionTitle}</h3>
                      <p className={styles.sellerInfo}>Seller: {alert.sellerName}</p>
                    </div>
                    <div className={styles.riskScore}>{alert.riskScore}%</div>
                  </div>

                  <div className={styles.alertMetrics}>
                    <div className={styles.metric}>
                      <span className={styles.label}>Previous Price</span>
                      <span className={styles.value}>${alert.previousPrice.toLocaleString()}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Current Price</span>
                      <span className={styles.value}>${alert.currentPrice.toLocaleString()}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Spike %</span>
                      <span className={styles.value} style={{ color: '#ff4757' }}>
                        +{alert.spikePercentage}%
                      </span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Category Avg</span>
                      <span className={styles.value}>${alert.categoryAverage.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className={styles.reason}>{alert.reason}</div>

                  <div className={styles.actions}>
                    <button className={styles.reviewBtn}>Review Auction</button>
                    <button className={styles.actionBtn}>Pause Auction</button>
                    <button className={styles.actionBtn}>Flag Account</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BID MANIPULATION TAB */}
      {activeTab === 'bidding' && (
        <div className={styles.section}>
          <h2>🎯 Bid Manipulation Pattern Detected</h2>
          {bidManipulation.length === 0 ? (
            <div className={styles.empty}>No bid manipulation detected</div>
          ) : (
            <div className={styles.alertsList}>
              {bidManipulation.map(alert => (
                <div key={alert.id} className={`${styles.alertCard} ${rarityClass(alert.riskScore)}`}>
                  <div className={styles.alertHeader}>
                    <div>
                      <h3>{alert.auctionTitle}</h3>
                      <p className={styles.activityType}>
                        {alert.suspiciousActivity.replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className={styles.riskScore}>{alert.riskScore}%</div>
                  </div>

                  <div className={styles.alertMetrics}>
                    <div className={styles.metric}>
                      <span className={styles.label}>Total Bids</span>
                      <span className={styles.value}>{alert.bidCount}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Unique Bidders</span>
                      <span className={styles.value}>{alert.uniqueBidders}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Timeframe</span>
                      <span className={styles.value}>{alert.timeWindow}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Suspicious Bidders</span>
                      <span className={styles.value}>{alert.suspiciousBidders.length}</span>
                    </div>
                  </div>

                  {alert.suspiciousBidders.length > 0 && (
                    <div className={styles.suspiciousList}>
                      <strong>Suspicious Bidders:</strong>
                      {alert.suspiciousBidders.map((bidder, idx) => (
                        <span key={idx} className={styles.bidderTag}>{bidder.substring(0, 8)}...</span>
                      ))}
                    </div>
                  )}

                  <div className={styles.reason}>{alert.reason}</div>

                  <div className={styles.actions}>
                    <button className={styles.reviewBtn}>Review Bids</button>
                    <button className={styles.actionBtn}>Suspend Bidders</button>
                    <button className={styles.actionBtn}>Reverse Bids</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SELF-BIDDING TAB */}
      {activeTab === 'self-bid' && (
        <div className={styles.section}>
          <h2>🔄 Self-Bidding Alerts</h2>
          {selfBidding.length === 0 ? (
            <div className={styles.empty}>No self-bidding detected</div>
          ) : (
            <div className={styles.alertsList}>
              {selfBidding.map(alert => (
                <div key={alert.id} className={`${styles.alertCard} ${rarityClass(alert.riskScore)}`}>
                  <div className={styles.alertHeader}>
                    <div>
                      <h3>{alert.auctionTitle}</h3>
                      <p className={styles.sellerInfo}>Seller: {alert.sellerName}</p>
                    </div>
                    <div className={styles.riskScore}>{alert.riskScore}%</div>
                  </div>

                  <div className={styles.alertMetrics}>
                    <div className={styles.metric}>
                      <span className={styles.label}>Seller ID</span>
                      <span className={styles.value}>{alert.sellerId.substring(0, 8)}...</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Bids Placed</span>
                      <span className={styles.value}>{alert.bidCount}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Top Bidder</span>
                      <span className={styles.value}>{alert.accusedBidderName}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Pattern</span>
                      <span className={styles.value}>{alert.commonPattern}</span>
                    </div>
                  </div>

                  <div className={styles.reason}>{alert.reason}</div>

                  <div className={styles.actions}>
                    <button className={styles.reviewBtn}>Review Auction</button>
                    <button className={styles.actionBtn}>Suspend Seller</button>
                    <button className={styles.actionBtn}>Void All Bids</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACCOUNT CLUSTERS TAB */}
      {activeTab === 'clusters' && (
        <div className={styles.section}>
          <h2>🕸️ Suspicious Account Clusters</h2>
          {accountClusters.length === 0 ? (
            <div className={styles.empty}>No account clusters detected</div>
          ) : (
            <div className={styles.alertsList}>
              {accountClusters.map(alert => (
                <div key={alert.id} className={`${styles.alertCard} ${rarityClass(alert.riskScore)}`}>
                  <div className={styles.alertHeader}>
                    <div>
                      <h3>{alert.clusterName}</h3>
                      <p className={styles.connectionType}>
                        Connection: {alert.connectionType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className={styles.riskScore}>{alert.riskScore}%</div>
                  </div>

                  <div className={styles.alertMetrics}>
                    <div className={styles.metric}>
                      <span className={styles.label}>Accounts</span>
                      <span className={styles.value}>{alert.accountCount}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Suspicious Auctions</span>
                      <span className={styles.value}>{alert.totalSuspiciousAuctions}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.label}>Connection Type</span>
                      <span className={styles.value}>{alert.connectionType.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div className={styles.characteristics}>
                    <strong>Shared Characteristics:</strong>
                    <ul>
                      {alert.sharedCharacteristics.map((char, idx) => (
                        <li key={idx}>{char}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.reason}>{alert.explanation}</div>

                  <div className={styles.actions}>
                    <button className={styles.reviewBtn}>Investigate Cluster</button>
                    <button className={styles.actionBtn}>Suspend All Accounts</button>
                    <button className={styles.actionBtn}>Review Shared Auctions</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className={styles.footer}>
        <button onClick={loadFraudAlerts} className={styles.refreshBtn}>
          🔄 Refresh Analysis
        </button>
        <p className={styles.updateTime}>Last updated: {lastUpdated.toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
