const stats = [
  { label: "Active Listings", value: "248", change: "+12%" },
  { label: "Avg. Sell Time", value: "6.2 days", change: "-9%" },
  { label: "Portfolio Value", value: "$428,300", change: "+4.1%" },
  { label: "New Watchers", value: "1,142", change: "+22%" },
];

export default function StatsCards() {
  return (
    <section className="stats-cards">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <p className="stat-label">{stat.label}</p>
          <div className="stat-row">
            <p className="stat-value">{stat.value}</p>
            <span className="stat-change">{stat.change}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
