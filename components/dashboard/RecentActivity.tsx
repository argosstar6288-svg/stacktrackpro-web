const activities = [
  {
    title: "Signed deal with Vintage Vault",
    detail: "12-card lot sent to review",
    time: "18 minutes ago",
  },
  {
    title: "Price alert triggered",
    detail: "1996 Kobe Topps PSA 10",
    time: "2 hours ago",
  },
  {
    title: "Market alert",
    detail: "Shohei Ohtani rookies trending",
    time: "Yesterday",
  },
];

export default function RecentActivity() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent Activity</h2>
          <p className="panel-subtitle">Updates across your accounts</p>
        </div>
        <button className="panel-button" type="button">
          See All
        </button>
      </div>
      <div className="activity-list">
        {activities.map((activity) => (
          <div key={activity.title} className="activity-item">
            <div>
              <p className="activity-title">{activity.title}</p>
              <p className="activity-detail">{activity.detail}</p>
            </div>
            <span className="activity-time">{activity.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
