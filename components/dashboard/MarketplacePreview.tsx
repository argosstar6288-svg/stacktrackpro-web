import Link from "next/link";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";

interface MarketplacePreviewItem {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
}

interface MarketplacePreviewProps {
  listings: MarketplacePreviewItem[];
  loading?: boolean;
}

export default function MarketplacePreview({ listings, loading }: MarketplacePreviewProps) {
  const { currency } = useCurrency();

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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="scan-image" style={{ width: "46px", minHeight: "62px", marginBottom: 0 }}>
                  {listing.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.imageUrl} alt={listing.name} loading="lazy" />
                  ) : (
                    "🃏"
                  )}
                </div>
                <div>
                <p className="market-name">{listing.name}</p>
                <p className="market-price">{formatCurrency(listing.price, currency)}</p>
                </div>
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
