import { useEffect, useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency";

const CURRENCY_STORAGE_KEY = "user-currency";
const CURRENCY_EVENT_NAME = "currencyChange";
const CURRENCY_MIGRATION_KEY = "user-currency-migrated-cad-default";

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const syncCurrency = (nextCurrency?: string | null) => {
      if (!nextCurrency) {
        setCurrencyState(DEFAULT_CURRENCY);
        localStorage.setItem(CURRENCY_STORAGE_KEY, DEFAULT_CURRENCY);
        return;
      }

      const hasMigratedDefault = localStorage.getItem(CURRENCY_MIGRATION_KEY) === "1";
      const resolvedCurrency =
        !hasMigratedDefault && nextCurrency === "USD" ? DEFAULT_CURRENCY : nextCurrency;

      if (!hasMigratedDefault) {
        localStorage.setItem(CURRENCY_MIGRATION_KEY, "1");
      }

      if (resolvedCurrency !== nextCurrency) {
        localStorage.setItem(CURRENCY_STORAGE_KEY, resolvedCurrency);
      }

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
    setCurrencyState(newCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    window.dispatchEvent(new CustomEvent(CURRENCY_EVENT_NAME, { detail: { currency: newCurrency } }));
  };

  return { currency, setCurrency, isLoaded };
}
