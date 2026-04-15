export default function ScheduleLoading() {
  return (
    <div className="animate-pulse" style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 28, width: 160, backgroundColor: "#E0DDD9", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: 100, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
      </div>
      <div style={{ height: 11, width: 130, backgroundColor: "#E8E6E3", borderRadius: 4, marginBottom: 14 }} />
      <div className="grid grid-cols-4 gap-3">
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(26,26,26,0.05)" }}>
            <div style={{ paddingTop: "100%", backgroundColor: "#F0EEEB" }} />
            <div style={{ padding: "10px 10px 12px" }}>
              <div style={{ height: 12, width: "70%", backgroundColor: "#E4E1DC", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
