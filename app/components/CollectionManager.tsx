"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, deleteCard, calculatePortfolioStats, updateCard, Card, useUserFolders, addCardToFolder } from "../lib/cards";
import { validatePokemonMatch } from "../lib/pokemon-stats";
import { searchCardsByName, searchCardsPartial } from "../lib/firestore-cards";
import { CardModal } from "./CardModal";
import "./collection.css";

interface CollectionManagerProps {
  sportFilter?: string | null;
  folderId?: string;
}

// Data source search functions
async function searchPokemonTCG(cleanName: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`    📍 Pokemon TCG (Firestore + API): searching for "${cleanName}"`);
    
    // Normalize search name - remove special variants
    const baseCardName = cleanName
      .replace(/\s*[-–]\s*ex\b/i, '')
      .replace(/\s*[-–]\s*v\b/i, '')
      .replace(/\s*[-–]\s*vmax\b/i, '')
      .replace(/\s*[-–]\s*vstar\b/i, '')
      .replace(/\s*[-–]\s*gx\b/i, '')
      .trim();
    
    // Step 1: Try exact match in Firestore (fastest)
    console.log(`       🔎 Firestore: Exact match ("${baseCardName}")...`);
    const exactMatches = await searchCardsByName(baseCardName, 10);
    if (exactMatches.length > 0) {
      for (const card of exactMatches) {
        if (card.images?.large || card.images?.small) {
          const imageUrl = card.images.large || card.images.small;
          console.log(`      ✅ Firestore EXACT match! "${card.name}" from ${card.setName}`);
          return imageUrl;
        }
      }
    }
    
    // Step 2: Try partial match in Firestore (still fast)
    console.log(`       🔎 Firestore: Fuzzy match...`);
    const partialMatches = await searchCardsPartial(baseCardName, undefined, 20);
    if (partialMatches.length > 0) {
      // Filter to get best matches based on name similarity
      const bestMatches = partialMatches.filter(card => {
        const cardNameLower = (card.name || "").toLowerCase();
        // Accept if card name contains our search terms OR our search contains card name
        return cardNameLower.includes(baseCardName.toLowerCase()) || 
               baseCardName.toLowerCase().includes(cardNameLower);
      });
      
      // Prefer cards with images, but accept any match
      const cardsWithImages = bestMatches.filter(c => c.images?.large || c.images?.small);
      const candidateCards = cardsWithImages.length > 0 ? cardsWithImages : bestMatches;
      
      if (candidateCards.length > 0) {
        const card = candidateCards[0];
        if (card.images?.large || card.images?.small) {
          const imageUrl = card.images.large || card.images.small;
          console.log(`      ✅ Firestore FUZZY match! "${card.name}" from ${card.setName}`);
          return imageUrl;
        }
      }
    }
    
    // Step 3: Fall back to Pokemon TCG API
    console.log(`       🔎 Firestore exhausted, trying Pokemon TCG API...`);
    const searchPatterns = [
      baseCardName,
      cleanName,  // Original name with variants
      cardNumber,
      baseCardName.split(" ")[0],
      cleanName.split(" ")[0],
    ].filter(Boolean);

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      if (!pattern || pattern.length < 2) continue;
      
      try {
        console.log(`       🔎 API Attempt ${i + 1}: "${pattern}"`);
        
        // Try exact match first
        let url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(pattern)}"&pageSize=10`;
        let response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.data?.length > 0) {
            for (const card of data.data) {
              if (card.images?.small || card.images?.large) {
                const imageUrl = card.images.large || card.images.small;
                console.log(`      ✅ API EXACT match! "${card.name}" from ${card.set.series}`);
                return imageUrl;
              }
            }
          }
        }
        
        // Try partial/fuzzy match
        url = `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(pattern)}*&pageSize=20`;
        response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.data?.length > 0) {
            for (const card of data.data) {
              if (card.images?.small || card.images?.large) {
                const imageUrl = card.images.large || card.images.small;
                console.log(`      ✅ API FUZZY match! "${card.name}"`);
                return imageUrl;
              }
            }
          }
        }
        
        console.log(`       ℹ️  No API matches for "${pattern}"`);
      } catch (err) {
        console.log(`       ⚠️  API request failed`);
        continue;
      }
    }
    
    console.log(`    ⏭️  Pokemon TCG: no images found in Firestore or API`);
  } catch (error) {
    console.log(`    ⏭️  Pokemon TCG: error`, error);
  }
  return null;
}

