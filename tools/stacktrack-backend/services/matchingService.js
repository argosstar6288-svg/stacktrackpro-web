function normalizeSearchText(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchQuery(input) {
  if (typeof input === "string") {
    return normalizeSearchText(input);
  }

  const cleaned = input || {};
  return normalizeSearchText(
    [cleaned.player, cleaned.year, cleaned.brand, cleaned.cardName]
      .filter(Boolean)
      .join(" ")
  );
}

// Placeholder for AI matching logic
const matchCard = (sales, query) => {
  // Future: add OCR + NLP + image matching
  return sales; // assume correct for MVP
}

module.exports = {
  normalizeSearchText,
  buildSearchQuery,
  matchCard,
};
