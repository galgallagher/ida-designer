// Shown while drawings page data loads (layout + nav are already rendered).
// No padding here — the layout's <main> already applies padding: 32.

export default function DrawingsLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ height: 12, width: 120, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 28, width: 180, backgroundColor: "#E0DDD9", borderRadius: 6 }} />
        </div>
        <div style={{ height: 34, width: 120, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
      </div>

      {/* Option tabs row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[90, 80, 100].map((w, i) => (
          <div key={i} style={{ height: 30, width: w, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
        ))}
      </div>

      {/* Section label */}
      <div style={{ height: 11, width: 80, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 12 }} />

      {/* Drawing cards grid */}
      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 28 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: 88,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              boxShadow: "0 2px 12px rgba(26,26,26,0.05)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ height: 13, width: "55%", backgroundColor: "#E4E1DC", borderRadius: 4 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ height: 20, width: 34, backgroundColor: "#F0EEEB", borderRadius: 6 }} />
              <div style={{ height: 20, width: 34, backgroundColor: "#F0EEEB", borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Second section label */}
      <div style={{ height: 11, width: 60, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 12 }} />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 88,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              boxShadow: "0 2px 12px rgba(26,26,26,0.05)",
              padding: "14px 16px",
            }}
          >
            <div style={{ height: 13, width: "45%", backgroundColor: "#E4E1DC", borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
