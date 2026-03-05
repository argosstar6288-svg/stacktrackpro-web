"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, updateCard, Card } from "@/lib/cards";
import styles from "../../admin.module.css";

async function searchPokemonTCG(cleanName: string): Promise<string | null> {
  try {
    const searches = [cleanName, cleanName.split(" ").slice(0, 2).join(" "), cleanName.split(" ")[0]];

    for (const searchName of searches) {
      if (!searchName) continue;

      console.log(`    📍 PokéTCG: trying exact match "${searchName}"`);
      let url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(searchName)}"`;
      let response = await fetch(url);
      let data = await response.json();

      if (data.data?.length > 0) {
        const card = data.data[0];
        if (card.images?.small) {
          console.log(`      ✅ Success! Found "${card.name}" on PokéTCG`);
          return card.images.small;
        }
      }

      console.log(`    📍 PokéTCG: trying partial match "${searchName}"`);
      url = `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(searchName)}*`;
      response = await fetch(url);
      data = await response.json();

      if (data.data?.length > 0) {
        const card = data.data[0];
        if (card.images?.small) {
          console.log(`      ✅ Success! Found "${card.name}" on PokéTCG (partial match)`);
          return card.images.small;
        }
      }
    }
    console.log(`    ⏭️  PokéTCG: no matches, trying next source...`);
  } catch (error) {
    console.error("PokéTCG error:", error);
  }
  return null;
}

async function searchCardKingdom(cleanName: string): Promise<string | null> {
  try {
    console.log(`    [CardKingdom] Searching...`);
    // CardKingdom doesn't have a public free API, but we can try a web-based approach
    // For now, skip this source
    return null;
  } catch (error) {
    console.error("CardKingdom error:", error);
  }
  return null;
}

async function searchSCRYFall(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Scryfall: searching Magic cards for "${cleanName}"`);
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`"${cleanName}"` + " is:booster")}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.data?.length > 0) {
      const card = data.data[0];
      if (card.image_uris?.normal) {
        console.log(`      ✅ Success! Found "${card.name}" on Scryfall`);
        return card.image_uris.normal;
      }
    }
    console.log(`    ⏭️  Scryfall: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  Scryfall: skipping (error)`);
  }
  return null;
}

async function searchBulbapedia(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Bulbapedia: searching wiki for "${cleanName}"`);
    const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=query&titles=${encodeURIComponent(cleanName)}&format=json&prop=pageimages&piprop=original`;
    const response = await fetch(url);
    const data = await response.json();

    const pages = data.query?.pages;
    if (pages) {
      const page = Object.values(pages)[0] as any;
      if (page.original?.source) {
        console.log(`      ✅ Success! Found image on Bulbapedia`);
        return page.original.source;
      }
    }
    console.log(`    ⏭️  Bulbapedia: no results found`);
  } catch (error) {
    console.log(`    ⏭️  Bulbapedia: skipping (error)`);
  }
  return null;
}

async function searchPokellector(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Pokellector: searching card database for "${cleanName}"`);
    const url = `https://www.pokellector.com/api/search?q=${encodeURIComponent(cleanName)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results?.length > 0) {
      const card = data.results[0];
      if (card.imageUrl || card.image_url || card.imageSmall) {
        console.log(`      ✅ Success! Found on Pokellector collection tracker`);
        return card.imageUrl || card.image_url || card.imageSmall;
      }
    }
    console.log(`    ⏭️  Pokellector: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  Pokellector: skipping (error)`);
  }
  return null;
}

async function searchYGOProDeck(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 YGOProDeck: searching Yu-Gi-Oh database for "${cleanName}"`);
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(cleanName)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.data?.length > 0) {
      const card = data.data[0];
      if (card.card_images?.[0]?.image_url) {
        console.log(`      ✅ Success! Found "${card.card_images[0].name}" on YGOProDeck`);
        return card.card_images[0].image_url;
      }
    }
    console.log(`    ⏭️  YGOProDeck: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  YGOProDeck: skipping (error)`);
  }
  return null;
}

async function searchDeckbox(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Deckbox: searching universal card database for "${cleanName}"`);
    const url = `https://deckbox.org/api/v2/cards/search?q=${encodeURIComponent(cleanName)}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
      const card = data[0];
      if (card.image_url) {
        console.log(`      ✅ Success! Found on Deckbox`);
        return card.image_url;
      }
    }
    console.log(`    ⏭️  Deckbox: no matches found`);
  } catch (error) {
    console.log(`    ⏭️  Deckbox: skipping (error)`);
  }
  return null;
}

async function searchMagicGatherer(cleanName: string): Promise<string | null> {
  try {
    console.log(`    📍 Magic Gatherer: searching official database for "${cleanName}"`);
    const url = `https://api.scryfall.com/cards/search?q=name:"${encodeURIComponent(cleanName)}"`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.data?.length > 0) {
      const card = data.data[0];
      if (card.image_uris?.large) {
        console.log(`      ✅ Success! Found "${card.name}" on Magic Gatherer`);
        return card.image_uris.large;
      }
    }
    console.log(`    ⏭️  Magic Gatherer: no results found`);
  } catch (error) {
    console.log(`    ⏭️  Magic Gatherer: skipping (error)`);
  }
  return null;
}

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
          console.log(`      ✅ Success! Found on PriceCharting sports card market`);
          return imageUrl;
        }
        
        if (data.products?.length > 0) {
          const product = data.products[0];
          if (product.image_url || product.image || product.photo) {
            console.log(`      ✅ Success! Found on PriceCharting sports card market`);
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

async function searchMultipleSources(cardName: string): Promise<string | null> {
  try {
    console.log(`\n🔍 Searching for image: "${cardName}"`);

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
    console.log(`  🌐 Searching across 8 databases...`);

    // Try sources in order
    const sources = [
      searchPokemonTCG,
      searchPokellector,
      searchPriceCharting,
      searchBulbapedia,
      searchSCRYFall,
      searchMagicGatherer,
      searchYGOProDeck,
      searchDeckbox,
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
        const imageUrl = await searchMultipleSources(card.name);
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
        <strong>ℹ️ Multiple Data Sources:</strong> Searches across <strong>Pokémon TCG</strong>, <strong>Pokellector</strong>, <strong>PriceCharting</strong>, <strong>Scryfall</strong>, <strong>Magic Gatherer</strong>, <strong>YGOProDeck</strong>, and <strong>Deckbox</strong>. Supports Pokémon, sports cards, Magic, Yu-Gi-Oh, and more!
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
