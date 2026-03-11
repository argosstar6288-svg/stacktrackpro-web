interface WatchlistPreviewItem {
  id: string;
  name: string;
  price: number;
}

interface WatchlistProps {
  items: WatchlistPreviewItem[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Watchlist({ items, loading }: WatchlistProps) {
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
              <strong>{formatCurrency(item.price)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
