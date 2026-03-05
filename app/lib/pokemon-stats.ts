// Pokemon Stats Database - Generation 1-3 (Kanto, Johto, Hoenn)
// Used for card identification and validation

export interface PokemonStats {
  id: number;
  name: string;
  type: string[];
  total: number;
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  variants?: string[]; // e.g., "Mega", "Alolan", "Galarian", "Hisuian"
}

export const pokemonDatabase: Record<number, PokemonStats[]> = {
  1: [{ id: 1, name: "Bulbasaur", type: ["Grass", "Poison"], total: 318, hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45 }],
  2: [{ id: 2, name: "Ivysaur", type: ["Grass", "Poison"], total: 405, hp: 60, attack: 62, defense: 63, spAtk: 80, spDef: 80, speed: 60 }],
  3: [
    { id: 3, name: "Venusaur", type: ["Grass", "Poison"], total: 525, hp: 80, attack: 82, defense: 83, spAtk: 100, spDef: 100, speed: 80 },
    { id: 3, name: "Mega Venusaur", type: ["Grass", "Poison"], total: 625, hp: 80, attack: 100, defense: 123, spAtk: 122, spDef: 120, speed: 80, variants: ["Mega"] }
  ],
  4: [{ id: 4, name: "Charmander", type: ["Fire"], total: 309, hp: 39, attack: 52, defense: 43, spAtk: 60, spDef: 50, speed: 65 }],
  5: [{ id: 5, name: "Charmeleon", type: ["Fire"], total: 405, hp: 58, attack: 64, defense: 58, spAtk: 80, spDef: 65, speed: 80 }],
  6: [
    { id: 6, name: "Charizard", type: ["Fire", "Flying"], total: 534, hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 },
    { id: 6, name: "Mega Charizard X", type: ["Fire", "Dragon"], total: 634, hp: 78, attack: 130, defense: 111, spAtk: 130, spDef: 85, speed: 100, variants: ["Mega"] },
    { id: 6, name: "Mega Charizard Y", type: ["Fire", "Flying"], total: 634, hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100, variants: ["Mega"] }
  ],
  7: [{ id: 7, name: "Squirtle", type: ["Water"], total: 314, hp: 44, attack: 48, defense: 65, spAtk: 50, spDef: 64, speed: 43 }],
  8: [{ id: 8, name: "Wartortle", type: ["Water"], total: 405, hp: 59, attack: 63, defense: 80, spAtk: 65, spDef: 80, speed: 58 }],
  9: [
    { id: 9, name: "Blastoise", type: ["Water"], total: 530, hp: 79, attack: 83, defense: 100, spAtk: 85, spDef: 105, speed: 78 },
    { id: 9, name: "Mega Blastoise", type: ["Water"], total: 630, hp: 79, attack: 103, defense: 120, spAtk: 135, spDef: 115, speed: 78, variants: ["Mega"] }
  ],
  10: [{ id: 10, name: "Caterpie", type: ["Bug"], total: 195, hp: 45, attack: 30, defense: 35, spAtk: 20, spDef: 20, speed: 45 }],
  11: [{ id: 11, name: "Metapod", type: ["Bug"], total: 205, hp: 50, attack: 20, defense: 55, spAtk: 25, spDef: 25, speed: 30 }],
  12: [{ id: 12, name: "Butterfree", type: ["Bug", "Flying"], total: 395, hp: 60, attack: 45, defense: 50, spAtk: 90, spDef: 80, speed: 70 }],
  13: [{ id: 13, name: "Weedle", type: ["Bug", "Poison"], total: 195, hp: 40, attack: 35, defense: 30, spAtk: 20, spDef: 20, speed: 50 }],
  14: [{ id: 14, name: "Kakuna", type: ["Bug", "Poison"], total: 205, hp: 45, attack: 25, defense: 50, spAtk: 25, spDef: 25, speed: 35 }],
  15: [
    { id: 15, name: "Beedrill", type: ["Bug", "Poison"], total: 395, hp: 65, attack: 90, defense: 40, spAtk: 45, spDef: 80, speed: 75 },
    { id: 15, name: "Mega Beedrill", type: ["Bug", "Poison"], total: 495, hp: 65, attack: 150, defense: 40, spAtk: 15, spDef: 80, speed: 145, variants: ["Mega"] }
  ],
  25: [
    { id: 25, name: "Pikachu", type: ["Electric"], total: 320, hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90 },
    { id: 25, name: "Partner Pikachu", type: ["Electric"], total: 430, hp: 45, attack: 80, defense: 50, spAtk: 75, spDef: 60, speed: 120, variants: ["Partner"] }
  ],
  26: [
    { id: 26, name: "Raichu", type: ["Electric"], total: 485, hp: 60, attack: 90, defense: 55, spAtk: 90, spDef: 80, speed: 110 },
    { id: 26, name: "Alolan Raichu", type: ["Electric", "Psychic"], total: 485, hp: 60, attack: 85, defense: 50, spAtk: 95, spDef: 85, speed: 110, variants: ["Alolan"] }
  ],
  50: [
    { id: 50, name: "Diglett", type: ["Ground"], total: 265, hp: 10, attack: 55, defense: 25, spAtk: 35, spDef: 45, speed: 95 },
    { id: 50, name: "Alolan Diglett", type: ["Ground", "Steel"], total: 265, hp: 10, attack: 55, defense: 30, spAtk: 35, spDef: 45, speed: 90, variants: ["Alolan"] }
  ],
  51: [
    { id: 51, name: "Dugtrio", type: ["Ground"], total: 425, hp: 35, attack: 100, defense: 50, spAtk: 50, spDef: 70, speed: 120 },
    { id: 51, name: "Alolan Dugtrio", type: ["Ground", "Steel"], total: 425, hp: 35, attack: 100, defense: 60, spAtk: 50, spDef: 70, speed: 110, variants: ["Alolan"] }
  ],
};

/**
 * Search for a Pokémon by name
 * Returns array of matching Pokémon (handles variants like Mega, Alolan, etc.)
 */
export function searchPokemonByName(name: string): PokemonStats[] {
  const searchTerm = name.toLowerCase().trim();
  const results: PokemonStats[] = [];

  for (const pokeList of Object.values(pokemonDatabase)) {
    for (const poke of pokeList) {
      if (poke.name.toLowerCase().includes(searchTerm)) {
        results.push(poke);
      }
    }
  }

  return results;
}

/**
 * Get Pokémon by pokedex number (ID)
 * Returns all variants (base form + megas/regional forms)
 */
export function getPokemonById(id: number): PokemonStats[] {
  return pokemonDatabase[id] || [];
}

/**
 * Validate if a card matches a Pokémon
 * Useful for identifying card variants (Mega Charizard X vs Y, etc.)
 */
export function validatePokemonMatch(cardName: string): PokemonStats | null {
  const cleanName = cardName
    .toLowerCase()
    .replace(/\bpokémon\s+card\b/gi, "")
    .replace(/\bpokemon\s+card\b/gi, "")
    .trim();

  for (const pokeList of Object.values(pokemonDatabase)) {
    for (const poke of pokeList) {
      if (poke.name.toLowerCase() === cleanName) {
        return poke;
      }
    }
  }

  return null;
}
