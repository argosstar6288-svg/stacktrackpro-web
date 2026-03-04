"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getCardsInFolder, removeCardFromFolder, type Card, type Folder } from "@/lib/cards";
import styles from "../../collection.module.css";

export default function FolderViewPage() {
  const router = useRouter();
  const params = useParams();
  const folderId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Load folder and cards
  useEffect(() => {
    if (!userId || !folderId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Get folder details
        const folderDoc = await getDoc(doc(db, "folders", folderId));
        if (!folderDoc.exists()) {
          router.push("/dashboard/collection");
          return;
        }

        const folderData = { id: folderDoc.id, ...folderDoc.data() } as Folder;

        // Check permissions
        if (folderData.userId !== userId) {
          router.push("/dashboard/collection");
          return;
        }

        setFolder(folderData);

        // Get cards in folder
        const folderCards = await getCardsInFolder(folderId, userId);
        setCards(folderCards);
      } catch (error) {
        console.error("Error loading folder:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, folderId, router]);

  const handleRemoveCard = async (cardId: string) => {
    if (!userId || !folderId) return;

    if (!confirm("Remove this card from the folder?")) return;

    try {
      await removeCardFromFolder(cardId, folderId);
      setCards(cards.filter((c) => c.id !== cardId));
    } catch (error) {
      console.error("Error removing card:", error);
      alert("Failed to remove card from folder");
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading folder...</div>;
  }

  if (!folder) {
    return <div className={styles.loading}>Folder not found</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <button 
            onClick={() => router.back()}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              cursor: "pointer",
              marginBottom: "1rem",
            }}
          >
            ← Back to Collection
          </button>
          <p className={styles.eyebrow}>Folder</p>
          <h1 className={styles.title}>{folder.name}</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: "0.5rem" }}>
            {cards.length} {cards.length === 1 ? "card" : "cards"} in this folder
          </p>
        </div>
      </div>

      <section className={`panel ${styles.panel}`}>
        {cards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.6)" }}>
            No cards in this folder yet.
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {cards.map((card) => (
              <div key={card.id} className={styles.cardItem}>
                <div className={styles.cardImageWrapper}>
                  <img
                    src={card.imageUrl || card.photoUrl || card.frontImageUrl || card.thumbnailUrl || "/placeholder-card.png"}
                    alt={card.name}
                    className={styles.cardImage}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder-card.png";
                    }}
                  />
                </div>
                <div className={styles.cardDetails}>
                  <h3 className={styles.cardName}>{card.name}</h3>
                  {card.year && <p className={styles.cardMeta}>Year: {card.year}</p>}
                  {card.condition && <p className={styles.cardMeta}>Condition: {card.condition}</p>}
                  {card.value && (
                    <p className={styles.cardValue}>${card.value.toLocaleString()}</p>
                  )}
                  <button
                    onClick={() => handleRemoveCard(card.id!)}
                    className={styles.removeBtn}
                  >
                    Remove from Folder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
