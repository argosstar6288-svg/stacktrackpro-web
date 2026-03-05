"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, deleteCard, calculatePortfolioStats, updateCard, Card, useUserFolders, addCardToFolder } from "../lib/cards";
import { CardModal } from "./CardModal";
import "./collection.css";

interface CollectionManagerProps {
  sportFilter?: string | null;
  folderId?: string;
}

// Data source search functions
async function searchPriceCharting(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 PriceCharting: searching sports card database for "${cleanName}"`);
    
    const searchPatterns = [
      cleanName,
      cleanName.replace(/\s+\d{4}$/, ""),
      cleanName.split(" ").slice(0, 3).join(" "),
    ];

    for (const pattern of searchPatterns) {
      try {
        const url = `https://www.pricecharting.com/api/product?t=${encodeURIComponent(pattern)}`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        if (data.image_url || data.image || data.photo_url || data.thumbnail) {
          const imageUrl = data.image_url || data.image || data.photo_url || data.thumbnail;
          console.log(`      ✅ Success! Found on PriceCharting`);
          return imageUrl;
        }
        
        if (data.products?.length > 0) {
          const product = data.products[0];
          if (product.image_url || product.image || product.photo) {
            console.log(`      ✅ Success! Found on PriceCharting`);
            return product.image_url || product.image || product.photo;
          }
        }
      } catch (err) {
        continue;
      }
    }
    
    console.log(`    ⏭️  PriceCharting: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  PriceCharting: skipping (error)`);
  }
  return null;
}

async function searchTradingCardDatabase(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Trading Card Database: searching "${cleanName}"`);
    
    const searchPatterns = [
      cleanName,
      cleanName.split(" ").slice(0, 2).join(" "),
      cleanName.split(" ")[0],
    ];

    for (const pattern of searchPatterns) {
      try {
        // Trading Card Database API endpoint
        const url = `https://www.tcgdatabase.com/api/card/search?q=${encodeURIComponent(pattern)}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.cards?.length > 0) {
          const card = data.cards[0];
          if (card.image || card.image_url || card.imageUrl) {
            console.log(`      ✅ Success! Found "${card.name}" on Trading Card Database`);
            return card.image || card.image_url || card.imageUrl;
          }
        }
      } catch (err) {
        continue;
      }
    }
    
    console.log(`    ⏭️  Trading Card Database: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  Trading Card Database: skipping (error)`);
  }
  return null;
}

async function searchTCGPlayer(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 TCGPlayer: searching "${cleanName}"`);
    
    // TCGPlayer official API endpoint
    const url = `https://api.tcgplayer.com/v1.32.0/search/products?q=${encodeURIComponent(cleanName)}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results?.length > 0) {
      const product = data.results[0];
      
      // Try to fetch product details for image
      if (product.productId) {
        try {
          const detailUrl = `https://api.tcgplayer.com/v1.32.0/products/${product.productId}`;
          const detailResponse = await fetch(detailUrl);
          const detailData = await detailResponse.json();
          
          if (detailData.data?.image || detailData.data?.smallImage) {
            console.log(`      ✅ Success! Found "${detailData.data.name}" on TCGPlayer`);
            return detailData.data.image || detailData.data.smallImage;
          }
        } catch (err) {
          // Continue with alternative image source if detail fetch fails
        }
      }
    }
    
    console.log(`    ⏭️  TCGPlayer: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  TCGPlayer: skipping (error)`);
  }
  return null;
}

