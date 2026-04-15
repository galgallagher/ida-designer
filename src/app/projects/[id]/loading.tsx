// Shown while the project overview page data loads.
// The layout (icon rail + project nav) is already rendered — this only covers
// the main content area. No padding — layout's <main> already applies padding: 32.

export default function ProjectOverviewLoading() {
  return (
    <div className="animate-pulse max-w-5xl">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ height: 11, width: 50, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
        <div style={{ height: 11, width: 6, backgroundColor: "#EAE8E5", borderRadius: 2 }} />
        <div style={{ height: 11, width: 80, backgroundColor: "#E4E1DC", borderRadius: 4 }} />
      </div>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ height: 11, width: 60, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 32, width: 260, backgroundColor: "#E0DDD9", borderRadius: 6, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ height: 13, width: 110, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
            <div style={{ height: 13, width: 160, backgroundColor: "#EDECEA", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ height: 28, width: 72, backgroundColor: "#E8E6E3", borderRadius: 8 }} />
          <div style={{ height: 34, width: 100, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-3" style={{ marginBottom: 32 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 88,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              boxShadow: "0 2px 12px rgba(26,26,26,0.05)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ height: 10, width: 60, backgroundColor: "#E8E6E3", borderRadius: 3 }} />
            <div style={{ height: 28, width: 40, backgroundColor: "#E0DDD9", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Drawings section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ height: 11, width: 70, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
          <div style={{ height: 11, width: 80, backgroundColor: "#EDECEA", borderRadius: 4 }} />
        </div>
        <div style={{ height: 140, backgroundColor: "#FAFAF9", borderRadius: 14, border: "1.5px dashed #E4E1DC" }} />
      </div>

      {/* Specs section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ height: 11, width: 90, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
          <div style={{ height: 11, width: 65, backgroundColor: "#EDECEA", borderRadius: 4 }} />
        </div>
        <div style={{ height: 140, backgroundColor: "#FAFAF9", borderRadius: 14, border: "1.5px dashed #E4E1DC" }} />
      </div>
    </div>
  );
}
