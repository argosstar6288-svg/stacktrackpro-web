import Link from "next/link";

interface MarketplacePreviewItem {
  id: string;
  name: string;
  price: number;
}

interface MarketplacePreviewProps {
  listings: MarketplacePreviewItem[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function MarketplacePreview({ listings, loading }: MarketplacePreviewProps) {
  return (
    <section className="dashboard-card" id="marketplace-quick-view">
      <div className="section-head">
        <h2>Marketplace</h2>
      </div>

      {loading ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Loading listings...
        </p>
      ) : listings.length === 0 ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          No active listings right now.
        </p>
      ) : (
        <div className="market-list">
          {listings.map((listing) => (
            <article key={listing.id} className="market-row">
              <div>
                <p className="market-name">{listing.name}</p>
                <p className="market-price">{formatCurrency(listing.price)}</p>
              </div>
              <Link className="buy-btn" href={`/dashboard/marketplace/${listing.id}`}>
                Buy
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
