function normalizeSchemaKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCardNumber(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizeVariant(value) {
  const normalized = String(value || "normal").toLowerCase();
  if (normalized.includes("reverse")) return "reverse-holo";
  if (normalized.includes("shadowless")) return "shadowless";
  if (normalized.includes("first") || normalized.includes("1st")) return "first-edition";
  if (normalized.includes("holo")) return "holofoil";
  return "normal";
}

function generateDNA(cardData) {
  const setName = typeof cardData.set === "object" ? cardData.set?.name || cardData.set?.id || cardData.set?.code : cardData.set;
  return {
    player: cleanText(cardData.player),
    team: cleanText(cardData.team),
    year: String(cardData.year || "").slice(0, 4),
    set: cleanText(setName),
    number: cleanCardNumber(cardData.cardNumber || cardData.number),
    brand: cleanText(cardData.brand),
    sport: cleanText(cardData.sport),
    name: cleanText(cardData.name),
    type: cleanText(cardData.type),
    variant: normalizeVariant(cardData.variant),
  };
}

function buildLookup(input) {
  return [
    normalizeSchemaKey(input.name),
    normalizeSchemaKey(input.number || input.cardNumber),
    normalizeSchemaKey(input.setName),
  ]
    .filter(Boolean)
    .join("_") || "unknown_card";
}

function buildSetID(gameID, sourceSetID, setName) {
  return sourceSetID ? `${normalizeSchemaKey(gameID)}_${normalizeSchemaKey(sourceSetID)}` : `${normalizeSchemaKey(gameID)}_${normalizeSchemaKey(setName || "unknown_set")}`;
}

function buildCardID(gameID, setID, number, name) {
  return [normalizeSchemaKey(gameID), normalizeSchemaKey(setID), normalizeSchemaKey(number), normalizeSchemaKey(name)]
    .filter(Boolean)
    .join("_") || "unknown_card";
}

function buildSearchTerms(values) {
  const terms = new Set();
  values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .forEach((value) => {
      cleanText(value)
        .split(" ")
        .filter((part) => part.length > 1)
        .forEach((part) => terms.add(part));
    });

  return Array.from(terms);
}

function normalizeSearchToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generateSearchTokens({ name, setName, number, game }) {
  const tokenSet = new Set();
  const normalizedName = normalizeSearchToken(name);
  const normalizedSet = normalizeSearchToken(setName);
  const normalizedNumber = normalizeSearchToken(number);
  const normalizedGame = normalizeSearchToken(game);

  const add = (value) => {
    const token = normalizeSearchToken(value);
    if (token.length >= 2) tokenSet.add(token);
  };

  add(normalizedName);
  add(`${normalizedName} ${normalizedSet}`);
  add(`${normalizedName} ${normalizedNumber}`);
  add(`${normalizedNumber} ${normalizedName}`);
  add(`${normalizedGame} ${normalizedName}`);
  add(`${normalizedName} ${normalizedSet} ${normalizedNumber}`);

  normalizedName.split(" ").filter((word) => word.length >= 2).forEach(add);
  normalizedSet.split(" ").filter((word) => word.length >= 2).forEach(add);

  return Array.from(tokenSet).slice(0, 40);
}

function buildGlobalIndexDoc({ cardID, name, setName, number, game, rarity, image, lookup }) {
  return {
    cardID,
    name,
    set: setName,
    number,
    game,
    rarity: rarity || null,
    image: image || null,
    lookup,
    searchTokens: generateSearchTokens({ name, setName, number, game }),
    updatedAt: new Date().toISOString(),
  };
}

function buildGameDocument(gameID, name, publisher) {
  return {
    gameID,
    name,
    publisher,
    updatedAt: new Date().toISOString(),
  };
}

function buildSetDocument({ gameID, setID, name, year, totalCards, symbol }) {
  return {
    setID,
    gameID,
    name,
    year: year || null,
    totalCards: totalCards || null,
    symbol: symbol || null,
    updatedAt: new Date().toISOString(),
  };
}

function buildVariantDocuments(cardID, variants, image) {
  return (variants || []).filter(Boolean).map((variant) => ({
    variantID: `${cardID}_${normalizeSchemaKey(variant)}`,
    cardID,
    variantType: variant,
    image: image || null,
    updatedAt: new Date().toISOString(),
  }));
}

function buildMarketData({ cardID, marketPrice, lowPrice, highPrice, trend, demandScore, source }) {
  if (
    marketPrice == null &&
    lowPrice == null &&
    highPrice == null &&
    trend == null &&
    demandScore == null
  ) {
    return null;
  }

  return {
    cardID,
    marketPrice: marketPrice != null ? Number(marketPrice) : null,
    lowPrice: lowPrice != null ? Number(lowPrice) : null,
    highPrice: highPrice != null ? Number(highPrice) : null,
    trend: trend != null ? Number(trend) : null,
    demandScore: demandScore != null ? Number(demandScore) : null,
    source: source || null,
    lastUpdated: new Date().toISOString(),
  };
}

function normalizePokemonCard(card) {
  const gameID = "pokemon";
  const setName = card.set?.name || "Unknown Set";
  const setID = buildSetID(gameID, card.set?.id, setName);
  const number = String(card.number || "");
  const lookup = buildLookup({ name: card.name, number, setName });
  const cardID = buildCardID(gameID, setID, number, card.name);

  const priceVariants = card.tcgplayer?.prices || {};
  const firstPriceVariant = Object.values(priceVariants).find(Boolean) || {};
  const variants = Object.keys(priceVariants || {}).map(normalizeVariant);

  return {
    gameDoc: buildGameDocument(gameID, "Pokemon", "Nintendo"),
    setDoc: buildSetDocument({
      gameID,
      setID,
      name: setName,
      year: Number(String(card.set?.releaseDate || "").slice(0, 4)) || null,
      totalCards: card.set?.total,
      symbol: card.set?.images?.symbol || null,
    }),
    cardDoc: {
      cardID,
      stacktrackId: cardID,
      catalogId: card.id,
      gameID,
      game: gameID,
      setID,
      setName,
      set: {
        id: card.set?.id || setID,
        name: setName,
        series: card.set?.series || null,
      },
      lookup,
      name: card.name,
      number,
      cardNumber: number,
      rarity: card.rarity || null,
      artist: card.artist || null,
      year: Number(String(card.set?.releaseDate || "").slice(0, 4)) || null,
      image: card.images?.large || card.images?.small || null,
      images: {
        small: card.images?.small || null,
        large: card.images?.large || null,
      },
      imageUrl: card.images?.large || card.images?.small || null,
      tcgplayerId: card.tcgplayer?.productId || null,
      rarityRaw: card.rarity || null,
      supertype: card.supertype || null,
      subtypes: card.subtypes || [],
      types: card.types || [],
      hp: card.hp || null,
      variants,
      searchTerms: buildSearchTerms([
        card.name,
        setName,
        number,
        card.supertype,
        card.subtypes || [],
        card.types || [],
        lookup,
      ]),
      dna: generateDNA({
        name: card.name,
        year: Number(String(card.set?.releaseDate || "").slice(0, 4)) || null,
        set: setName,
        cardNumber: number,
        type: card.supertype,
        variant: variants[0],
      }),
      pricing: {
        market: firstPriceVariant.market || firstPriceVariant.mid || null,
        low: firstPriceVariant.low || null,
        high: firstPriceVariant.high || null,
        lastUpdated: new Date().toISOString(),
        variants: Object.fromEntries(
          Object.entries(priceVariants || {}).map(([variantKey, prices]) => [variantKey, prices?.market || prices?.mid || null])
        ),
      },
      importSource: "pokemon-tcg-api",
      updatedAt: new Date().toISOString(),
    },
    marketDataDoc: buildMarketData({
      cardID,
      marketPrice: firstPriceVariant.market || firstPriceVariant.mid,
      lowPrice: firstPriceVariant.low,
      highPrice: firstPriceVariant.high,
      source: "pokemon-tcg-api",
    }),
    variantDocs: buildVariantDocuments(cardID, variants, card.images?.large || card.images?.small),
    globalIndexDoc: buildGlobalIndexDoc({
      cardID,
      name: card.name,
      setName,
      number,
      game: gameID,
      rarity: card.rarity,
      image: card.images?.large || card.images?.small,
      lookup,
    }),
  };
}

function normalizeMagicCard(card) {
  const gameID = "magic";
  const setName = card.set_name || card.set || "Unknown Set";
  const setID = buildSetID(gameID, card.set, setName);
  const number = String(card.collector_number || "");
  const lookup = buildLookup({ name: card.name, number, setName });
  const cardID = buildCardID(gameID, setID, number, card.name);
  const image = card.image_uris?.normal || card.image_uris?.large || card.card_faces?.[0]?.image_uris?.normal || null;
  const marketPrice = Number(card.prices?.usd || card.prices?.usd_foil || card.prices?.eur || 0) || null;
  const variantHints = [
    card.foil ? "holofoil" : null,
    card.promo ? "promo" : null,
  ].filter(Boolean);

  return {
    gameDoc: buildGameDocument(gameID, "Magic: The Gathering", "Wizards of the Coast"),
    setDoc: buildSetDocument({
      gameID,
      setID,
      name: setName,
      year: Number(String(card.released_at || "").slice(0, 4)) || null,
      totalCards: null,
      symbol: card.set_uri || null,
    }),
    cardDoc: {
      cardID,
      stacktrackId: cardID,
      catalogId: card.id,
      gameID,
      game: gameID,
      setID,
      setName,
      set: {
        code: card.set,
        name: setName,
      },
      lookup,
      name: card.name,
      number,
      cardNumber: number,
      rarity: card.rarity || null,
      artist: card.artist || null,
      year: Number(String(card.released_at || "").slice(0, 4)) || null,
      image,
      images: {
        small: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null,
        large: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || image,
      },
      imageUrl: image,
      manaCost: card.mana_cost || null,
      type: card.type_line || null,
      colors: card.colors || [],
      variants: variantHints,
      searchTerms: buildSearchTerms([
        card.name,
        setName,
        number,
        card.type_line,
        card.colors || [],
        lookup,
      ]),
      dna: generateDNA({
        name: card.name,
        year: Number(String(card.released_at || "").slice(0, 4)) || null,
        set: setName,
        cardNumber: number,
        type: card.type_line,
        variant: variantHints[0],
      }),
      pricing: {
        market: marketPrice,
        low: marketPrice,
        high: Number(card.prices?.usd_foil || card.prices?.eur_foil || marketPrice || 0) || marketPrice,
        lastUpdated: new Date().toISOString(),
      },
      importSource: "scryfall",
      updatedAt: new Date().toISOString(),
    },
    marketDataDoc: buildMarketData({
      cardID,
      marketPrice,
      lowPrice: marketPrice,
      highPrice: Number(card.prices?.usd_foil || card.prices?.eur_foil || marketPrice || 0) || marketPrice,
      source: "scryfall",
    }),
    variantDocs: buildVariantDocuments(cardID, variantHints, image),
    globalIndexDoc: buildGlobalIndexDoc({
      cardID,
      name: card.name,
      setName,
      number,
      game: gameID,
      rarity: card.rarity,
      image,
      lookup,
    }),
  };
}

function normalizeSportsCard(card) {
  const gameID = "sports";
  const setName = card.set || card.brand || "Unknown Set";
  const setID = buildSetID(gameID, card.setID || setName, setName);
  const number = String(card.number || card.cardNumber || "");
  const displayName = card.name || card.player || "Unknown Card";
  const lookup = buildLookup({ name: displayName, number, setName });
  const cardID = buildCardID(gameID, setID, number, displayName);
  const image = card.image || card.imageUrl || null;

  return {
    gameDoc: buildGameDocument(gameID, "Sports", "Various"),
    setDoc: buildSetDocument({
      gameID,
      setID,
      name: setName,
      year: Number(card.year) || null,
      totalCards: card.totalCards || null,
      symbol: card.symbol || null,
    }),
    cardDoc: {
      cardID,
      stacktrackId: cardID,
      catalogId: String(card.cardID || card.id || cardID),
      gameID,
      game: gameID,
      setID,
      setName,
      set: {
        id: setID,
        name: setName,
      },
      lookup,
      name: displayName,
      player: card.player || displayName,
      team: card.team || null,
      sport: card.sport || null,
      brand: card.brand || setName,
      number,
      cardNumber: number,
      rarity: card.rarity || null,
      year: Number(card.year) || null,
      image,
      images: {
        small: image,
        large: image,
      },
      imageUrl: image,
      variants: Array.isArray(card.variants) ? card.variants : [],
      searchTerms: buildSearchTerms([
        displayName,
        card.player,
        card.team,
        card.sport,
        card.brand,
        setName,
        number,
        lookup,
      ]),
      dna: generateDNA({
        player: card.player || displayName,
        team: card.team,
        year: card.year,
        set: setName,
        cardNumber: number,
        brand: card.brand || setName,
        sport: card.sport,
        name: displayName,
      }),
      pricing: {
        market: card.marketPrice || card.value || null,
        low: card.lowPrice || null,
        high: card.highPrice || null,
        lastUpdated: new Date().toISOString(),
      },
      importSource: card.source || "sports-json",
      updatedAt: new Date().toISOString(),
    },
    marketDataDoc: buildMarketData({
      cardID,
      marketPrice: card.marketPrice || card.value,
      lowPrice: card.lowPrice,
      highPrice: card.highPrice,
      trend: card.trend,
      demandScore: card.demandScore,
      source: card.source || "sports-json",
    }),
    variantDocs: buildVariantDocuments(cardID, card.variants || [], image),
    globalIndexDoc: buildGlobalIndexDoc({
      cardID,
      name: displayName,
      setName,
      number,
      game: gameID,
      rarity: card.rarity,
      image,
      lookup,
    }),
  };
}

module.exports = {
  normalizeSchemaKey,
  cleanText,
  buildLookup,
  buildSetID,
  buildCardID,
  buildSearchTerms,
  generateSearchTokens,
  generateDNA,
  normalizePokemonCard,
  normalizeMagicCard,
  normalizeSportsCard,
};
