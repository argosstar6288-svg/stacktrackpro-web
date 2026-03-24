import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";

interface RecentScanItem {
  id: string;
  name: string;
  imageUrl?: string;
  set: string;
  value: number;
}

interface RecentScansProps {
  scans: RecentScanItem[];
  loading?: boolean;
}

const PLACEHOLDER_IMAGE = "/placeholder-card.svg";

export default function RecentScans({ scans, loading }: RecentScansProps) {
  const { currency } = useCurrency();

  return (
    <section className="dashboard-card" id="recent-scans">
      <div className="section-head">
        <h2>Recent Scans</h2>
      </div>

      {loading ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          Loading scans...
        </p>
      ) : scans.length === 0 ? (
        <p className="scan-set" style={{ marginTop: "14px" }}>
          No scans yet. Scan your first card to populate this panel.
        </p>
      ) : (
        <div className="scan-grid">
          {scans.map((scan) => (
            <article key={scan.id} className="scan-card">
              <div className="scan-image">
                {scan.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scan.imageUrl}
                    alt={scan.name}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (target.src.endsWith(PLACEHOLDER_IMAGE)) return;
                      target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                ) : (
                  "📷"
                )}
              </div>
              <p className="scan-name">{scan.name}</p>
              <p className="scan-set">{scan.set || "Card details"}</p>
              <p className="scan-value">Value {formatCurrency(scan.value, currency)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
