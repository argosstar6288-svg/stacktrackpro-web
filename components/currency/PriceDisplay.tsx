/**
 * Example: How to use currency formatting in your dashboard pages
 * 
 * Replace hardcoded "$" symbols and .toLocaleString() with formatCurrency()
 */

import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";

export function PriceDisplay({ price }: { price: number }) {
  const { currency } = useCurrency();

  return (
    <span>
      {formatCurrency(price, currency)}
    </span>
  );
}

export function PriceTable({ prices }: { prices: number[] }) {
  const { currency } = useCurrency();

  return (
    <ul>
      {prices.map((price, idx) => (
        <li key={idx}>
          Item {idx + 1}: {formatCurrency(price, currency)}
        </li>
      ))}
    </ul>
  );
}

/**
 * USAGE IN YOUR PAGES:
 * 
 * Old way (hardcoded):
 * <div>${card.value.toLocaleString()}</div>
 * 
 * New way (with currency support):
 * <div><PriceDisplay price={card.value} /></div>
 * 
 * OR inline:
 * <div>{formatCurrency(card.value, currency)}</div>
 */
