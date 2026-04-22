"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { formatCurrency } from "@/lib/currency";
import { useCurrency } from "@/hooks/useCurrency";
import CardDetailModal from "./CardDetailModal";
import styles from "./CollectionManager.module.css";

interface Card {
  id: string;
  name: string;
  image?: string;
  imageUrl?: string;
  imageURL?: string;
  set?: string;
  cardNumber?: string;
  marketPrice?: number;
  grade?: string;
  value?: number;
}

interface CollectionManagerProps {
  sportFilter?: string;
  folderId?: string;
}

export function CollectionManager({ sportFilter, folderId }: CollectionManagerProps) {
  const { user } = useCurrentUser();
  const { currency } = useCurrency();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadCards = async () => {
      setLoading(true);
      try {
        const userCardsRef = collection(db, FLAT_COLLECTIONS.userCards);
        const q = query(
          userCardsRef,
          where("userID", "==", user.uid),
          orderBy("addedAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const loadedCards: Card[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          
          // Filter by sport if specified
          if (sportFilter && data.sport !== sportFilter) {
            continue;
          }

          // Filter by folder if specified
          if (folderId && (!data.folders || !data.folders.includes(folderId))) {
            continue;
          }

          loadedCards.push({
            id: doc.id,
            name: data.cardName || data.name || "Unknown",
            image: data.image || data.imageUrl || data.imageURL,
            set: data.set || data.setName || "",
            cardNumber: data.cardNumber || data.number || "",
            marketPrice: Number(data.marketPrice || data.avgPrice || data.value || 0),
            grade: data.grade,
            value: Number(data.value || 0),
          });
        }

        setCards(loadedCards);
      } catch (error) {
        console.error("Error loading cards:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, [user?.uid, sportFilter, folderId]);

  const filteredCards = useMemo(() => {
    if (!searchTerm.trim()) return cards;
    return cards.filter(
      (card) =>
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.set?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [cards, searchTerm]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.count}>
            {filteredCards.length} {filteredCards.length === 1 ? "card" : "cards"}
          </p>
        </div>
        <div className={styles.search}>
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading cards...</div>
      ) : filteredCards.length === 0 ? (
        <div className={styles.empty}>
          <p>No cards found</p>
          {!searchTerm && <p style={{ fontSize: "12px", opacity: 0.6 }}>Add cards to get started</p>}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredCards.map((card) => (
            <button
              key={card.id}
              className={styles.card}
              onClick={() => setSelectedCardId(card.id)}
              title={`${card.name} - ${formatCurrency(card.marketPrice || 0, currency)}`}
            >
              <div className={styles.cardImage}>
                {card.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.image}
                    alt={card.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove(styles.hidden);
                    }}
                  />
                ) : null}
                <div className={styles.cardPlaceholder}>🃏</div>
              </div>

              <div className={styles.cardInfo}>
                <h3 className={styles.cardName}>{card.name}</h3>
                {card.set && <p className={styles.cardSet}>{card.set}</p>}
                <p className={styles.cardPrice}>
                  {formatCurrency(card.marketPrice || 0, currency)}
                </p>
                {card.grade && (
                  <p className={styles.cardGrade}>
                    <span className={styles.badge}>PSA {card.grade}</span>
                  </p>
                )}
              </div>

              <div className={styles.cardHover}>Click to view details</div>
            </button>
          ))}
        </div>
      )}

      <CardDetailModal
        cardId={selectedCardId || ""}
        isOpen={selectedCardId !== null}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
  );
}
