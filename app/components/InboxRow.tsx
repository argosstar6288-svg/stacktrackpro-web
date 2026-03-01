export default function InboxRow({ 
  name, 
  message, 
  time, 
  unread = false 
}: { 
  name: string; 
  message: string; 
  time: string; 
  unread?: boolean 
}) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.6)",
      padding: 20,
      borderRadius: 15,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
      border: unread ? "2px solid var(--orange)" : "1px solid rgba(255,255,255,0.1)",
      position: "relative",
      cursor: "pointer",
      transition: "0.2s ease"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(0,0,0,0.8)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(0,0,0,0.6)";
    }}
    >
      {unread && (
        <div style={{
          position: "absolute",
          top: -5,
          right: -5,
          width: 15,
          height: 15,
          background: "#ff3d5a",
          borderRadius: "50%",
          border: "2px solid #000"
        }} />
      )}
      
      <div>
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.2rem" }}>{name}</h3>
        <p style={{ margin: "5px 0 0 0", opacity: 0.7, fontSize: "0.95rem" }}>{message}</p>
      </div>

      <div style={{ fontSize: "0.9rem", opacity: 0.6 }}>{time}</div>
    </div>
  );
}
