interface RecentScanItem {
  id: string;
  name: string;
  set: string;
  value: number;
}

interface RecentScansProps {
  scans: RecentScanItem[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function RecentScans({ scans, loading }: RecentScansProps) {
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
              <div className="scan-image">📷</div>
              <p className="scan-name">{scan.name}</p>
              <p className="scan-set">{scan.set || "Card details"}</p>
              <p className="scan-value">Value {formatCurrency(scan.value)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
