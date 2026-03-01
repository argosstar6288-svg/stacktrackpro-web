export default function FolderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      background: "#1fb6ff",
      padding: 30,
      borderRadius: 20,
      textAlign: "center",
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      transition: "0.2s ease",
      cursor: "pointer"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-5px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
    }}
    >
      <div style={{
        background: "#facc15",
        padding: 40,
        borderRadius: 20,
        marginBottom: 20,
        fontSize: "3rem"
      }}>
        📁
      </div>

      <h3 style={{ margin: "10px 0", fontSize: "1.5rem", fontWeight: 700 }}>{title}</h3>
      <p style={{ opacity: 0.8, margin: "10px 0" }}>{subtitle}</p>

      <button className="primary-btn" style={{
        marginTop: 15,
        background: "#001f3f",
        color: "white",
        padding: "10px 20px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontFamily: "'Baloo 2', cursive",
        fontWeight: 700
      }}>
        Select
      </button>
    </div>
  );
}
