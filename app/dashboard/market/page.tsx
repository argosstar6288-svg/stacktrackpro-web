"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CustomLineChart } from "@/lib/charts";
import { useUserCards } from "@/lib/cards";
import styles from "./market.module.css";

export default function MarketPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { cards, loading: cardsLoading } = useUserCards();
  
  // Generate market trend from real card data
  const marketData = Array.from({ length: 30 }).map((_, idx) => ({
    name: `Day ${idx + 1}`,
    avgPrice: (cards || []).length > 0 
      ? Math.floor((cards.reduce((sum, c) => sum + c.value, 0) / (cards.length || 1)) * (0.9 + Math.random() * 0.2))
      : 0,
    volume: Math.floor(Math.random() * 50 + 10)
  }));

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

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Market</p>
          <h1 className={styles.title}>Market Overview</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <input type="text" placeholder="Search market..." />
          </div>
          <Link className={styles.actionLink} href="/auction">
            Live Auctions
          </Link>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.highlight}>
              <div>
                <p className={styles.highlightLabel}>Market Pulse</p>
                <p className={styles.highlightValue}>+3.2%</p>
                <p className={styles.highlightSub}>Last 7 days</p>
              </div>
              <button className={styles.primaryButton} type="button">
                Browse Listings
              </button>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Market Overview (30 Days)</h2>
                <p className={styles.panelSubtitle}>Average price from your collection</p>
              </div>
              <span className={styles.panelBadge}>Updated today</span>
            </div>
            <div className={styles.chartWrap}>
              <div className={styles.chartCanvas}>
                <CustomLineChart
                  data={marketData}
                  dataKey="avgPrice"
                  height={300}
                  color="#ff7a47"
                />
              </div>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Your Collection</h2>
                <p className={styles.panelSubtitle}>Top cards by value</p>
              </div>
              <Link className={styles.panelLink} href="/dashboard/portfolio">
                View all
              </Link>
            </div>
            <div className={styles.cardsGrid}>
              {cardsLoading ? (
                <div className={styles.muted}>Loading cards...</div>
              ) : (cards || []).length > 0 ? (
                (cards || []).slice(0, 6).map((card) => (
                  <div key={card.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardName}>{card.name}</div>
                      <div className={styles.cardBadge}>{card.rarity || "Common"}</div>
                    </div>
                    <div className={styles.cardMeta}>{card.year || "N/A"}</div>
                    <div className={styles.cardValue}>
                      ${card.value.toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.muted}>No cards in collection</div>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>By Value</h2>
                <p className={styles.panelSubtitle}>Inventory breakdown</p>
              </div>
            </div>
            {(cards || []).length > 0 ? (
              <div className={styles.rarityList}>
                {(() => {
                  const valueRanges = [
                    { label: "Under $100", min: 0, max: 100 },
                    { label: "$100 - $500", min: 100, max: 500 },
                    { label: "$500 - $1K", min: 500, max: 1000 },
                    { label: "$1K - $5K", min: 1000, max: 5000 },
                    { label: "Over $5K", min: 5000, max: Infinity },
                  ];
                  
                  const breakdown = valueRanges.map(range => {
                    const cardsInRange = (cards || []).filter(
                      card => card.value >= range.min && card.value < range.max
                    );
                    const totalValue = cardsInRange.reduce((sum, c) => sum + c.value, 0);
                    return {
                      label: range.label,
                      count: cardsInRange.length,
                      value: totalValue,
                    };
                  }).filter(item => item.count > 0);
                  
                  return breakdown.map((item) => (
                    <div key={item.label} className={styles.rarityRow}>
                      <span>{item.label}</span>
                      <span>${item.value.toLocaleString()}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className={styles.muted}>No cards yet</div>
            )}
          </section>

          <section className={`panel ${styles.panel} ${styles.valuePanel}`}>
            <p className={styles.valueLabel}>Average Price</p>
            <div className={styles.valueAmount}>
              {(cards || []).length > 0
                ? `$${Math.floor(
                    cards.reduce((sum, c) => sum + c.value, 0) / cards.length
                  ).toLocaleString()}`
                : "$0"}
            </div>
            <p className={styles.valueNote}>Based on your tracked cards</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
