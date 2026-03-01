export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Record<string, Currency> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
  },
  CAD: {
    code: "CAD",
    symbol: "$",
    name: "Canadian Dollar",
  },
  AUD: {
    code: "AUD",
    symbol: "$",
    name: "Australian Dollar",
  },
  CHF: {
    code: "CHF",
    symbol: "CHF",
    name: "Swiss Franc",
  },
  CNY: {
    code: "CNY",
    symbol: "¥",
    name: "Chinese Yuan",
  },
};

export const DEFAULT_CURRENCY = "USD";

export function formatCurrency(
  value: number,
  currencyCode: string = DEFAULT_CURRENCY,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(value);
  } catch {
    // Fallback if currency code is invalid
    return `${currency.symbol}${value.toLocaleString()}`;
  }
}

export function getCurrencySymbol(currencyCode: string = DEFAULT_CURRENCY): string {
  return CURRENCIES[currencyCode]?.symbol || "$";
}

export function getCurrencyCode(currencyCode: string = DEFAULT_CURRENCY): string {
  return CURRENCIES[currencyCode]?.code || DEFAULT_CURRENCY;
}
