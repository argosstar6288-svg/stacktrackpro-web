"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, updateCard, Card } from "@/lib/cards";
import { searchPokemonByName, validatePokemonMatch } from "@/lib/pokemon-stats";
import styles from "../../admin.module.css";

async function searchPokemonTCG(cleanName: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`    📍 Pokemon TCG (Official API): searching for "${cleanName}"`);
    
    // Build search patterns: card number + name is most specific
    const searchPatterns = cardNumber 
      ? [
          `${cleanName}`,  // Try full name with card number context
          `${cardNumber}`,  // Try just the card number
          cleanName.split(" ")[0],  // First word (Pokemon name)
        ]
      : [
          cleanName,
          cleanName.split(" ").slice(0, 2).join(" "),
          cleanName.split(" ")[0],
        ];

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      if (!pattern || pattern.length < 2) continue;
      
      try {
        console.log(`       🔎 Attempt ${i + 1}/${searchPatterns.length}: "${pattern}"`);
        
        // Use q parameter for name search
        const url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(pattern)}"&pageSize=10`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.log(`       ⚠️  API returned status ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.data?.length > 0) {
          // Try to find best match based on name relevance
          for (const card of data.data) {
            if (card.images?.small || card.images?.large) {
              const cardName = (card.name || "").toLowerCase();
              const searchTerms = cleanName.split(" ").filter(t => t.length > 2);
              const relevanceScore = searchTerms.filter(term => cardName.includes(term.toLowerCase())).length;
              
              // Accept if name is relevant or if we have exact card number
              if (relevanceScore > 0 || cardNumber) {
                const imageUrl = card.images.large || card.images.small;
                console.log(`      ✅ Match found! "${card.name}" from ${card.set.series} (relevance: ${relevanceScore}/${searchTerms.length})`);
                return imageUrl;
              }
            }
          }
        }
        
        // Try partial/wildcard match if exact didn't work
        const urlPartial = `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(pattern)}*&pageSize=10`;
        const responsePartial = await fetch(urlPartial);
        
        if (responsePartial.ok) {
          const dataPartial = await responsePartial.json();
          
          if (dataPartial.data?.length > 0) {
            for (const card of dataPartial.data) {
              if (card.images?.small || card.images?.large) {
                const imageUrl = card.images.large || card.images.small;
                console.log(`      ✅ Match found (partial)! "${card.name}" from ${card.set.series}`);
                return imageUrl;
              }
            }
          }
        }
        
        console.log(`       ℹ️  No matches found for "${pattern}"`);
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  Pokemon TCG: all attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  Pokemon TCG: skipped (unexpected error)`);
  }
  return null;
}

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

async function searchMultipleSources(cardName: string, cardNumber?: string): Promise<string | null> {
  try {
    // Build search query with card number if available
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

export default function BulkImageUpdatePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const { cards, loading: cardsLoading } = useUserCards();
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, updated: 0 });
  const [results, setResults] = useState<Array<{ name: string; updated: boolean; imageUrl?: string }>>([]);

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

  const handleBulkUpdate = async () => {
    if (cardsLoading || cards.length === 0) return;

    setIsUpdating(true);
    setProgress({ current: 0, total: cards.length, updated: 0 });
    setResults([]);

    const updateResults: typeof results = [];
    let updated = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      setProgress((prev) => ({ ...prev, current: i + 1 }));

      // Skip if already has an image
      if (card.imageUrl && card.imageUrl.startsWith("http")) {
        updateResults.push({ name: card.name, updated: false });
        continue;
      }

      try {
        const imageUrl = await searchMultipleSources(card.name, card.cardNumber);
        if (imageUrl) {
          console.log(`✓ Found: ${card.name}`);
          await updateCard(card.id, { imageUrl });
          updateResults.push({ name: card.name, updated: true, imageUrl });
          updated++;
        } else {
          console.log(`✗ Not found: ${card.name} (Sport: ${card.sport}, Brand: ${card.brand})`);
          updateResults.push({ name: card.name, updated: false });
        }
      } catch (error) {
        console.error(`Error updating ${card.name}:`, error);
        updateResults.push({ name: card.name, updated: false });
      }

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setProgress((prev) => ({ ...prev, updated }));
    setResults(updateResults);
    setIsUpdating(false);
  };

  if (!userId) {
    return <div style={{ padding: "2rem", color: "#fff" }}>Loading...</div>;
  }

  if (cardsLoading) {
    return <div style={{ padding: "2rem", color: "#fff" }}>Loading cards...</div>;
  }

  const cardsWithImages = cards.filter((c) => c.imageUrl && c.imageUrl.startsWith("http")).length;
  const cardsWithoutImages = cards.length - cardsWithImages;

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "#fff" }}>
      <h1 style={{ marginBottom: "1rem", color: "#10b3f0" }}>Bulk Image Update</h1>

      <div style={{ backgroundColor: "#3a2a2a", padding: "1rem", borderRadius: "8px", marginBottom: "2rem", borderLeft: "4px solid #ff7a47" }}>
        <strong>ℹ️ Data Sources:</strong> Searches across <strong>PriceCharting</strong>, <strong>Trading Card Database</strong>, and <strong>TCGPlayer API</strong> for card images.
      </div>

      <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2em", marginBottom: "1rem" }}>Card Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "#1a1a1a", padding: "1rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.9em", color: "#999" }}>Total Cards</div>
            <div style={{ fontSize: "2em", fontWeight: "bold", color: "#10b3f0" }}>{cards.length}</div>
          </div>
          <div style={{ backgroundColor: "#1a1a1a", padding: "1rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.9em", color: "#999" }}>Missing Images</div>
            <div style={{ fontSize: "2em", fontWeight: "bold", color: "#ff7a47" }}>{cardsWithoutImages}</div>
          </div>
          <div style={{ backgroundColor: "#1a1a1a", padding: "1rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.9em", color: "#999" }}>Have Images</div>
            <div style={{ fontSize: "2em", fontWeight: "bold", color: "#4ade80" }}>{cardsWithImages}</div>
          </div>
          <div style={{ backgroundColor: "#1a1a1a", padding: "1rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.9em", color: "#999" }}>Coverage</div>
            <div style={{ fontSize: "2em", fontWeight: "bold", color: "#10b3f0" }}>
              {cards.length > 0 ? Math.round((cardsWithImages / cards.length) * 100) : 0}%
            </div>
          </div>
        </div>

        <button
          onClick={handleBulkUpdate}
          disabled={isUpdating || cardsWithoutImages === 0}
          style={{
            width: "100%",
            padding: "1rem",
            borderRadius: "6px",
            background: isUpdating ? "#555" : "#10b3f0",
            color: isUpdating ? "#999" : "#000",
            border: "none",
            fontWeight: "bold",
            cursor: isUpdating ? "not-allowed" : "pointer",
            fontSize: "1em",
          }}
        >
          {isUpdating ? `Updating... (${progress.current}/${progress.total})` : `Search & Update Images for ${cardsWithoutImages} Cards`}
        </button>
      </div>

      {isUpdating && (
        <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.9em", color: "#999", marginBottom: "0.5rem" }}>
              Progress: {progress.current} / {progress.total}
            </div>
            <div
              style={{
                width: "100%",
                height: "24px",
                backgroundColor: "#1a1a1a",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  backgroundColor: "#10b3f0",
                  width: `${(progress.current / progress.total) * 100}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
          <div style={{ color: "#4ade80", fontSize: "1.1em" }}>
            Found: {progress.updated} images so far
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ backgroundColor: "#222", padding: "1.5rem", borderRadius: "8px" }}>
          <h2 style={{ fontSize: "1.2em", marginBottom: "1rem" }}>Results</h2>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {results
              .sort((a, b) => {
                // Sort updated first
                if (a.updated && !b.updated) return -1;
                if (!a.updated && b.updated) return 1;
                return 0;
              })
              .map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    backgroundColor: result.updated ? "#1a3a2a" : "#3a2a2a",
                    borderLeft: `4px solid ${result.updated ? "#4ade80" : "#ff7a47"}`,
                    borderRadius: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{result.name}</span>
                    <span style={{ color: result.updated ? "#4ade80" : "#ff7a47" }}>
                      {result.updated ? "✓ Found" : "✗ Not found"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#1a1a1a", borderRadius: "6px" }}>
            <strong>Summary:</strong> {results.filter((r) => r.updated).length} of {results.length} cards updated ({Math.round((results.filter((r) => r.updated).length / results.length) * 100)}%)
          </div>
        </div>
      )}
    </div>
  );
}
