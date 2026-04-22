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
    symbol: "CA$",
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

export const DEFAULT_CURRENCY = "CAD";

const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  CAD: 1.38,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 151.0,
  AUD: 1.53,
  CHF: 0.91,
  CNY: 7.24,
};

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  CAD: "en-CA",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CHF: "de-CH",
  CNY: "zh-CN",
};

export function convertFromUSD(value: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const safeValue = Number(value || 0);
  const rate = USD_EXCHANGE_RATES[currencyCode] || 1;
  return safeValue * rate;
}

export function formatCurrency(
  value: number,
  currencyCode: string = DEFAULT_CURRENCY,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
  const convertedValue = convertFromUSD(value, currency.code);
  const locale = CURRENCY_LOCALES[currency.code] || "en-US";

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(convertedValue);

    if (currency.code === "CAD" && formatted.startsWith("$")) {
      return formatted.replace("$", "CA$");
    }

    return formatted;
  } catch {
    return `${currency.symbol}${convertedValue.toLocaleString()}`;
  }
}

export function getCurrencySymbol(currencyCode: string = DEFAULT_CURRENCY): string {
  return CURRENCIES[currencyCode]?.symbol || "$";
}

export function getCurrencyCode(currencyCode: string = DEFAULT_CURRENCY): string {
  return CURRENCIES[currencyCode]?.code || DEFAULT_CURRENCY;
}
