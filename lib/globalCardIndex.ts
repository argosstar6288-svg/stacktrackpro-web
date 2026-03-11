import { normalizeSchemaKey } from "./cardSchema";

export interface GlobalCardIndexDocument {
  cardID: string;
  name: string;
  set: string;
  number: string;
  game: string;
  rarity?: string;
  image?: string;
  lookup: string;
  searchTokens: string[];
}

export function normalizeSearchToken(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addToken(tokenSet: Set<string>, value: string) {
  const normalized = normalizeSearchToken(value);
  if (normalized.length >= 2) tokenSet.add(normalized);
}

export function generateSearchTokens(input: {
  name?: string;
  set?: string;
  number?: string;
  game?: string;
}): string[] {
  const tokenSet = new Set<string>();
  const name = normalizeSearchToken(input.name || "");
  const set = normalizeSearchToken(input.set || "");
  const number = normalizeSearchToken(input.number || "");
  const game = normalizeSearchToken(input.game || "");

  addToken(tokenSet, name);
  addToken(tokenSet, `${name} ${set}`);
  addToken(tokenSet, `${name} ${number}`);
  addToken(tokenSet, `${number} ${name}`);
  addToken(tokenSet, `${game} ${name}`);
  addToken(tokenSet, `${name} ${set} ${number}`);

  name
    .split(" ")
    .filter((part) => part.length >= 2)
    .forEach((part) => addToken(tokenSet, part));

  set
    .split(" ")
    .filter((part) => part.length >= 2)
    .forEach((part) => addToken(tokenSet, part));

  if (name && set) {
    const nameWords = name.split(" ").filter(Boolean);
    const setWords = set.split(" ").filter(Boolean);

    for (let i = 1; i <= Math.min(nameWords.length, 3); i++) {
      addToken(tokenSet, `${nameWords.slice(0, i).join(" ")} ${setWords.join(" ")}`);
    }
  }

  return Array.from(tokenSet).slice(0, 40);
}

export function buildGlobalCardIndexDocument(input: {
  cardID: string;
  name?: string;
  set?: string;
  number?: string;
  game?: string;
  rarity?: string;
  image?: string;
  lookup?: string;
}): GlobalCardIndexDocument {
  const name = String(input.name || "Unknown Card");
  const set = String(input.set || "Unknown Set");
  const number = String(input.number || "");
  const game = String(input.game || "other");

  return {
    cardID: String(input.cardID),
    name,
    set,
    number,
    game,
    rarity: input.rarity,
    image: input.image,
    lookup: input.lookup || [normalizeSchemaKey(name), normalizeSchemaKey(number), normalizeSchemaKey(set)].filter(Boolean).join("_") || "unknown_card",
    searchTokens: generateSearchTokens({ name, set, number, game }),
  };
}

export function rankSearchResult(query: string, doc: GlobalCardIndexDocument): number {
  const normalizedQuery = normalizeSearchToken(query);
  const normalizedName = normalizeSearchToken(doc.name);
  const normalizedSet = normalizeSearchToken(doc.set);
  const normalizedLookup = String(doc.lookup || "").toLowerCase();
  const lookupQuery = normalizeSchemaKey(normalizedQuery);

  if (normalizedLookup && normalizedLookup === lookupQuery) return 120;
  if (normalizedName === normalizedQuery) return 100;

  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const hasNameWord = queryWords.some((word) => normalizedName.includes(word));
  const hasSetWord = queryWords.some((word) => normalizedSet.includes(word));

  if (hasNameWord && hasSetWord) return 80;
  if ((doc.searchTokens || []).includes(normalizedQuery)) return 70;
  if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) return 50;

  return 25;
}
