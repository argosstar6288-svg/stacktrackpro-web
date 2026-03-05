"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CollectionManager } from "../../components/CollectionManager";
import { RefreshCollectionButton } from "@/components/RefreshCollectionButton";
import { useUserFolders, createFolder, deleteFolder, addCardToFolder, type Folder } from "@/lib/cards";
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
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { folders, loading: foldersLoading } = useUserFolders();
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

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

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return;

    setCreating(true);
    try {
      await createFolder(userId, newFolderName);
      setNewFolderName("");
      setShowNewFolderInput(false);
      // Folders will auto-refresh via the hook
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
      // Folders will auto-refresh via the hook
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder");
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
          <button 
            className={styles.addButton}
            onClick={() => router.push('/dashboard/collection/add')}
          >
            + Add Card
          </button>
        </div>
      </div>

      {/* REFRESH BUTTON */}
      <RefreshCollectionButton />

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
            {folders.length > 0 && (
              <div className={styles.sectionLabel}>
                My Folders
              </div>
            )}

            {foldersLoading ? (
              <div className={styles.folderLoading}>Loading folders...</div>
            ) : folders.length === 0 ? (
              <div className={styles.noFolders}>No folders yet</div>
            ) : (
              folders.map((folder) => {
                // Skip folders that are in the trading card categories (they're shown above)
                const isDefaultFolder = tradingCardCategories.some(cat => cat.name === folder.name);
                if (isDefaultFolder) return null;
                
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
