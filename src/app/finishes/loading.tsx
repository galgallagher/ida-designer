// Shown while finishes library data loads.
// No padding — AppShell's main content area handles padding.

export default function FinishesLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ height: 28, width: 200, backgroundColor: "#E0DDD9", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 12, width: 80, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
        </div>
        <div style={{ height: 36, width: 120, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[40, 70, 90, 60, 55, 110].map((w, i) => (
          <div key={i} style={{ height: 32, width: w, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
        ))}
      </div>

      {/* Section */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ height: 11, width: 70, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 14 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(26,26,26,0.05)" }}>
              <div style={{ aspectRatio: "4/3", backgroundColor: "#F0EEEB" }} />
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ height: 13, width: "70%", backgroundColor: "#E4E1DC", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 16, width: 50, backgroundColor: "#EDECEA", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
