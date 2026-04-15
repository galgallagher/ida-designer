import AppShell from "@/components/AppShell";

export default function ProjectsLoading() {
  return (
    <AppShell>
      <div className="animate-pulse">
        {/* Header */}
        <div style={{ height: 32, width: 160, backgroundColor: "#E4E1DC", borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 16, width: 120, backgroundColor: "#EEEBE8", borderRadius: 6, marginBottom: 32 }} />

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[80, 60, 80, 90, 80].map((w, i) => (
            <div key={i} style={{ height: 32, width: w, backgroundColor: "#E4E1DC", borderRadius: 8 }} />
          ))}
        </div>

        {/* Project cards */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 72, backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