// Data source search functions
async function searchPriceCharting(cleanName: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`    📍 PriceCharting (Sports Cards): searching for "${cleanName}"`);
    
    // Prioritize search patterns: cardNumber + name first, then progressively shorter
    const searchPatterns = cardNumber 
      ? [
          `${cardNumber} ${cleanName}`,  // Most specific: "054/112 Pikachu"
          cleanName,                      // Full name
          cleanName.split(" ").slice(0, 2).join(" "),  // First 2 words
          cleanName.split(" ")[0],        // First word only
        ]
      : [
          cleanName,
          cleanName.replace(/\s+\d{4}$/, ""),
          cleanName.split(" ").slice(0, 3).join(" "),
        ];

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      if (!pattern || pattern.length < 2) continue;  // Skip empty or too-short patterns
      
      try {
        console.log(`       🔎 Attempt ${i + 1}/${searchPatterns.length}: "${pattern}"`);
        const url = `https://www.pricecharting.com/api/product?t=${encodeURIComponent(pattern)}`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          console.log(`       ⚠️  API returned status ${response.status}`);
          continue;
        }
        const data = await response.json();
        
        if (data.image_url || data.image || data.photo_url || data.thumbnail) {
          const imageUrl = data.image_url || data.image || data.photo_url || data.thumbnail;
          console.log(`      ✅ Match found! PriceCharting returned image URL`);
          return imageUrl;
        }
        
        if (data.products?.length > 0) {
          for (const product of data.products) {
            if (product.image_url || product.image || product.photo) {
              // Validate result relevance: check if product name contains key search terms
              const productName = (product.name || "").toLowerCase();
              const searchTerms = pattern.split(" ").filter(t => t.length > 2);
              const relevanceScore = searchTerms.filter(term => productName.includes(term.toLowerCase())).length;
              
              if (relevanceScore > 0 || cardNumber) {  // Accept if relevant OR if we have exact card number
                console.log(`      ✅ Match found! PriceCharting product image (relevance: ${relevanceScore}/${searchTerms.length} terms)`);
                return product.image_url || product.image || product.photo;
              }
            }
          }
        }
        
        console.log(`       ℹ️  No matching image found`);
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  PriceCharting: all attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  PriceCharting: skipped (unexpected error)`);
  }
  return null;
}

async function searchTradingCardDatabase(cleanName: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`    📍 Trading Card Database (Universal TCG): searching for "${cleanName}"`);
    
    // Prioritize exact matches first, then broader searches
    const searchPatterns = cardNumber 
      ? [
          `${cardNumber} ${cleanName}`,  // Most specific: "054/112 Pikachu"
          cleanName,                      // Full name
          cleanName.split(" ").slice(0, 2).join(" "),  // First 2 words
          cleanName.split(" ")[0],        // First word only
        ]
      : [
          cleanName,
          cleanName.split(" ").slice(0, 2).join(" "),
          cleanName.split(" ")[0],
        ];

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      if (!pattern || pattern.length < 2) continue;  // Skip empty or too-short patterns
      
      try {
        console.log(`       🔎 Attempt ${i + 1}/${searchPatterns.length}: "${pattern}"`);
        // Trading Card Database API endpoint - get multiple results to find best match
        const url = `https://www.tcgdatabase.com/api/card/search?q=${encodeURIComponent(pattern)}&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.cards?.length > 0) {
          // Search through results for best match
          for (const card of data.cards) {
            if (card.image || card.image_url || card.imageUrl) {
              // Validate: card name should contain key terms from search
              const cardName = (card.name || "").toLowerCase();
              const searchTerms = cleanName.split(" ").filter(t => t.length > 2);
              const relevanceScore = searchTerms.filter(term => cardName.includes(term.toLowerCase())).length;
              
              if (relevanceScore > 0 || cardNumber) {  // Accept if relevant OR if we have exact card number
                console.log(`      ✅ Match found! Located "${card.name}" (relevance: ${relevanceScore}/${searchTerms.length})`);
                return card.image || card.image_url || card.imageUrl;
              }
            }
          }
          // If we got results but no image, try next pattern
          console.log(`       ℹ️  Found ${data.cards.length} cards but no image data`);
        } else {
          console.log(`       ℹ️  No cards match "${pattern}"`);
        }
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  Trading Card Database: all attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  Trading Card Database: skipped (unexpected error)`);
  }
  return null;
}

async function searchTCGPlayer(cleanName: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`    📍 TCGPlayer (Official Platform): searching for "${cleanName}"`);
    
    // Build more specific search query with card number if available
    const searchQuery = cardNumber ? `${cardNumber} ${cleanName}` : cleanName;
    
    // Try multiple search variations
    const searchPatterns = [
      searchQuery,
      cleanName,
      cleanName.split(" ").slice(0, 2).join(" "),
    ];
    
    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      if (!pattern || pattern.length < 2) continue;
      
      try {
        console.log(`       🔎 Attempt ${i + 1}/${searchPatterns.length}: "${pattern}"`);
        const url = `https://api.tcgplayer.com/v1.32.0/search/products?q=${encodeURIComponent(pattern)}&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results?.length > 0) {
          // Try to find best matching product
          for (const product of data.results) {
            console.log(`       ℹ️  Checking: "${product.name || cleanName}"`);
            
            // Validate name relevance
            const productName = (product.name || "").toLowerCase();
            const searchTerms = cleanName.split(" ").filter(t => t.length > 2);
            const relevanceScore = searchTerms.filter(term => productName.includes(term.toLowerCase())).length;
            
            if (relevanceScore > 0 || cardNumber) {  // Accept if relevant OR if we have exact card number
              // Try to fetch product details for image
              if (product.productId) {
                try {
                  console.log(`       🔎 Fetching product details...`);
                  const detailUrl = `https://api.tcgplayer.com/v1.32.0/products/${product.productId}`;
                  const detailResponse = await fetch(detailUrl);
                  const detailData = await detailResponse.json();
                  
                  if (detailData.data?.image || detailData.data?.smallImage) {
                    console.log(`      ✅ Match found! TCGPlayer image (relevance: ${relevanceScore}/${searchTerms.length})`);
                    return detailData.data.image || detailData.data.smallImage;
                  }
                } catch (err) {
                  console.log(`       ⚠️  Could not fetch product ${product.productId}`);
                  continue;
                }
              }
            }
          }
          console.log(`       ℹ️  Found ${data.results.length} products but no matching image`);
        } else {
          console.log(`       ℹ️  No products found for "${pattern}"`);
        }
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  TCGPlayer: all attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  TCGPlayer: skipped (unexpected error)`);
  }
  return null;
}

// Multi-source image search function - consolidated to 3 primary sources
async function searchMultipleSources(cardName: string, cardNumber?: string): Promise<string | null> {
  try {
    const searchQuery = cardNumber 
      ? `${cardNumber} ${cardName}` 
      : cardName;
    
    console.log(`\n🔍 Image Search Started: "${searchQuery}"`);

    // Clean name - only remove metadata, preserve variant indicators (V, EX, VMAX differ)
    let cleanName = cardName
      .replace(/\bPokémon\s+Card\b/gi, "")          // Brand metadata
      .replace(/\bPokemon\s+Card\b/gi, "")          // Brand metadata
      .replace(/\bPokemon\s+GO\s+Card\b/gi, "")     // Specific product line
      .replace(/\s+Single\s+Strike\s*$/gi, "")      // Set variant (strategy, not card name)
      .replace(/\s+Rapid\s+Strike\s*$/gi, "")       // Set variant (strategy, not card name)
      .replace(/\s+-\s+[A-Z]{1,3}\s+Holo\b/gi, "") // Print variant
      .replace(/\s+Holo\s+Rare\b/gi, "")            // Print variant
      .trim();

    if (cardNumber) {
      console.log(`  📌 Card ID: ${cardNumber}`);
    }
    
    // Check if this is a Pokemon card and validate against database
    const pokemonMatch = validatePokemonMatch(cleanName);
    if (pokemonMatch) {
      console.log(`  🎮 Pokémon detected: ${pokemonMatch.name} (Type: ${pokemonMatch.type.join("/")})`);
      console.log(`  📊 Stats Total: ${pokemonMatch.total} | HP: ${pokemonMatch.hp}`);
      console.log(`  🔄 Prioritizing Pokemon TCG API for official card data...\n`);

      // Try Pokemon TCG API first for Pokemon cards - official source
      const pokemonTCGResult = await searchPokemonTCG(cleanName, cardNumber);
      if (pokemonTCGResult) return pokemonTCGResult;
    }
    
    console.log(`  📝 Searching for: "${cleanName}"`);
    console.log(`  🌐 Querying primary sources in order...\n`);

    // Try remaining sources: PriceCharting, Trading Card Database, TCGPlayer
    const sources = [
      { name: 'PriceCharting', fn: searchPriceCharting },
      { name: 'Trading Card Database', fn: searchTradingCardDatabase },
      { name: 'TCGPlayer', fn: searchTCGPlayer },
    ];

    for (const source of sources) {
      const result = await source.fn(cleanName, cardNumber);
      if (result) return result;
    }

    console.log(`  ❌ Image not found - all sources exhausted (try CSV upload or manual URL entry)\n`);
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
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAddingToFolder, setBulkAddingToFolder] = useState(false);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [alertCardIds, setAlertCardIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    const loadAlerts = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/card-alerts?userId=${user.uid}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) return;
        const payload = await response.json();
        const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
        const activeCardIds = alerts
          .filter((alert: any) => alert?.status === "active")
          .map((alert: any) => String(alert.cardId || ""))
          .filter(Boolean);
        setAlertCardIds(new Set(activeCardIds));
      } catch (error) {
        console.warn("Failed to load card alerts", error);
      }
    };

    void loadAlerts();
  }, [cards.length]);

  const handleSetPriceAlert = async (card: Card) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to create alerts.");
      return;
    }

    const baseline = Number((card as any).marketPrice ?? card.value ?? 0);
    const suggested = baseline > 0 ? Math.max(1, Math.round(baseline * 0.9)) : 1;
    const input = window.prompt(`Alert me when ${card.name} drops below ($):`, String(suggested));
    if (!input) return;

    const targetPrice = Number(input);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      alert("Please enter a valid dollar amount.");
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/card-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          cardId: card.id,
          cardName: card.name,
          operator: "below",
          targetPrice,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to create alert");
      }

      setAlertCardIds((previous) => {
        const next = new Set(previous);
        next.add(card.id);
        return next;
      });

      alert(`Alert set: ${card.name} below $${targetPrice}`);
    } catch (error: any) {
      alert(`Failed to set alert: ${error?.message || "Unknown error"}`);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      try {
        await deleteCard(cardId);
        setSelectedCardIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      } catch (err: any) {
        alert("Failed to delete card: " + err.message);
      }
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedCardIds((prev) => {
      const visibleIds = sortedCards.map((card) => card.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);

      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleSelectEntireCollection = () => {
    setSelectedCardIds((prev) => {
      const collectionIds = cards.map((card) => card.id);
      const allCollectionSelected =
        collectionIds.length > 0 && collectionIds.every((id) => prev.has(id));
      const next = new Set(prev);

      if (allCollectionSelected) {
        collectionIds.forEach((id) => next.delete(id));
      } else {
        collectionIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCardIds.size === 0 || bulkDeleting) return;

    const confirmed = window.confirm(
      `Delete ${selectedCardIds.size} selected card${selectedCardIds.size > 1 ? "s" : ""}? This cannot be undone.`
    );

    if (!confirmed) return;

    setBulkDeleting(true);

    try {
      const idsToDelete = Array.from(selectedCardIds);
      const results = await Promise.allSettled(idsToDelete.map((cardId) => deleteCard(cardId)));

      const failedIds: string[] = [];
      let successCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failedIds.push(idsToDelete[index]);
        }
      });

      setSelectedCardIds(new Set(failedIds));

      if (failedIds.length === 0) {
        alert(`Deleted ${successCount} card${successCount > 1 ? "s" : ""}.`);
      } else {
        alert(
          `Deleted ${successCount} card${successCount > 1 ? "s" : ""}. ` +
          `${failedIds.length} failed and remain selected.`
        );
      }
    } catch (err: any) {
      alert("Failed to delete selected cards: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkAddToFolder = async () => {
    if (selectedCardIds.size === 0 || bulkAddingToFolder) return;
    if (!bulkFolderId) {
      alert("Select a folder first.");
      return;
    }

    setBulkAddingToFolder(true);

    try {
      const selectedIds = Array.from(selectedCardIds);
      const results = await Promise.allSettled(
        selectedIds.map((cardId) => addCardToFolder(cardId, bulkFolderId))
      );

      let successCount = 0;
      let failCount = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failCount++;
        }
      });

      const targetFolder = folders.find((folder) => folder.id === bulkFolderId);
      const folderName = targetFolder?.name || "folder";

      if (failCount === 0) {
        alert(`Added ${successCount} selected card${successCount > 1 ? "s" : ""} to ${folderName}.`);
      } else {
        alert(
          `Added ${successCount} selected card${successCount > 1 ? "s" : ""} to ${folderName}. ` +
          `${failCount} failed.`
        );
      }
    } catch (err: any) {
      alert("Failed to add selected cards to folder: " + err.message);
    } finally {
      setBulkAddingToFolder(false);
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

  const handleListOnMarketplace = (card: Card) => {
    // Navigate to marketplace create page with card pre-selected
    const cardData = encodeURIComponent(JSON.stringify({
      id: card.id,
      name: card.name,
      player: card.player,
      year: card.year,
      brand: card.brand,
      sport: card.sport,
      condition: card.condition,
      value: card.value,
      imageUrl: resolveCardImageUrl(card)
    }));
    router.push(`/dashboard/marketplace/create?card=${cardData}`);
  };

  const handleCreateAuction = (card: Card) => {
    // Navigate to auction create page with card pre-selected
    const cardData = encodeURIComponent(JSON.stringify({
      id: card.id,
      name: card.name,
      player: card.player,
      year: card.year,
      brand: card.brand,
      sport: card.sport,
      condition: card.condition,
      value: card.value,
      imageUrl: resolveCardImageUrl(card)
    }));
    router.push(`/auctions/create?card=${cardData}`);
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

    // Prioritize high-quality image URLs first (TCG large images, then smaller variants)
    const imageCandidates = [
      (card as any).image,          // TCG image URL (often highest quality)
      card.imageUrl,                 // Primary uploaded image
      card.frontImageUrl,            // Front-facing scans
      card.photoUrl,                 // Photo uploads
      (card as any).cardImage,       // Alternative image field
      card.thumbnailUrl,             // Thumbnails (lower priority)
      (card as any).imagePath,       // Storage paths
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
  const allVisibleSelected = sortedCards.length > 0 && sortedCards.every((card) => selectedCardIds.has(card.id));
  const allCollectionSelected = cards.length > 0 && cards.every((card) => selectedCardIds.has(card.id));

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

        {selectedCardIds.size > 0 && (
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "#bbb" }}>
              {selectedCardIds.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting || bulkAddingToFolder}
              className="action-btn delete"
              style={{ opacity: bulkDeleting ? 0.6 : 1 }}
            >
              {bulkDeleting ? "Deleting..." : `🗑️ Delete Selected (${selectedCardIds.size})`}
            </button>
            <select
              value={bulkFolderId}
              onChange={(e) => setBulkFolderId(e.target.value)}
              disabled={bulkDeleting || bulkAddingToFolder}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: "0.85rem",
                minWidth: 180,
              }}
            >
              <option value="">Select folder...</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAddToFolder}
              disabled={bulkDeleting || bulkAddingToFolder || !bulkFolderId}
              className="action-btn"
              style={{ opacity: bulkAddingToFolder ? 0.6 : 1 }}
            >
              {bulkAddingToFolder ? "Adding..." : `📁 Add Selected to Folder (${selectedCardIds.size})`}
            </button>
            <button
              onClick={handleSelectEntireCollection}
              disabled={bulkDeleting || bulkAddingToFolder || cards.length === 0}
              className="action-btn"
            >
              {allCollectionSelected
                ? `Unselect Entire Collection (${cards.length})`
                : `Select Entire Collection (${cards.length})`}
            </button>
            <button
              onClick={() => setSelectedCardIds(new Set())}
              disabled={bulkDeleting || bulkAddingToFolder}
              className="action-btn"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Cards Table */}
        <div className="cards-table-container">
          {cardsLoading ? (
            <div className="loading">Loading cards...</div>
          ) : sortedCards.length > 0 ? (
            <table className="cards-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleSelectAllVisible}
                      title={allVisibleSelected ? "Unselect all visible" : "Select all visible"}
                    />
                  </th>
                  <th>Photo</th>
                  <th>Card</th>
                  <th>Card #</th>
                  <th>Player</th>
                  <th>Sport</th>
                  <th>Year</th>
                  <th>Brand</th>
                  <th>Condition</th>
                  <th>Value</th>
                  <th>Predicted 30d</th>
                  <th>Rarity Signal</th>
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
                      <input
                        type="checkbox"
                        checked={selectedCardIds.has(card.id)}
                        onChange={() => toggleCardSelection(card.id)}
                        aria-label={`Select ${card.name}`}
                      />
                    </td>
                    <td>
                      <img
                        src={resolveCardImageUrl(card) || "/placeholder-card.svg"}
                        alt={card.name}
                        className="collection-card-thumb w-full rounded"
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
                    <td style={{ color: "#ff7a47", fontWeight: "bold" }}>
                      ${Number((card as any).marketPrice ?? card.value ?? 0).toLocaleString()}
                    </td>
                    <td style={{ color: "#9fd3ff", fontWeight: 600 }}>
                      ${Number((card as any).predicted30DayValue ?? (card as any).marketPrice ?? card.value ?? 0).toLocaleString()}
                    </td>
                    <td>
                      {(card as any).rarityTier || (card.rarity === "Legendary" ? "Ultra Rare" : card.rarity === "Rare" ? "Rare" : "Common")}
                    </td>
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
                          onClick={() => handleListOnMarketplace(card)}
                          className="action-btn"
                          title="List on Marketplace"
                          style={{
                            background: "rgba(34, 197, 94, 0.2)",
                            border: "1px solid rgba(34, 197, 94, 0.4)",
                            color: "#22c55e",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                          }}
                        >
                          🛒 List
                        </button>
                        <button
                          onClick={() => handleCreateAuction(card)}
                          className="action-btn"
                          title="Create Auction"
                          style={{
                            background: "rgba(168, 85, 247, 0.2)",
                            border: "1px solid rgba(168, 85, 247, 0.4)",
                            color: "#a855f7",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                          }}
                        >
                          🔨 Auction
                        </button>
                        <button
                          onClick={() => handleSetPriceAlert(card)}
                          className="action-btn"
                          title="Set price drop alert"
                          style={{
                            background: "rgba(250, 204, 21, 0.2)",
                            border: "1px solid rgba(250, 204, 21, 0.4)",
                            color: "#facc15",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                          }}
                        >
                          {alertCardIds.has(card.id) ? "🔔 Alerted" : "🔔 Alert"}
                        </button>
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
