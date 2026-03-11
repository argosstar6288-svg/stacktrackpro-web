"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./lib/useCurrentUser";
import styles from "./page.module.css";
import { useEffect, useState } from "react";

const tickerItems = [
  { name: "Charizard", dir: "▲", price: "$420", change: "+5%" },
  { name: "Black Lotus", dir: "▲", price: "$12,300", change: "+2%" },
  { name: "Dark Magician", dir: "▼", price: "$75", change: "-3%" },
  { name: "Pikachu Illustrator", dir: "▲", price: "$2,100", change: "+12%" },
  { name: "Wayne Gretzky Rookie", dir: "▲", price: "$950", change: "+2.1%" },
  { name: "Umbreon VMAX Alt Art", dir: "▲", price: "$510", change: "+7.9%" },
  { name: "Michael Jordan Rookie", dir: "▲", price: "$860", change: "+6%" },
  { name: "Shiny Charizard VMAX", dir: "▼", price: "$290", change: "-1.4%" },
];

const features = [
  { icon: "📷", title: "Scan Cards", subtitle: "Scan cards fast", desc: "with AI scanner" },
  { icon: "📈", title: "Track Value", subtitle: "Portfolio tracking", desc: "and price charts" },
  { icon: "🛒", title: "Trade Cards", subtitle: "Marketplace", desc: "and auctions" },
];

const previewCards = [
  { name: "Charizard Holo", set: "Base Set", price: "$420", rarity: "ultra" as const },
  { name: "Pikachu Illustrator", set: "Promo", price: "$2,100", rarity: "ultra" as const },
  { name: "Black Lotus", set: "Alpha", price: "$12,300", rarity: "ultra" as const },
  { name: "Jordan Rookie", set: "1986 Fleer", price: "$860", rarity: "rare" as const },
  { name: "Charizard EX", set: "151", price: "$145", rarity: "rare" as const },
  { name: "Dark Magician", set: "LOB 1st Ed.", price: "$75", rarity: "rare" as const },
  { name: "Umbreon VMAX Alt", set: "Evolving Skies", price: "$510", rarity: "ultra" as const },
  { name: "Wayne Gretzky RC", set: "1979-80 O-Pee", price: "$950", rarity: "rare" as const },
];

export default function Home() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard/discover");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── NAVBAR ── */}
      <header className={styles.navbar}>
        <div className={styles.logo}>StackTrack</div>

        <nav className={`${styles.navLinks} ${menuOpen ? styles.navOpen : ""}`}>
          <a href="#marketplace" onClick={() => setMenuOpen(false)}>Marketplace</a>
          <a href="#auctions" onClick={() => setMenuOpen(false)}>Auctions</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <Link href="/login" onClick={() => setMenuOpen(false)}>Login</Link>
        </nav>

        <div className={styles.navActions}>
          <Link className={styles.signInButton} href="/login">Login</Link>
          <Link className={styles.ctaButton} href="/create-account">Start Collecting</Link>
        </div>

        <button
          className={styles.hamburger}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      <main className={styles.main}>
        {/* ── HERO ── */}
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>TRACK &bull; SCAN &bull; TRADE</p>
          <h1 className={styles.heroHeadline}>
            The modern platform for managing<br />and trading collectible trading cards.
          </h1>
          <div className={styles.heroActions}>
            <Link className={styles.ctaButton} href="/create-account">
              Start Collecting
            </Link>
            <a className={styles.ghostButton} href="#marketplace">
              View Marketplace
            </a>
          </div>
        </section>

        {/* ── LIVE MARKET TICKER ── */}
        <section className={styles.tickerSection}>
          <span className={styles.tickerLabel}>LIVE</span>
          <div className={styles.tickerTrackWrap}>
            <div className={styles.tickerTrack}>
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span
                  key={`${item.name}-${i}`}
                  className={`${styles.tickerItem} ${
                    item.dir === "▲" ? styles.tickerUp : styles.tickerDown
                  }`}
                >
                  <span className={styles.tickerDir}>{item.dir}</span>
                  <span className={styles.tickerName}>{item.name}</span>
                  <strong>{item.price}</strong>
                  <span className={styles.tickerChange}>{item.change}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className={styles.featuresSection}>
          <h2 className={styles.sectionLabel}>FEATURES</h2>
          <div className={styles.featureGrid}>
            {features.map((f) => (
              <article key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>
                  <strong>{f.subtitle}</strong>
                  <br />
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── MARKETPLACE PREVIEW ── */}
        <section id="marketplace" className={styles.marketplaceSection}>
          <h2 className={styles.sectionLabel}>Marketplace Preview</h2>
          <div className={styles.cardGrid}>
            {previewCards.map((card) => (
              <article
                key={card.name}
                className={`${styles.previewCard} ${
                  card.rarity === "ultra" ? styles.ultraRare : styles.rare
                }`}
              >
                <div className={styles.cardImagePlaceholder}>
                  <span>🃏</span>
                </div>
                <div className={styles.cardInfo}>
                  <h4>{card.name}</h4>
                  <span className={styles.cardSet}>{card.set}</span>
                  <strong className={styles.cardPrice}>{card.price}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── PLATFORM STATS ── */}
        <section className={styles.statsSection}>
          <div className={styles.statItem}>
            <strong>150K</strong>
            <span>Cards Tracked</span>
          </div>
          <div className={styles.statItem}>
            <strong>12K</strong>
            <span>Collectors</span>
          </div>
          <div className={styles.statItem}>
            <strong>$8.2M</strong>
            <span>Marketplace Volume</span>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogo}>StackTrack</span>
            <p>The modern platform for managing and trading collectible cards.</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h5>Platform</h5>
              <a href="#marketplace">Marketplace</a>
              <a href="#auctions">Auctions</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h5>Company</h5>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
            </div>
            <div>
              <h5>Account</h5>
              <Link href="/login">Login</Link>
              <Link href="/create-account">Sign Up</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} StackTrack. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
