"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { isAdminEmail } from "../../../lib/adminAccess";
import { formatCurrency } from "../../../lib/currency";
import { db } from "../../../lib/firebase";
import { FLAT_COLLECTIONS } from "../../../lib/flatCollections";
import { useUserCards, getUserFolders } from "../../../lib/cards";
import { useCurrentUser } from "../../../lib/useCurrentUser";
import { useCurrency } from "../../../hooks/useCurrency";
import StatCard from "@/components/StatCard";
import styles from "./feature-hub.module.css";

type FeatureItem = {
  title: string;
  description: string;
  href: string;
  tag: string;
  icon: string;
  adminOnly?: boolean;
  spotlight?: boolean;
};

type FeatureStats = {
  collectionCount: number;
  folderCount: number;
  listingCount: number;
  watchlistCount: number;
  collectionValue: number;
};

const featureGroups: Array<{ heading: string; features: FeatureItem[] }> = [
  {
    heading: "AI Tools",
    features: [
      {
        title: "AI Dashboard",
        description: "Track model-powered insights and automation metrics.",
        href: "/dashboard/ai",
        tag: "Insights",
        icon: "🤖",
        spotlight: true,
      },
      {
        title: "Pricing Advisor",
        description: "Review demand signals and listing guidance before you sell.",
        href: "/dashboard/pricing-advisor",
        tag: "Pricing",
        icon: "📈",
        spotlight: true,
      },
      {
        title: "AI Card Match",
        description: "Match uploaded cards against known records quickly.",
        href: "/dashboard/admin/ai-card-match",
        tag: "Matching",
        icon: "🧬",
        adminOnly: true,
      },
      {
        title: "DNA Match",
        description: "Run advanced similarity checks for difficult cards.",
        href: "/dashboard/admin/dna-match",
        tag: "Analysis",
        icon: "🔬",
        adminOnly: true,
      },
    ],
  },
  {
    heading: "Seller Growth",
    features: [
      {
        title: "Marketplace",
        description: "Browse active listings and compare sell-through opportunities.",
        href: "/dashboard/marketplace",
        tag: "Sales",
        icon: "🛍️",
        spotlight: true,
      },
      {
        title: "Seller Tools",
        description: "Sync PriceCharting offers and review seller performance.",
        href: "/dashboard/seller-tools",
        tag: "Optimization",
        icon: "📦",
      },
      {
        title: "Seller Boosts",
        description: "Manage campaign boosts to improve listing visibility.",
        href: "/dashboard/seller-boosts",
        tag: "Promotion",
        icon: "🚀",
      },
      {
        title: "Auto Bid",
        description: "Automate bidding strategy with rules and guardrails.",
        href: "/dashboard/auto-bid",
        tag: "Automation",
        icon: "⚡",
      },
    ],
  },
  {
    heading: "Operations",
    features: [
      {
        title: "Collection",
        description: "Organize cards into folders and track portfolio value.",
        href: "/dashboard/collection",
        tag: "Inventory",
        icon: "🗂️",
        spotlight: true,
      },
      {
        title: "Scan",
        description: "Upload and process card scans from one workflow.",
        href: "/dashboard/scan",
        tag: "Ingestion",
        icon: "📷",
      },
      {
        title: "Disputes",
        description: "Handle dispute queues and resolve marketplace issues.",
        href: "/dashboard/admin/disputes",
        tag: "Support",
        icon: "🛡️",
        adminOnly: true,
      },
      {
        title: "System Check",
        description: "Verify service health and monitor integrations.",
        href: "/dashboard/admin/system-check",
        tag: "Health",
        icon: "🩺",
        adminOnly: true,
      },
    ],
  },
];

const quickActions = [
  { label: "Scan a Card", href: "/dashboard/scan" },
  { label: "Open Collection", href: "/dashboard/collection" },
  { label: "Browse Marketplace", href: "/dashboard/marketplace" },
  { label: "View Pricing Advisor", href: "/dashboard/pricing-advisor" },
];

