interface PortfolioValueProps {
  totalValue: number;
  changePercent: number;
  trendPoints: number[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function PortfolioValue({
  totalValue,
  changePercent,
  trendPoints,
  loading,
}: PortfolioValueProps) {
  const points = trendPoints.length > 0 ? trendPoints.slice(0, 7) : [25, 33, 40, 46, 58, 62, 68];
  const up = changePercent >= 0;

  return (
    <section className="dashboard-card portfolio-overview" id="portfolio-overview">
      <div className="section-head">
        <h2>Your Portfolio</h2>
      </div>
      <div className="portfolio-value">{loading ? "—" : formatCurrency(totalValue)}</div>
      <div
        className="portfolio-change"
        style={{ color: loading ? "rgba(255,255,255,0.7)" : up ? "#22c55e" : "#ef4444" }}
      >
        {loading ? "Loading..." : `${up ? "▲" : "▼"} ${Math.abs(changePercent).toFixed(1)}% vs cost`}
      </div>

      <div className="portfolio-graph" aria-label="Portfolio trend graph">
        {points.map((point, index) => (
          <div
            key={index}
            className="graph-point-wrap"
            style={{ background: "rgba(55, 65, 81, 0.35)" }}
          >
            <span
              className="graph-point"
              style={{
                height: `${point}%`,
                background: "linear-gradient(180deg, #ff8f00, #1e88e5)",
              }}
            ></span>
          </div>
        ))}
      </div>
    </section>
  );
}
