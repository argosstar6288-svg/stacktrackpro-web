interface MarketMoverItem {
  id: string;
  name: string;
  price: number;
  changePercent: number;
  up: boolean;
}

interface MarketMoversProps {
  movers: MarketMoverItem[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function MarketMovers({ movers, loading }: MarketMoversProps) {
  return (
    <section className="dashboard-card" id="market-movers">
      <div className="section-head">
        <h2>Market Movers</h2>
      </div>

      {loading ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Loading market movers...
        </p>
      ) : movers.length === 0 ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Update prices in your collection to see movers.
        </p>
      ) : (
        <div className="mini-card-grid">
          {movers.map((item) => (
            <article key={item.id} className="mini-card">
              <div className="mini-card-image">🃏</div>
              <p className={`mini-card-title ${Math.abs(item.changePercent) >= 8 ? "hot-card" : ""}`}>{item.name}</p>
              <p className="mini-card-price">{formatCurrency(item.price)}</p>
              <p className={`mini-card-change ${item.up ? "up" : "down"}`}>
                {item.up ? "▲" : "▼"} {Math.abs(item.changePercent).toFixed(1)}%
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
