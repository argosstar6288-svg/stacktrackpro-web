import { useEffect, useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency";

const CURRENCY_STORAGE_KEY = "user-currency";

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load currency from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) {
      setCurrencyState(stored);
    }
    setIsLoaded(true);
  }, []);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    // Dispatch event for other components to listen
    window.dispatchEvent(
      new CustomEvent("currencyChange", { detail: { currency: newCurrency } })
    );
  };

  return { currency, setCurrency, isLoaded };
}