// Multi-source image search function - consolidated to 3 primary sources
async function searchMultipleSources(cardName: string, cardNumber?: string): Promise<string | null> {
  try {
    const searchQuery = cardNumber 
      ? `${cardNumber} ${cardName}` 
      : cardName;
    
    console.log(`\n🔍 Searching for image: "${searchQuery}"`);

    // Clean name
    let cleanName = cardName
      .replace(/\bPokémon\s+Card\b/gi, "")
      .replace(/\bPokemon\s+Card\b/gi, "")
      .replace(/\bPokemon\s+GO\s+Card\b/gi, "")
      .replace(/\s+V\s*$/gi, "")
      .replace(/\s+EX\s*$/gi, "")
      .replace(/\s+VMAX\s*$/gi, "")
      .replace(/\s+VSTAR\s*$/gi, "")
      .replace(/\s+-\s+.+$/gi, "")
      .replace(/\s+Single\s+Strike\s*$/gi, "")
      .replace(/\s+Rapid\s+Strike\s*$/gi, "")
      .trim();

    console.log(`  📝 Cleaned name: "${cleanName}"`);
    if (cardNumber) console.log(`  🏷️  Card number: "${cardNumber}"`);
    console.log(`  🌐 Searching across 3 primary databases...`);

    // Try sources in order: PriceCharting, Trading Card Database, TCGPlayer
    const sources = [
      searchPriceCharting,
      searchTradingCardDatabase,
      searchTCGPlayer,
    ];

    for (const source of sources) {
      const result = await source(cleanName);
      if (result) return result;
    }

    console.log(`  ❌ No image found in any database\n`);
    return null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

export function CollectionManager({ sportFilter, folderId }: CollectionManagerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { cards, loading: cardsLoading } = useUserCards();
  const { folders } = useUserFolders();
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "value" | "date">("name");
  const [filterSport, setFilterSport] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingImages, setUpdatingImages] = useState<Set<string>>(new Set());

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

  const handleDelete = async (cardId: string) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      try {
        await deleteCard(cardId);
      } catch (err: any) {
        alert("Failed to delete card: " + err.message);
      }
    }
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setShowModal(true);
  };

  const handleAddToFolder = async (card: Card, folderId: string) => {
    if (!folderId) return;

    if (card.folderIds?.includes(folderId)) {
      alert("Card is already in this folder");
      return;
    }

    try {
      await addCardToFolder(card.id, folderId);
      alert("Card added to folder");
    } catch (err: any) {
      alert("Failed to add card to folder: " + err.message);
    }
  };

  const handleUpdateImage = async (card: Card) => {
    setUpdatingImages(prev => new Set(prev).add(card.id));
    
    try {
      const imageUrl = await searchMultipleSources(card.name, card.cardNumber);
      
      if (imageUrl) {
        await updateCard(card.id, { imageUrl });
        alert(`✓ Image found and updated for "${card.name}"`);
      } else {
        alert(`✗ No image found for "${card.name}". Try the CSV upload or add manually.`);
      }
    } catch (error) {
      console.error("Error updating image:", error);
      alert("Failed to update image");
    } finally {
      setUpdatingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCard(null);
  };

  const resolveCardImageUrl = (card: Card) => {
    const isRenderableImageUrl = (value?: string) => {
      if (!value || typeof value !== "string") return false;
      const trimmed = value.trim();
      return (
        trimmed.startsWith("https://") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("/")
      );
    };

    const imageCandidates = [
      card.imageUrl,
      card.photoUrl,
      card.frontImageUrl,
      card.thumbnailUrl,
      (card as any).cardImage,
      (card as any).image,
      (card as any).imagePath,
    ];

    const selected = imageCandidates.find((candidate) => isRenderableImageUrl(candidate));
    return selected || "/placeholder-card.svg";
  };

  // Filter and sort cards
  const filteredCards = cards.filter((card) => {
    // Apply folder filter if specified
    if (folderId) {
      const inFolder = card.folderIds?.includes(folderId);
      if (!inFolder) return false;
    }
    
    // Apply sport filter from sidebar OR dropdown
    const matchesSport = sportFilter 
      ? card.sport === sportFilter
      : (filterSport === "All" || card.sport === filterSport);
    const matchesSearch =
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.player.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "value") return b.value - a.value;
    if (sortBy === "date") return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    return 0;
  });

  const stats = calculatePortfolioStats(cards);
  const sports = Array.from(new Set(cards.map((c) => c.sport)));

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="collection-container">
        <div className="collection-header">
          <div className="stats-summary">
            <p>{stats.cardCount} cards • ${stats.totalValue.toLocaleString()} total value</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Value</div>
            <div className="stat-value">${stats.totalValue.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cards</div>
            <div className="stat-value">{stats.cardCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Average Value</div>
            <div className="stat-value">${stats.averageValue.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Highest Value</div>
            <div className="stat-value">${stats.highestValue.toLocaleString()}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name or player..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Sport:</label>
            <select value={filterSport} onChange={(e) => setFilterSport(e.target.value)}>
              <option>All</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="name">Name (A-Z)</option>
              <option value="value">Value (High-Low)</option>
              <option value="date">Date Added (Newest)</option>
            </select>
          </div>
        </div>

        {/* Cards Table */}
        <div className="cards-table-container">
          {cardsLoading ? (
            <div className="loading">Loading cards...</div>
          ) : sortedCards.length > 0 ? (
            <table className="cards-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Card</th>
                  <th>Card #</th>
                  <th>Player</th>
                  <th>Sport</th>
                  <th>Year</th>
                  <th>Brand</th>
                  <th>Condition</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedCards.map((card) => (
                  <tr
                    key={card.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer!.effectAllowed = "move";
                      e.dataTransfer!.setData("cardId", card.id);
                      e.dataTransfer!.setData("cardName", card.name);
                    }}
                    style={{
                      cursor: "grab",
                      opacity: 1,
                      transition: "opacity 0.2s",
                    }}
                    onDragOver={(e) => {
                      e.currentTarget.style.opacity = "0.6";
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    <td>
                      <img
                        src={resolveCardImageUrl(card)}
                        alt={card.name}
                        className="collection-card-thumb"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (target.src.endsWith("/placeholder-card.svg")) return;
                          target.src = "/placeholder-card.svg";
                        }}
                      />
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{card.name}</div>
                        <div style={{ fontSize: "0.85em", color: "#999", marginTop: 4 }}>
                          {card.rarity}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.9em", color: "#10b3f0", fontWeight: "500" }}>
                      {card.cardNumber || "—"}
                    </td>
                    <td>{card.player}</td>
                    <td>{card.sport}</td>
                    <td>{card.year}</td>
                    <td>{card.brand}</td>
                    <td>{card.condition}</td>
                    <td style={{ color: "#ff7a47", fontWeight: "bold" }}>${card.value.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {resolveCardImageUrl(card) === "/placeholder-card.svg" && (
                          <button
                            onClick={() => handleUpdateImage(card)}
                            disabled={updatingImages.has(card.id)}
                            className="action-btn"
                            title="Search for image online"
                            style={{
                              background: updatingImages.has(card.id) 
                                ? "rgba(100,100,100,0.3)" 
                                : "rgba(100, 200, 255, 0.2)",
                              border: "1px solid rgba(100, 200, 255, 0.4)",
                              color: updatingImages.has(card.id) ? "#999" : "#10b3f0",
                              cursor: updatingImages.has(card.id) ? "not-allowed" : "pointer",
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                            }}
                          >
                            {updatingImages.has(card.id) ? "🔄" : "🖼️ Find Image"}
                          </button>
                        )}
                        <select
                          defaultValue=""
                          onChange={async (e) => {
                            const selectedFolderId = e.target.value;
                            await handleAddToFolder(card, selectedFolderId);
                            e.target.value = "";
                          }}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "white",
                            borderRadius: 6,
                            padding: "4px 6px",
                            fontSize: "0.8rem",
                            maxWidth: 130,
                          }}
                        >
                          <option value="">+ Folder</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleEdit(card)}
                          className="action-btn edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(card.id)}
                          className="action-btn delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No cards in your collection yet.</p>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  marginTop: 16,
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #ff7a47, #ff2f92)",
                  color: "#0b0915",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Add Your First Card
              </button>
            </div>
          )}
        </div>
      </div>

      <CardModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={() => setEditingCard(null)}
        initialCard={editingCard || undefined}
        isEditing={!!editingCard}
      />
    </>
  );
}
