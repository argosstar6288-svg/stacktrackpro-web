import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";

interface WatchlistPreviewItem {
  id: string;
  name: string;
  price: number;
}

interface WatchlistProps {
  items: WatchlistPreviewItem[];
  loading?: boolean;
}

export default function Watchlist({ items, loading }: WatchlistProps) {
  const { currency } = useCurrency();

  return (
    <section className="dashboard-card" id="watchlist">
      <div className="section-head">
        <h2>Watchlist</h2>
      </div>

      {loading ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Loading watchlist...
        </p>
      ) : items.length === 0 ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Your watchlist is empty.
        </p>
      ) : (
        <div className="watchlist-rows">
          {items.map((item) => (
            <article key={item.id} className="watch-row">
              <p>{item.name}</p>
              <strong>{formatCurrency(item.price, currency)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
