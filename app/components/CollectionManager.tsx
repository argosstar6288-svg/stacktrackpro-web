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

// Multi-source image search function
async function searchMultipleSources(cardName: string): Promise<string | null> {
  try {
    console.log(`\n🔍 Searching for: "${cardName}"`);

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

    console.log(`  Cleaned: "${cleanName}"`);

    const searches = [cleanName, cleanName.split(" ").slice(0, 2).join(" "), cleanName.split(" ")[0]];

    // Try PokéTCG API
    for (const searchName of searches) {
      if (!searchName) continue;

      try {
        let url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(searchName)}"`;
        let response = await fetch(url);
        let data = await response.json();

        if (data.data?.length > 0 && data.data[0].images?.small) {
          console.log(`  ✓ Found in PokéTCG`);
          return data.data[0].images.small;
        }

        url = `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(searchName)}*`;
        response = await fetch(url);
        data = await response.json();

        if (data.data?.length > 0 && data.data[0].images?.small) {
          console.log(`  ✓ Found in PokéTCG (fuzzy)`);
          return data.data[0].images.small;
        }
      } catch (error) {
        // Continue to next source
      }
    }

    // Try Scryfall for Magic cards
    try {
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`"${cleanName}"`)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.data?.length > 0 && data.data[0].image_uris?.normal) {
        console.log(`  ✓ Found in Scryfall`);
        return data.data[0].image_uris.normal;
      }
    } catch (error) {
      // Continue
    }

    // Try PriceCharting for sports cards
    try {
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
            console.log(`  ✓ Found in PriceCharting`);
            return data.image_url || data.image || data.photo_url || data.thumbnail;
          }
          
          if (data.products?.length > 0) {
            const product = data.products[0];
            if (product.image_url || product.image || product.photo) {
              console.log(`  ✓ Found in PriceCharting (products)`);
              return product.image_url || product.image || product.photo;
            }
          }
        } catch (err) {
          continue;
        }
      }
    } catch (error) {
      // Continue
    }

    // Try YGOProDeck for Yu-Gi-Oh
    try {
      const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(cleanName)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.data?.length > 0 && data.data[0].card_images?.[0]?.image_url) {
        console.log(`  ✓ Found in YGOProDeck`);
        return data.data[0].card_images[0].image_url;
      }
    } catch (error) {
      // Continue
    }

    console.log(`  ✗ Not found\n`);
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
      const imageUrl = await searchMultipleSources(card.name);
      
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
