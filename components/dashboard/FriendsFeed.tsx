const friends = [
  { name: "Dylan Park", action: "listed a 2003 LeBron Topps", time: "6m" },
  { name: "Maya Chen", action: "followed your auction", time: "32m" },
  { name: "Jordan Webb", action: "shared a market alert", time: "2h" },
];

export default function FriendsFeed() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Friends Feed</h2>
          <p className="panel-subtitle">What your network is doing</p>
        </div>
        <button className="panel-button" type="button">
          Invite
        </button>
      </div>
      <div className="friends-list">
        {friends.map((friend) => (
          <div key={friend.name} className="friend-row">
            <div className="friend-avatar">{friend.name.slice(0, 2)}</div>
            <div>
              <p className="friend-name">{friend.name}</p>
              <p className="friend-action">{friend.action}</p>
            </div>
            <span className="friend-time">{friend.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
