"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { db } from "@/lib/firebase";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "./card-detail.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MasterCard {
  id: string;
  name: string;
  set: string;
  year?: number;
  number?: string;
  rarity?: string;
  image?: string;
  artist?: string;
  game?: string;
  gameID?: string;
  setID?: string;
}

interface MarketData {
  marketPrice: number;
  change7d?: number;
  change30d?: number;
  change90d?: number;
  change1y?: number;
  lastUpdated?: any;
  recentSales?: RecentSale[];
}

interface RecentSale {
  date: any;
  price: number;
  condition?: string;
  grade?: string;
  platform?: string;
}

interface PricePoint {
  date: string;
  price: number;
}

interface Variant {
  id: string;
  name: string;
  image?: string;
  avgPrice?: number;
  rarity?: string;
  type?: string;
}

interface MarketListing {
  id: string;
  price: number;
  condition?: string;
  grade?: string;
  userName?: string;
  sellerRating?: number;
  userId?: string;
  createdAt?: any;
}

type ChartRange = "7d" | "30d" | "90d" | "1y";

const RANGE_DAYS: Record<ChartRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: any): string {
  if (!raw) return "—";
  try {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatShortDate(raw: any): string {
  if (!raw) return "";
  try {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function starRating(n: number | undefined): string {
  if (!n) return "—";
  const clamped = Math.min(5, Math.max(0, Math.round(n)));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}

/** Generate synthetic price history when Firestore has no data */
function syntheticHistory(basePrice: number, days: number): PricePoint[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const ms = now - (days - 1 - i) * 86_400_000;
    const noise = basePrice * 0.04 * (Math.random() - 0.5);
    const trend = basePrice * 0.0003 * i;
    return {
      date: new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: Math.max(1, Math.round((basePrice + trend + noise) * 100) / 100),
    };
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CardDetailPage() {
  const params = useParams();
  const cardId = params?.id as string;
  const router = useRouter();
  const { user } = useCurrentUser();

  const [card, setCard] = useState<MasterCard | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);

  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [addedMsg, setAddedMsg] = useState("");

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cardId) return;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Master card document
        const cardRef = doc(db, FLAT_COLLECTIONS.cards, cardId);
        const cardSnap = await getDoc(cardRef);
        if (!cardSnap.exists()) {
          setLoading(false);
          return;
        }
        const raw = cardSnap.data();
        const masterCard: MasterCard = {
          id: cardSnap.id,
          name: raw.name || raw.cardName || raw.cardID || "Unknown Card",
          set: raw.set || raw.setName || raw.brand || "",
          year: raw.year,
          number: raw.number || raw.cardNumber || "",
          rarity: raw.rarity || "",
          image: raw.image || raw.imageUrl || raw.imageURL || "",
          artist: raw.artist || raw.illustrator || "",
          game: raw.game || raw.sport || raw.gameID || "",
          gameID: raw.gameID || "",
          setID: raw.setID || "",
        };
        setCard(masterCard);

        // 2. Market data
        const mdRef = doc(db, FLAT_COLLECTIONS.cardMarketData, cardId);
        const mdSnap = await getDoc(mdRef);
        if (mdSnap.exists()) {
          const md = mdSnap.data();
          setMarketData({
            marketPrice: Number(md.marketPrice || md.avgPrice || md.price || 0),
            change7d: md.change7d,
            change30d: md.change30d,
            change90d: md.change90d,
            change1y: md.change1y,
            lastUpdated: md.lastUpdated,
            recentSales: Array.isArray(md.recentSales)
              ? md.recentSales.map((s: any) => ({
                  date: s.date || s.soldAt,
                  price: Number(s.price || 0),
                  condition: s.condition || "",
                  grade: s.grade || "",
                  platform: s.platform || "",
                }))
              : [],
          });
        } else {
          // Fall back to avgPrice on the card doc
          setMarketData({
            marketPrice: Number(raw.avgPrice || raw.value || 0),
            recentSales: [],
          });
        }

        // 3. Price history
        try {
          const phRef = collection(db, FLAT_COLLECTIONS.priceHistory);
          const phQ = query(
            phRef,
            where("cardID", "==", cardId),
            orderBy("date", "desc"),
            limit(400)
          );
          const phSnap = await getDocs(phQ);
          if (!phSnap.empty) {
            const pts: PricePoint[] = phSnap.docs
              .map((d) => ({
                date: formatShortDate(d.data().date),
                price: Number(d.data().price || 0),
              }))
              .reverse();
            setPriceHistory(pts);
          }
        } catch {
          // price history query may not have an index yet; silently skip
        }

        // 4. Variants (same set, different version)
        try {
          const varRef = collection(db, FLAT_COLLECTIONS.variants);
          const varQ = query(varRef, where("cardID", "==", cardId), limit(12));
          const varSnap = await getDocs(varQ);
          setVariants(
            varSnap.docs.map((d) => ({
              id: d.id,
              name: d.data().name || d.data().variantType || "Variant",
              image: d.data().image || d.data().imageUrl || "",
              avgPrice: Number(d.data().avgPrice || 0),
              rarity: d.data().rarity || "",
              type: d.data().variantType || d.data().type || "",
            }))
          );
        } catch {
          // silently skip if variants collection missing
        }

        // 5. Active marketplace listings for this card
        try {
          const mlRef = collection(db, FLAT_COLLECTIONS.marketListings);
          const mlQ = query(
            mlRef,
            where("cardId", "==", cardId),
            where("status", "==", "active"),
            orderBy("price", "asc"),
            limit(6)
          );
          const mlSnap = await getDocs(mlQ);
          setListings(
            mlSnap.docs.map((d) => ({
              id: d.id,
              price: Number(d.data().price || 0),
              condition: d.data().condition || "",
              grade: d.data().grade || "",
              userName: d.data().userName || d.data().sellerName || "Seller",
              sellerRating: d.data().sellerRating,
              userId: d.data().userId || d.data().userID,
              createdAt: d.data().createdAt,
            }))
          );
        } catch {
          // silently skip
        }
      } catch (err) {
        console.error("CardDetailPage load error", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [cardId]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const days = RANGE_DAYS[chartRange];
    if (priceHistory.length >= days) {
      return priceHistory.slice(-days);
    }
    if (priceHistory.length > 0) {
      return priceHistory;
    }
    // Generate synthetic data when nothing in Firestore
    const base = marketData?.marketPrice ?? 100;
    return syntheticHistory(base, days);
  }, [priceHistory, chartRange, marketData]);

  // ── Trend display ───────────────────────────────────────────────────────────

  const trendValue = useMemo(() => {
    if (!marketData) return null;
    const map: Record<ChartRange, number | undefined> = {
      "7d": marketData.change7d,
      "30d": marketData.change30d,
      "90d": marketData.change90d,
      "1y": marketData.change1y,
    };
    return map[chartRange] ?? null;
  }, [marketData, chartRange]);

  // ── Add to collection ───────────────────────────────────────────────────────

  const handleAddToCollection = async () => {
    if (!user || !card) {
      router.push("/auth/signin");
      return;
    }
    setAddingToCollection(true);
    try {
      await addDoc(collection(db, FLAT_COLLECTIONS.userCards), {
        userID: user.uid,
        cardID: card.id,
        added: serverTimestamp(),
        value: marketData?.marketPrice ?? 0,
      });
      setAddedMsg("Added to collection!");
      setTimeout(() => setAddedMsg(""), 3000);
    } catch (err) {
      console.error("Add to collection failed", err);
      setAddedMsg("Failed — try again.");
    } finally {
      setAddingToCollection(false);
    }
  };

  const handleSellCard = () => {
    router.push(`/dashboard/marketplace/create?cardId=${cardId}`);
  };

  const handleWatchlist = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    try {
      await addDoc(collection(db, FLAT_COLLECTIONS.watchlists), {
        userID: user.uid,
        cardID: cardId,
        added: serverTimestamp(),
      });
      setAddedMsg("Added to watchlist!");
      setTimeout(() => setAddedMsg(""), 3000);
    } catch {
      setAddedMsg("Already on watchlist.");
      setTimeout(() => setAddedMsg(""), 3000);
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading card data…</span>
      </div>
    );
  }

  if (!card) {
    return (
      <div className={styles.notFound}>
        <h2>Card Not Found</h2>
        <p>This card doesn't exist in the database.</p>
        <Link href="/dashboard/market" className="btn-secondary mt-4 inline-block">
          ← Back to Market
        </Link>
      </div>
    );
  }

  const trendClass =
    trendValue == null
      ? styles.trendNeutral
      : trendValue > 0
      ? styles.trendUp
      : styles.trendDown;

  const trendArrow = trendValue == null ? "" : trendValue > 0 ? "▲" : "▼";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ── Back nav ── */}
      <div className={styles.backNav}>
        <Link href="/dashboard/market" className={styles.backLink}>
          ← Back to Market
        </Link>
      </div>

      {/* ════════════════════════════════════════
          HERO: Image + Info
      ════════════════════════════════════════ */}
      <div className={styles.hero}>
        {/* Card image */}
        <div className={styles.imageWrap}>
          <div className={styles.imageBox}>
            {card.image ? (
              <Image
                src={card.image}
                alt={card.name}
                width={340}
                height={476}
                sizes="(max-width: 768px) 100vw, 340px"
                className={styles.cardImg}
                unoptimized
                priority
              />
            ) : (
              <div className={styles.noImg}>
                <span>🃏</span>
                <p>No image available</p>
              </div>
            )}
          </div>
          <p className={styles.viewBadge}>
            {card.set && `${card.set}`}
            {card.year && ` • ${card.year}`}
          </p>
        </div>

        {/* Info panel */}
        <div className={styles.infoPanel}>
          {/* Card header */}
          <div>
            <h1 className={styles.cardTitle}>{card.name}</h1>
            <p className={styles.cardSubtitle}>
              {[card.set, card.year, card.number ? `#${card.number}` : null]
                .filter(Boolean)
                .join(" • ")}
            </p>
            {card.rarity && (
              <span className={styles.rarityBadge}>✦ {card.rarity}</span>
            )}
          </div>

          {/* Market value */}
          {marketData && (
            <div className={styles.marketPanel}>
              <div>
                <div className={styles.marketLabel}>Market Value</div>
                <div className={styles.marketValue}>
                  ${marketData.marketPrice > 0
                    ? marketData.marketPrice.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </div>
              </div>
              <div>
                {trendValue != null ? (
                  <>
                    <div className={trendClass}>
                      {trendArrow} {Math.abs(trendValue).toFixed(1)}%
                    </div>
                    <div className={styles.trendLabel}>
                      {chartRange === "7d" && "7 days"}
                      {chartRange === "30d" && "30 days"}
                      {chartRange === "90d" && "90 days"}
                      {chartRange === "1y" && "1 year"}
                    </div>
                  </>
                ) : (
                  <div className={styles.trendNeutral}>— %</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            {addedMsg && (
              <p className="text-green-400 text-sm mb-3">{addedMsg}</p>
            )}
            <div className={styles.actions}>
              <button
                className="btn-primary"
                onClick={handleAddToCollection}
                disabled={addingToCollection}
              >
                {addingToCollection ? "Adding…" : "＋ Add to Collection"}
              </button>
              <button className="btn-secondary" onClick={handleSellCard}>
                Sell Card
              </button>
              <button className="btn-secondary" onClick={handleWatchlist}>
                ♡ Watchlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          PRICE HISTORY CHART
      ════════════════════════════════════════ */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📈 Price History</h2>

        {/* Range tabs */}
        <div className={styles.rangeTabs}>
          {(["7d", "30d", "90d", "1y"] as ChartRange[]).map((r) => (
            <button
              key={r}
              className={`${styles.rangeTab} ${chartRange === r ? styles.rangeTabActive : ""}`}
              onClick={() => setChartRange(r)}
            >
              {r === "7d" && "7 Days"}
              {r === "30d" && "30 Days"}
              {r === "90d" && "90 Days"}
              {r === "1y" && "1 Year"}
            </button>
          ))}
        </div>

        <div className={styles.chartWrap}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.07)"
                />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                  tickFormatter={(v) => `$${v}`}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0b0f1a",
                    border: "1px solid rgba(255,143,0,0.35)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                  formatter={(v: any) => [
                    `$${Number(v).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}`,
                    "Price",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#ff8f00"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "#ff8f00" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>No price data available</div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          RECENT SALES
      ════════════════════════════════════════ */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>💰 Recent Sales</h2>
        {marketData?.recentSales && marketData.recentSales.length > 0 ? (
          <table className={styles.salesTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Condition</th>
                <th>Grade</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {marketData.recentSales.map((sale, i) => (
                <tr key={i}>
                  <td>{formatDate(sale.date)}</td>
                  <td>
                    <span className={styles.salePrice}>
                      ${sale.price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td>
                    {sale.condition ? (
                      <span className={styles.condBadge}>{sale.condition}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {sale.grade ? (
                      <span className={styles.saleGrade}>{sale.grade}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{sale.platform || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            No recent sales data available.
          </p>
        )}
      </div>

      {/* ════════════════════════════════════════
          VARIANTS / VERSIONS
      ════════════════════════════════════════ */}
      {variants.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>🃏 Variants &amp; Versions</h2>
          <div className={styles.variantsGrid}>
            {variants.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard/cards/${v.id}`}
                className={styles.variantCard}
              >
                {v.image ? (
                  <Image
                    src={v.image}
                    alt={v.name}
                    width={150}
                    height={210}
                    className={styles.variantImg}
                    unoptimized
                  />
                ) : (
                  <div className={styles.variantNoImg}>🃏</div>
                )}
                <div className={styles.variantInfo}>
                  <div className={styles.variantName}>{v.name}</div>
                  {v.avgPrice && v.avgPrice > 0 && (
                    <div className={styles.variantPrice}>
                      ${v.avgPrice.toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MARKETPLACE LISTINGS
      ════════════════════════════════════════ */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🏪 Available Listings</h2>
        {listings.length > 0 ? (
          <div className={styles.listingsGrid}>
            {listings.map((l) => (
              <div key={l.id} className={styles.listingCard}>
                <div className={styles.listingHeader}>
                  <div className={styles.listingPrice}>
                    ${l.price.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  {l.condition && (
                    <span className={styles.listingCond}>{l.condition}</span>
                  )}
                </div>
                <div className={styles.listingSeller}>
                  <span
                    className={styles.sellerRating}
                    title={`${l.sellerRating ?? 5}/5 stars`}
                  >
                    {starRating(l.sellerRating ?? 5)}
                  </span>
                  <span>{l.userName}</span>
                </div>
                {l.grade && (
                  <div>
                    <span className={styles.saleGrade}>{l.grade}</span>
                  </div>
                )}
                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  onClick={() => router.push(`/dashboard/marketplace/${l.id}`)}
                >
                  View Listing →
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>
              No active listings for this card.
            </p>
            <button className="btn-primary" onClick={handleSellCard}>
              Be the first to sell
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          CARD METADATA
      ════════════════════════════════════════ */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📋 Card Info</h2>
        <div className={styles.metaGrid}>
          {[
            { key: "Name", val: card.name },
            { key: "Set", val: card.set || "—" },
            { key: "Year", val: card.year?.toString() || "—" },
            { key: "Card #", val: card.number || "—" },
            { key: "Rarity", val: card.rarity || "—" },
            { key: "Artist", val: card.artist || "—" },
            { key: "Game", val: card.game || "—" },
            {
              key: "Market Price",
              val: marketData?.marketPrice
                ? `$${marketData.marketPrice.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}`
                : "—",
            },
          ].map((m) => (
            <div key={m.key} className={styles.metaItem}>
              <div className={styles.metaKey}>{m.key}</div>
              <div className={styles.metaVal}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
