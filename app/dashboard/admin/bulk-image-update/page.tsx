"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserCards, updateCard, Card } from "@/lib/cards";
import styles from "../../admin.module.css";

async function searchPokemonTCG(cardName: string): Promise<string | null> {
  try {
    // Clean the card name by removing common suffixes and keywords
    let cleanName = cardName
      .replace(/\bPokémon\s+Card\b/gi, "")
      .replace(/\bPokemon\s+Card\b/gi, "")
      .replace(/\bPokemon\s+GO\s+Card\b/gi, "")
      .replace(/\s+V\s*$/gi, "") // " V" at end
      .replace(/\s+EX\s*$/gi, "") // " EX" at end
      .replace(/\s+VMAX\s*$/gi, "") // " VMAX" at end
      .replace(/\s+VSTAR\s*$/gi, "") // " VSTAR" at end
      .replace(/\s+-\s+.+$/gi, "") // Remove " - Something" patterns
      .replace(/\s+Single\s+Strike\s*$/gi, "")
      .replace(/\s+Rapid\s+Strike\s*$/gi, "")
      .trim();

    // If we have a special form prefix (Hisuian, Alolan, Galarian, etc.), keep it
    const formPrefixes = ["Hisuian", "Alolan", "Galarian", "Gigantamax", "Dynamax"];
    
    // Try searches in order of specificity
    const searches = [
      cleanName, // Full cleaned name
      cleanName.split(" ").slice(0, 2).join(" "), // First two words
      cleanName.split(" ")[0], // Just first word
    ];

    for (const searchName of searches) {
      if (!searchName) continue;

      // Try exact match first
      let response = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(searchName)}"`
      );
      let data = await response.json();

      if (data.data && data.data.length > 0) {
        const card = data.data[0];
        if (card.images?.small) {
          console.log(`✓ Exact match for "${searchName}"`);
          return card.images.small;
        }
      }

      // Try contains match
      response = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(searchName)}*`
      );
      data = await response.json();

      if (data.data && data.data.length > 0) {
        const card = data.data[0];
        if (card.images?.small) {
          console.log(`✓ Fuzzy match for "${searchName}"`);
          return card.images.small;
        }
      }
    }

    console.log(`✗ No match found for "${cardName}" (cleaned: "${cleanName}")`);
    return null;
  } catch (error) {
    console.error("Error searching PokéTCG:", error);
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
        const imageUrl = await searchPokemonTCG(card.name);
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
        <strong>ℹ️ Note:</strong> This tool searches the <strong>Pokémon TCG API</strong>. It will only find Pokémon cards. For sports cards (Baseball, Basketball, etc.) or other trading card games, you'll need to manually add image URLs or use a different data source.
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
