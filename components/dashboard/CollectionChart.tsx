const chartData = [72, 45, 60, 30, 90, 76, 52];

export default function CollectionChart() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Collection Momentum</h2>
          <p className="panel-subtitle">Weekly value growth</p>
        </div>
        <button className="panel-button" type="button">
          View Details
        </button>
      </div>
      <div className="chart">
        {chartData.map((value, index) => (
          <div key={index} className="chart-bar">
            <span className="chart-fill" style={{ height: `${value}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>
    </section>
  );
}
