"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { CollectionManager } from "../../components/CollectionManager";
import { RefreshCollectionButton } from "@/components/RefreshCollectionButton";
import { useUserCards, useUserFolders, createFolder, deleteFolder, addCardToFolder, updateFolderVisibility, type Folder } from "@/lib/cards";
import { formatCurrency } from "@/lib/currency";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { useCurrency } from "@/hooks/useCurrency";
import StatCard from "@/components/StatCard";
import styles from "./collection.module.css";

const sportCategories = [
  { id: "baseball", name: "⚾ Baseball", sport: "Baseball" },
  { id: "basketball", name: "🏀 Basketball", sport: "Basketball" },
  { id: "football", name: "🏈 Football", sport: "Football" },
  { id: "hockey", name: "🏒 Hockey", sport: "Hockey" },
  { id: "soccer", name: "⚽ Soccer", sport: "Soccer" },
  { id: "pokemon", name: "🎴 Pokemon/Other", sport: "Other" },
];

const tradingCardCategories = [
  { id: "yugioh", name: "🃏 Yu-Gi-Oh!", icon: "🃏" },
  { id: "magic", name: "✨ Magic: The Gathering", icon: "✨" },
  { id: "marvel", name: "🦸 Marvel", icon: "🦸" },
  { id: "onepiece", name: "🏴‍☠️ One Piece", icon: "🏴‍☠️" },
  { id: "dragonball", name: "🐉 Dragon Ball Z", icon: "🐉" },
];

