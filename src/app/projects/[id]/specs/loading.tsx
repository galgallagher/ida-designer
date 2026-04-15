// Shown while the project library page data loads.
// The project layout (sidebar) is already rendered — this only covers
// the main content area. No padding — layout's <main> already applies padding: 32.

export default function ProjectSpecsLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ height: 12, width: 120, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 28, width: 200, backgroundColor: "#E0DDD9", borderRadius: 6 }} />
        </div>
        <div style={{ height: 34, width: 110, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
      </div>

      {/* Schedule groups */}
      {[1, 2, 3].map((g) => (
        <div key={g} style={{ marginBottom: 32 }}>
          <div style={{ height: 12, width: 100, backgroundColor: "#E4E1DC", borderRadius: 4, marginBottom: 12 }} />
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 60, backgroundColor: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.05)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
