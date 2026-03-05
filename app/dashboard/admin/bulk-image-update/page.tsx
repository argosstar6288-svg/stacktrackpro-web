"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, updateCard, Card } from "@/lib/cards";
import styles from "../../admin.module.css";

async function searchPriceCharting(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 PriceCharting (Sports Cards): searching for "${cleanName}"`);
    
    const searchPatterns = [
      cleanName,
      cleanName.replace(/\s+\d{4}$/, ""),
      cleanName.split(" ").slice(0, 3).join(" "),
    ];

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      try {
        console.log(`       🔎 Attempt ${i + 1}/3: "${pattern}"`);
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
          const product = data.products[0];
          if (product.image_url || product.image || product.photo) {
            console.log(`      ✅ Match found! PriceCharting product image located`);
            return product.image_url || product.image || product.photo;
          }
        }
        
        console.log(`       ℹ️  No image in response`);
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  PriceCharting: all 3 attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  PriceCharting: skipped (unexpected error)`);
  }
  return null;
}

async function searchTradingCardDatabase(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Trading Card Database (Universal TCG): searching for "${cleanName}"`);
    
    const searchPatterns = [
      cleanName,
      cleanName.split(" ").slice(0, 2).join(" "),
      cleanName.split(" ")[0],
    ];

    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      try {
        console.log(`       🔎 Attempt ${i + 1}/3: "${pattern}"`);
        // Trading Card Database API endpoint
        const url = `https://www.tcgdatabase.com/api/card/search?q=${encodeURIComponent(pattern)}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.cards?.length > 0) {
          const card = data.cards[0];
          if (card.image || card.image_url || card.imageUrl) {
            console.log(`      ✅ Match found! Located "${card.name}" in Trading Card Database`);
            return card.image || card.image_url || card.imageUrl;
          }
          console.log(`       ℹ️  Found "${card.name}" but no image data`);
        } else {
          console.log(`       ℹ️  No cards match "${pattern}"`);
        }
      } catch (err) {
        console.log(`       ⚠️  Request failed, trying next pattern...`);
        continue;
      }
    }
    
    console.log(`    ⏭️  Trading Card Database: all 3 attempts exhausted, moving to next source`);
  } catch (error) {
    console.log(`    ⏭️  Trading Card Database: skipped (unexpected error)`);
  }
  return null;
}

async function searchTCGPlayer(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 TCGPlayer (Official Platform): searching for "${cleanName}"`);
    
    // TCGPlayer official API endpoint
    try {
      console.log(`       🔎 Querying official TCGPlayer database...`);
      const url = `https://api.tcgplayer.com/v1.32.0/search/products?q=${encodeURIComponent(cleanName)}&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results?.length > 0) {
        const product = data.results[0];
        console.log(`       ℹ️  Found product: "${product.name || cleanName}"`);
        
        // Try to fetch product details for image
        if (product.productId) {
          try {
            console.log(`       🔎 Fetching detailed product info...`);
            const detailUrl = `https://api.tcgplayer.com/v1.32.0/products/${product.productId}`;
            const detailResponse = await fetch(detailUrl);
            const detailData = await detailResponse.json();
            
            if (detailData.data?.image || detailData.data?.smallImage) {
              console.log(`      ✅ Match found! TCGPlayer image located for "${detailData.data.name}"`);
              return detailData.data.image || detailData.data.smallImage;
            }
            console.log(`       ℹ️  Product found but no image available`);
          } catch (err) {
            console.log(`       ⚠️  Could not fetch product details`);
          }
        }
      } else {
        console.log(`       ℹ️  No products found in TCGPlayer database`);
      }
    } catch (err) {
      console.log(`       ⚠️  TCGPlayer API request failed`);
    }
    
    console.log(`    ⏭️  TCGPlayer: no image located, moving to next source`);
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

    if (cardNumber) {
      console.log(`  📌 Card ID: ${cardNumber}`);
    }
    console.log(`  📝 Searching for: "${cleanName}"`);
    console.log(`  🌐 Querying 3 primary sources in order...\n`);

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

    console.log(`  ❌ Image not found - all 3 sources exhausted (try CSV upload or manual URL entry)\n`);
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