export default function CollectionPage() {
  const router = useRouter();
  const { currency } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { folders, loading: foldersLoading, refreshFolders } = useUserFolders();
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderVisibilityFilter, setFolderVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [scanSaveMessage, setScanSaveMessage] = useState("");
  const { cards, loading: cardsLoading } = useUserCards();
  const [listingCount, setListingCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const collectionValue = useMemo(
    () => cards.reduce((sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0), 0),
    [cards]
  );

  const customFolders = folders.filter(
    (folder) => !tradingCardCategories.some((category) => category.name === folder.name)
  );

  const visibleCustomFolders = customFolders.filter((folder) => {
    if (folderVisibilityFilter === "public") return Boolean(folder.isPublic);
    if (folderVisibilityFilter === "private") return !folder.isPublic;
    return true;
  });

  // Quick-create a default folder
  const handleQuickCreateFolder = async (folderName: string) => {
    if (!userId) return;

    // Check if folder already exists
    const folderExists = folders.some(f => f.name === folderName);
    if (folderExists) {
      setSelectedFolder(folders.find(f => f.name === folderName)?.id || null);
      setSelectedSport(null);
      return;
    }

    try {
      const folderId = await createFolder(userId, folderName);
      setSelectedFolder(folderId);
      setSelectedSport(null);
      await refreshFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userId) {
      setListingCount(0);
      setWatchlistCount(0);
      setStatsLoading(false);
      return;
    }

    const loadCounts = async () => {
      setStatsLoading(true);
      try {
        const [listingsSnapshot, watchlistSnapshot] = await Promise.all([
          getDocs(query(collection(db, FLAT_COLLECTIONS.marketListings), where("userId", "==", userId), limit(100))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, FLAT_COLLECTIONS.watchlists), where("userID", "==", userId), limit(100))).catch(() => ({ docs: [] } as any)),
        ]);

        setListingCount(listingsSnapshot.docs.length || 0);
        setWatchlistCount(watchlistSnapshot.docs.length || 0);
      } catch (error) {
        console.error("Error loading collection stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    void loadCounts();
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const savedFromScan = params.get("savedFromScan");
    const savedCountRaw = params.get("savedCount");
    const savedCount = Number(savedCountRaw || 0);

    if (savedFromScan !== "1" || !Number.isFinite(savedCount) || savedCount <= 0) {
      return;
    }

    setScanSaveMessage(
      `Saved ${savedCount} scanned card${savedCount > 1 ? "s" : ""} to your collection.`
    );
    router.replace("/dashboard/collection", { scroll: false });
  }, [router]);

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return;

    setCreating(true);
    try {
      await createFolder(userId, newFolderName);
      setNewFolderName("");
      setShowNewFolderInput(false);
      await refreshFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Cards will not be deleted.`)) return;

    try {
      await deleteFolder(folderId);
      await refreshFolders();
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder");
    }
  };

  const handleToggleFolderVisibility = async (folder: Folder) => {
    if (!folder.id) return;

    const nextVisibility = !folder.isPublic;
    try {
      await updateFolderVisibility(folder.id, nextVisibility);
      await refreshFolders();
    } catch (error) {
      console.error("Error updating folder visibility:", error);
      alert("Failed to update folder visibility");
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Collection</p>
          <h1 className={styles.title}>Your Collection</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <input type="text" placeholder="Quick search..." />
          </div>
          <Link className={styles.addButton} href="/dashboard/share?mode=collection">
            Share Collection
          </Link>
          <button 
            className={styles.addButton}
            onClick={() => router.push('/dashboard/scan')}
          >
            + Add Card
          </button>
        </div>
      </div>

      <div className={styles.statsStrip}>
        <StatCard
          label="Collection Value"
          value={formatCurrency(collectionValue, currency)}
          loading={statsLoading}
        />
        <StatCard label="Cards" value={cards.length} loading={cardsLoading} />
        <StatCard label="Folders" value={folders.length} loading={foldersLoading} />
        <StatCard label="Listings" value={listingCount} loading={statsLoading} />
        <StatCard label="Watchlist" value={watchlistCount} loading={statsLoading} />
      </div>

      {scanSaveMessage && (
        <div className={styles.scanSavedToast} role="status" aria-live="polite">
          <span>{scanSaveMessage}</span>
          <button
            type="button"
            className={styles.scanSavedToastClose}
            onClick={() => setScanSaveMessage("")}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.valueInfoBanner}>
        <span className={styles.valueInfoText}>
          Collection prices are refreshed from PriceCharting and displayed in Canadian dollars.
        </span>
        <Link href="/dashboard/help/how-values-work" className={styles.valueInfoLink}>
          Learn how StackTrack values cards
        </Link>
      </div>

      {/* REFRESH BUTTON */}
      <RefreshCollectionButton />

      <div className="flex gap-4 mb-4 flex-wrap">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setSelectedSport("Other");
            setSelectedFolder(null);
          }}
        >
          Pokemon
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setSelectedSport(null);
            setSelectedFolder(null);
          }}
        >
          Sports
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void handleQuickCreateFolder("✨ Magic: The Gathering");
          }}
        >
          Magic
        </button>
      </div>

      <div className={styles.layout}>
        {/* Sidebar with folders */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>📁 Folders</h3>
            <button
              className={styles.newFolderBtn}
              onClick={() => setShowNewFolderInput(!showNewFolderInput)}
            >
              +
            </button>
          </div>

          {showNewFolderInput && (
            <div className={styles.newFolderInput}>
              <input
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolderInput(false);
                    setNewFolderName("");
                  }
                }}
                autoFocus
              />
              <button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
                {creating ? "..." : "✓"}
              </button>
              <button onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName("");
              }}>
                ✕
              </button>
            </div>
          )}

          <div className={styles.folderList}>
            <button
              className={`${styles.folderItem} ${!selectedSport && !selectedFolder ? styles.active : ""}`}
              onClick={() => {
                setSelectedSport(null);
                setSelectedFolder(null);
              }}
            >
              <span>📋</span> All Cards
            </button>

            {/* Sport Category Folders */}
            <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              <div className={styles.sectionLabel}>
                By Sport
              </div>
              {sportCategories.map((category) => (
                <button
                  key={category.id}
                  className={`${styles.folderItem} ${selectedSport === category.sport ? styles.active : ""}`}
                  onClick={() => {
                    setSelectedSport(category.sport);
                    setSelectedFolder(null);
                  }}
                >
                  <span>{category.name}</span>
                </button>
              ))}
            </div>

            {/* Trading Card Game Categories */}
            <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              <div className={styles.sectionLabel}>
                Trading Card Games
              </div>
              {tradingCardCategories.map((category) => {
                const folderExists = folders.find(f => f.name === category.name);
                return (
                  <div
                    key={category.id}
                    className={styles.folderItem}
                    onDragOver={(e) => {
                      if (folderExists) {
                        e.preventDefault();
                        e.currentTarget.style.backgroundColor = "rgba(30, 144, 255, 0.3)";
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onDrop={async (e) => {
                      if (!folderExists) return;
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = "transparent";
                      const cardId = e.dataTransfer?.getData("cardId");
                      const cardName = e.dataTransfer?.getData("cardName");
                      if (cardId && folderExists.id) {
                        try {
                          await addCardToFolder(cardId, folderExists.id);
                          alert(`✓ Added "${cardName}" to ${folderExists.name}`);
                        } catch (err: any) {
                          alert(`Failed to add card: ${err.message}`);
                        }
                      }
                    }}
                  >
                    <button
                      className={`${styles.folderBtn} ${selectedFolder === folderExists?.id ? styles.active : ""}`}
                      onClick={() => handleQuickCreateFolder(category.name)}
                      title={folderExists ? "View folder" : "Click to create folder"}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <span>{category.icon}</span> {category.name.replace(/^[^\s]+ /, '')}
                      {!folderExists && <span style={{ fontSize: "0.75rem", opacity: 0.6, marginLeft: "auto" }}>+</span>}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Custom Folders */}
            {customFolders.length > 0 && (
              <div className={styles.sectionLabel}>
                My Folders
              </div>
            )}

            {customFolders.length > 0 && (
              <div className={styles.visibilityFilterRow}>
                <button
                  type="button"
                  className={`${styles.visibilityFilterBtn} ${folderVisibilityFilter === "all" ? styles.visibilityFilterBtnActive : ""}`}
                  onClick={() => setFolderVisibilityFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`${styles.visibilityFilterBtn} ${folderVisibilityFilter === "public" ? styles.visibilityFilterBtnActive : ""}`}
                  onClick={() => setFolderVisibilityFilter("public")}
                >
                  Public
                </button>
                <button
                  type="button"
                  className={`${styles.visibilityFilterBtn} ${folderVisibilityFilter === "private" ? styles.visibilityFilterBtnActive : ""}`}
                  onClick={() => setFolderVisibilityFilter("private")}
                >
                  Private
                </button>
              </div>
            )}

            {foldersLoading ? (
              <div className={styles.folderLoading}>Loading folders...</div>
            ) : customFolders.length === 0 ? (
              <div className={styles.noFolders}>No folders yet</div>
            ) : visibleCustomFolders.length === 0 ? (
              <div className={styles.noFolders}>No folders match this filter</div>
            ) : (
              visibleCustomFolders.map((folder) => {
                return (
                  <div
                    key={folder.id}
                    className={styles.folderItem}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = "rgba(30, 144, 255, 0.3)";
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = "transparent";
                      const cardId = e.dataTransfer?.getData("cardId");
                      const cardName = e.dataTransfer?.getData("cardName");
                      if (cardId && folder.id) {
                        try {
                          await addCardToFolder(cardId, folder.id);
                          alert(`✓ Added "${cardName}" to ${folder.name}`);
                        } catch (err: any) {
                          alert(`Failed to add card: ${err.message}`);
                        }
                      }
                    }}
                  >
                    <button
                      className={`${styles.folderBtn} ${selectedFolder === folder.id ? styles.active : ""}`}
                      onClick={() => {
                        setSelectedFolder(folder.id || null);
                        setSelectedSport(null);
                      }}
                    >
                      <span>📁</span> {folder.name}
                    </button>
                    <button
                      className={styles.visibilityBtn}
                      onClick={() => handleToggleFolderVisibility(folder)}
                      title={folder.isPublic ? "Make private" : "Make public"}
                    >
                      {folder.isPublic ? "Public" : "Private"}
                    </button>
                    <button
                      className={styles.deleteFolderBtn}
                      onClick={() => handleDeleteFolder(folder.id!, folder.name)}
                      title="Delete folder"
                    >
                      🗑
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main content */}
        <section className={`panel ${styles.panel}`}>
          <CollectionManager 
            sportFilter={selectedSport} 
            folderId={selectedFolder || undefined}
          />
        </section>
      </div>
    </div>
  );
}
