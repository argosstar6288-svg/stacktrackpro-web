import { useEffect, useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency";

const CURRENCY_STORAGE_KEY = "user-currency";
const CURRENCY_EVENT_NAME = "currencyChange";
const ALLOWED_CURRENCIES = new Set(["CAD", "USD"]);

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const syncCurrency = (nextCurrency?: string | null) => {
      const resolvedCurrency =
        nextCurrency && ALLOWED_CURRENCIES.has(nextCurrency)
          ? nextCurrency
          : DEFAULT_CURRENCY;

      localStorage.setItem(CURRENCY_STORAGE_KEY, resolvedCurrency);
      setCurrencyState(resolvedCurrency);
    };

    syncCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === CURRENCY_STORAGE_KEY) {
        syncCurrency(event.newValue);
      }
    };

    const handleCurrencyChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ currency?: string }>;
      syncCurrency(customEvent.detail?.currency ?? localStorage.getItem(CURRENCY_STORAGE_KEY));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CURRENCY_EVENT_NAME, handleCurrencyChange);
    setIsLoaded(true);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CURRENCY_EVENT_NAME, handleCurrencyChange);
    };
  }, []);

  const setCurrency = (newCurrency: string) => {
    const resolvedCurrency =
      ALLOWED_CURRENCIES.has(newCurrency) ? newCurrency : DEFAULT_CURRENCY;

    setCurrencyState(resolvedCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, resolvedCurrency);
    window.dispatchEvent(new CustomEvent(CURRENCY_EVENT_NAME, { detail: { currency: resolvedCurrency } }));
  };

  return { currency, setCurrency, isLoaded };
}
