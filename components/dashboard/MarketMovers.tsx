import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";

interface MarketMoverItem {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  changePercent: number;
  up: boolean;
}

interface MarketMoversProps {
  movers: MarketMoverItem[];
  loading?: boolean;
}

const PLACEHOLDER_IMAGE = "/placeholder-card.svg";

export default function MarketMovers({ movers, loading }: MarketMoversProps) {
  const { currency } = useCurrency();

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
              <div className="mini-card-image">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (target.src.endsWith(PLACEHOLDER_IMAGE)) return;
                      target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                ) : (
                  "🃏"
                )}
              </div>
              <p className={`mini-card-title ${Math.abs(item.changePercent) >= 8 ? "hot-card" : ""}`}>{item.name}</p>
              <p className="mini-card-price">{formatCurrency(item.price, currency)}</p>
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
