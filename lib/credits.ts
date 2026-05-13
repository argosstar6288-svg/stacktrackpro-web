export const CURRENCY_NAME = "Credits";
export const CURRENCY_SYMBOL = "🟠";

export const CREDIT_EARN_SOURCES = [
  "Scanning cards",
  "Practice matches",
  "Tournaments",
  "Daily rewards",
  "Achievements",
] as const;

export const CREDIT_SPEND_TARGETS = [
  "Tournament entry fees",
  "Cosmetics",
  "Room furniture",
  "Emotes",
  "Temporary boosts",
] as const;

export function formatCredits(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString()} ${CURRENCY_NAME}`;
}

export function formatCreditsShort(value: number): string {
  const rounded = Math.round(value);
  return `${CURRENCY_SYMBOL}${rounded.toLocaleString()}`;
}
