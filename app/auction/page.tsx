"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useActiveAuctions } from "../lib/useActiveAuctions";
import { CreateAuctionModal } from "../components/CreateAuctionModal";
import DashboardLayout from "../dashboard/layout";
import styles from "./auction.module.css";

// Helper function to calculate time remaining
function getTimeRemaining(endTime: any): string {
  if (!endTime) return "N/A";
  
  try {
    const endDate = new Date(endTime.seconds * 1000);
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();

    if (diffMs <= 0) return "Ended";

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else if (diffMins > 0) {
      return `${diffMins}m`;
    } else {
      return "< 1m";
    }
  } catch (e) {
    return "N/A";
  }
}

export default function AuctionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [timeRemainings, setTimeRemainings] = useState<Record<string, string>>({});
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const { auctions, loading: auctionsLoading } = useActiveAuctions();

  // Check age verification on mount
  useEffect(() => {
    const verified = localStorage.getItem('auction_age_verified');
    if (verified === 'true') {
      setShowAgeVerification(false);
    } else {
      setShowAgeVerification(true);
    }
  }, []);

  const handleAgeConfirm = () => {
    localStorage.setItem('auction_age_verified', 'true');
    setShowAgeVerification(false);
  };

  const handleAgeDeny = () => {
    router.push('/dashboard');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Update time remaining every second
  useEffect(() => {
    if ((auctions || []).length === 0) return;

    const updateTimeRemaining = () => {
      const newTimeRemainings: Record<string, string> = {};
      (auctions || []).forEach((auction) => {
        if (auction.id) {
          newTimeRemainings[auction.id] = getTimeRemaining(auction.endTime);
        }
      });
      setTimeRemainings(newTimeRemainings);
    };

    // Update immediately
    updateTimeRemaining();

    // Update every second
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [auctions]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const handleAuctionCreated = () => {
    // Refresh auctions by incrementing key
    setModalKey(prev => prev + 1);
  };

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Marketplace</p>
            <h1 className={styles.title}>🔨 Live Auctions</h1>
          </div>
          <button onClick={() => setShowCreateModal(true)} className={styles.createButton}>
            + Create New Auction
          </button>
        </div>

        <div className={styles.legalNotice}>
          <strong>18+ Only:</strong> By participating in auctions, you confirm you are at least 18 years old and agree to our{' '}
          <Link href="/legal/auction-rules">Auction Rules</Link>, <Link href="/legal/terms">Terms of Service</Link>,{' '}
          <Link href="/legal/community-guidelines">Community Guidelines</Link>, and <Link href="/legal/privacy">Privacy Policy</Link>.
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{auctionsLoading ? "..." : (auctions || []).length}</div>
            <div className={styles.statLabel}>Active Auctions</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              ${auctionsLoading ? "..." : ((auctions || []).length > 0
                ? auctions.reduce((sum, auction) => sum + auction.currentBid, 0).toLocaleString()
                : "0")}
            </div>
            <div className={styles.statLabel}>Total Value</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              ${auctionsLoading ? "..." : ((auctions || []).length > 0
                ? Math.max(...auctions.map((auction) => auction.currentBid)).toLocaleString()
                : "0")}
            </div>
            <div className={styles.statLabel}>Highest Bid</div>
          </div>
        </div>

        <div className={`panel ${styles.listPanel}`}>
          <div className={styles.listHeader}>
            <h2>Auction Listings</h2>
          </div>

          {auctionsLoading ? (
            <div className={styles.loadingState}>Loading auctions...</div>
          ) : (auctions || []).length > 0 ? (
            <div className={styles.listingsGrid}>
              {(auctions || []).map((auction) => (
                <Link key={auction.id} href={`/auction/id?id=${auction.id}`} className={styles.auctionCard}>
                  <div className={styles.auctionInfo}>
                    <div className={styles.auctionTitle}>{auction.cardName}</div>
                    {auction.description && <div className={styles.auctionDescription}>{auction.description}</div>}
                  </div>

                  <div className={styles.metricBlock}>
                    <div className={styles.metricLabel}>Current Bid</div>
                    <div className={styles.metricValue}>${auction.currentBid.toLocaleString()}</div>
                  </div>

                  <div className={styles.metricBlock}>
                    <div className={styles.metricLabel}>Time Left</div>
                    <div className={styles.timeValue}>{auction.id ? timeRemainings[auction.id] || "N/A" : "N/A"}</div>
                  </div>

                  <span className={styles.bidAction}>Place Bid →</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔨</div>
              <div className={styles.emptyTitle}>No active auctions yet</div>
              <div className={styles.emptySubtitle}>Create one to get started.</div>
            </div>
          )}
        </div>
      </div>

      <CreateAuctionModal
        key={modalKey}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleAuctionCreated}
      />

      {/* Age Verification Modal */}
      {showAgeVerification && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>🔞</div>
            <h2 className={styles.modalTitle}>Age Verification Required</h2>
            <p className={styles.modalText}>
              You must be at least <strong>18 years of age</strong> to participate in auctions on StackTrack Pro.
            </p>
            <p className={styles.modalSubtext}>
              By confirming, you agree to our <Link href="/legal/auction-rules">Auction Rules</Link>, <Link href="/legal/terms">Terms of Service</Link>, and <Link href="/legal/privacy">Privacy Policy</Link>.
            </p>
            <div className={styles.modalActions}>
              <button onClick={handleAgeDeny} className={styles.secondaryButton}>
                I&apos;m Under 18
              </button>
              <button onClick={handleAgeConfirm} className={styles.primaryButton}>
                I&apos;m 18 or Older
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

