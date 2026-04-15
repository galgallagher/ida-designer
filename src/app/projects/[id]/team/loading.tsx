// Shown while team page data loads (layout + nav are already rendered).
// No padding here — the layout's <main> already applies padding: 32.

export default function TeamLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ height: 12, width: 120, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 28, width: 160, backgroundColor: "#E0DDD9", borderRadius: 6 }} />
        </div>
        <div style={{ height: 34, width: 130, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
      </div>

      {/* Member rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 64,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              boxShadow: "0 2px 12px rgba(26,26,26,0.05)",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Avatar circle */}
            <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#E4E1DC", flexShrink: 0 }} />
            {/* Name + role */}
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, width: 140, backgroundColor: "#E0DDD9", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 11, width: 80, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
            </div>
            {/* Role badge */}
            <div style={{ height: 22, width: 60, backgroundColor: "#F0EEEB", borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
