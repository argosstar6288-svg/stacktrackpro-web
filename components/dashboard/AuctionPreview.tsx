import Link from "next/link";

interface AuctionPreviewItem {
  id: string;
  title: string;
  currentBid: number;
  bidCount: number;
  endTime?: any;
}

interface AuctionPreviewProps {
  auctions: AuctionPreviewItem[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const getTimeLeft = (endTime: any): string => {
  if (!endTime) return "Unknown";

  const endMs =
    typeof endTime?.toMillis === "function"
      ? endTime.toMillis()
      : typeof endTime?.seconds === "number"
      ? endTime.seconds * 1000
      : Date.parse(String(endTime));

  if (!Number.isFinite(endMs)) return "Unknown";

  const distance = endMs - Date.now();
  if (distance <= 0) return "Ended";

  const hours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
};

export default function AuctionPreview({ auctions, loading }: AuctionPreviewProps) {
  const topAuction = auctions[0];

  return (
    <section className="dashboard-card auction-panel" id="auctions">
      <div className="section-head">
        <h2>Live Auctions</h2>
      </div>

      {loading ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Loading auctions...
        </p>
      ) : !topAuction ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          No live auctions currently active.
        </p>
      ) : (
        <article className="auction-card">
          <p className="auction-title">{topAuction.title}</p>
          <div className="auction-meta">
            <div>
              <span>Current Bid</span>
              <strong>{formatCurrency(topAuction.currentBid)}</strong>
            </div>
            <div>
              <span>Time Left</span>
              <strong className="auction-time">{getTimeLeft(topAuction.endTime)}</strong>
            </div>
          </div>
          <p className="scan-set" style={{ margin: "8px 0 0" }}>
            {topAuction.bidCount} bids so far
          </p>
          <Link className="bid-btn" href={`/auctions/${topAuction.id}`}>
            Place Bid
          </Link>
        </article>
      )}
    </section>
  );
}
