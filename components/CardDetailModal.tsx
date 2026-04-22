"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "@/lib/firebase";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { formatCurrency } from "@/lib/currency";
import { useCurrency } from "@/hooks/useCurrency";
import styles from "./CardDetailModal.module.css";

interface CardDetailModalProps {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PricePoint {
  date: string;
  price: number;
}

interface MarketData {
  marketPrice: number;
  change30d?: number;
  lastUpdated?: any;
  priceSource?: string;
}

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

export default function CardDetailModal({ cardId, isOpen, onClose }: CardDetailModalProps) {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (!isOpen || !cardId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch card data
        const cardRef = doc(db, FLAT_COLLECTIONS.cards, cardId);
        const cardSnap = await getDoc(cardRef);
        if (cardSnap.exists()) {
          setCardData(cardSnap.data());
        }

        // Fetch market data
        const mdRef = doc(db, FLAT_COLLECTIONS.cardMarketData, cardId);
        const mdSnap = await getDoc(mdRef);
        if (mdSnap.exists()) {
          const md = mdSnap.data();
          setMarketData({
            marketPrice: Number(md.marketPrice || md.avgPrice || md.price || 0),
            change30d: md.change30d,
            lastUpdated: md.lastUpdated,
            priceSource: md.priceSource || "PriceCharting",
          });
        } else {
          const card = cardSnap.data();
          setMarketData({
            marketPrice: Number(card?.avgPrice || card?.value || 0),
            priceSource: "PriceCharting",
          });
        }

        // Fetch 30-day price history
        try {
          const phRef = collection(db, FLAT_COLLECTIONS.priceHistory);
          const phQ = query(
            phRef,
            where("cardID", "==", cardId),
            where("date", ">=", new Date(Date.now() - 30 * 86400000)), // Last 30 days
            orderBy("date", "asc"),
            limit(100)
          );
          const phSnap = await getDocs(phQ);
          if (!phSnap.empty) {
            const pts: PricePoint[] = phSnap.docs.map((d) => ({
              date: formatShortDate(d.data().date),
              price: Number(d.data().price || 0),
            }));
            setPriceHistory(pts);
          }
        } catch (err) {
          console.log("Price history query error (may need index):", err);
        }
      } catch (err) {
        console.error("Error loading card details:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, cardId]);

  if (!isOpen) return null;

  const cardImage = cardData?.image || cardData?.imageUrl || cardData?.imageURL;
  const gradingStatus = cardData?.grade ? `PSA ${cardData.grade}` : "Ungraded";
  const priceChange = marketData?.change30d ?? 0;
  const valueDifference = priceHistory.length >= 2 
    ? priceHistory[priceHistory.length - 1].price - priceHistory[0].price
    : 0;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={styles.container}>
          {/* Left: Card Image */}
          <div className={styles.imageSection}>
            {loading ? (
              <div className={styles.skeleton}>Loading...</div>
            ) : cardImage ? (
              <img src={cardImage} alt={cardData?.name || "Card"} className={styles.cardImage} />
            ) : (
              <div className={styles.noImage}>🃏 No Image</div>
            )}
          </div>

          {/* Right: Details */}
          <div className={styles.detailsSection}>
            <div className={styles.header}>
              <div>
                <h2 className={styles.cardName}>{cardData?.name || "Unknown Card"}</h2>
                <p className={styles.cardMeta}>
                  {cardData?.set || "Unknown Set"} {cardData?.cardNumber && `#${cardData.cardNumber}`}
                </p>
              </div>
            </div>

            {/* Price Info */}
            <div className={styles.priceBox}>
              <div className={styles.priceRow}>
                <span className={styles.label}>Current Value</span>
                <span className={styles.value}>
                  {formatCurrency(marketData?.marketPrice || 0, currency)}
                </span>
              </div>
              {valueDifference !== 0 && (
                <div className={styles.priceRow}>
                  <span className={styles.label}>30-Day Change</span>
                  <span className={`${styles.value} ${valueDifference >= 0 ? styles.positive : styles.negative}`}>
                    {valueDifference >= 0 ? "+" : ""}{formatCurrency(valueDifference, currency)}
                    <span className={styles.percent}>
                      {priceChange >= 0 ? "+" : ""}{priceChange?.toFixed(1)}%
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Grading & Source */}
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Grading Status</span>
                <span className={styles.infoValue}>{gradingStatus}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Value Source</span>
                <span className={styles.infoValue}>{marketData?.priceSource || "PriceCharting"}</span>
              </div>
            </div>

            {marketData?.lastUpdated && (
              <div className={styles.lastUpdated}>
                Last updated: {formatDate(marketData.lastUpdated)}
              </div>
            )}

            {/* Card Description */}
            {cardData?.description && (
              <div className={styles.description}>
                <h3 className={styles.descriptionTitle}>Description</h3>
                <p className={styles.descriptionText}>{cardData.description}</p>
              </div>
            )}

            {/* 30-Day Price Chart */}
            {priceHistory.length > 1 && (
              <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>30-Day Price History</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.5)"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                      formatter={(value: any) => formatCurrency(Number(value), currency)}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#1e88e5"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