export default function FeatureHubPage() {
  const { user, loading } = useCurrentUser();
  const { currency } = useCurrency();
  const { cards: userCards, loading: cardsLoading } = useUserCards();
  const isAdmin = isAdminEmail(user?.email);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<FeatureStats>({
    collectionCount: 0,
    folderCount: 0,
    listingCount: 0,
    watchlistCount: 0,
    collectionValue: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.uid) {
        setStatsLoading(false);
        return;
      }

      try {
        setStatsLoading(true);

        const folders = await getUserFolders(user.uid);

        const [listingsSnapshot, watchlistSnapshot] = await Promise.all([
          getDocs(query(collection(db, FLAT_COLLECTIONS.marketListings), where("userId", "==", user.uid), limit(100))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, FLAT_COLLECTIONS.watchlists), where("userID", "==", user.uid), limit(100))).catch(() => ({ docs: [] } as any)),
        ]);

        const collectionValue = userCards.reduce((sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0), 0);

        setStats({
          collectionCount: userCards.length,
          folderCount: folders.length,
          listingCount: listingsSnapshot?.docs?.length || 0,
          watchlistCount: watchlistSnapshot?.docs?.length || 0,
          collectionValue,
        });
      } catch (error) {
        console.error("Error loading feature hub stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    void loadStats();
  }, [user?.uid, userCards]);

  const visibleGroups = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();

    return featureGroups
      .map((group) => ({
        ...group,
        features: group.features.filter((feature) => {
          if (feature.adminOnly && !isAdmin) return false;
          if (!queryText) return true;

          return [feature.title, feature.description, feature.tag, group.heading]
            .join(" ")
            .toLowerCase()
            .includes(queryText);
        }),
      }))
      .filter((group) => group.features.length > 0);
  }, [isAdmin, searchTerm]);

  const spotlightFeatures = visibleGroups
    .flatMap((group) => group.features)
    .filter((feature) => feature.spotlight)
    .slice(0, 4);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTopRow}>
          <div>
            <p className={styles.eyebrow}>Dashboard Control Center</p>
            <h1 className={styles.title}>Feature Hub</h1>
            <p className={styles.subtitle}>
              Your launch center for scanning, pricing, selling, and operations in one place.
            </p>
          </div>

          <div className={styles.quickActionRow}>
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className={styles.quickActionBtn}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {!loading && !isAdmin && (
          <p className={styles.notice}>Admin-only tools are hidden for your account.</p>
        )}
      </section>

      <section className={styles.statsStrip}>
        <StatCard
          label="Collection Value"
          value={formatCurrency(stats.collectionValue, currency)}
          loading={statsLoading}
        />
        <StatCard label="Cards" value={stats.collectionCount} loading={statsLoading} />
        <StatCard label="Folders" value={stats.folderCount} loading={statsLoading} />
        <StatCard label="Listings" value={stats.listingCount} loading={statsLoading} />
        <StatCard label="Watchlist" value={stats.watchlistCount} loading={statsLoading} />
      </section>

      <section className={styles.searchPanel}>
        <input
          className={styles.searchInput}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search dashboard tools..."
        />
      </section>

      {spotlightFeatures.length > 0 && (
        <section className={styles.spotlightSection}>
          <div className={styles.groupHeader}>
            <h2>Recommended next steps</h2>
          </div>
          <div className={styles.spotlightGrid}>
            {spotlightFeatures.map((feature) => (
              <Link key={feature.href} href={feature.href} className={styles.spotlightCard}>
                <div className={styles.spotlightIcon}>{feature.icon}</div>
                <span className={styles.tag}>{feature.tag}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className={styles.open}>Launch now</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={styles.grid}>
        {visibleGroups.map((group) => (
          <section key={group.heading} className={styles.group}>
            <div className={styles.groupHeader}>
              <h2>{group.heading}</h2>
            </div>

            <div className={styles.cards}>
              {group.features.map((feature) => (
                <Link key={feature.href} href={feature.href} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>{feature.icon}</span>
                    <span className={styles.tag}>{feature.tag}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <span className={styles.open}>Open feature</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
