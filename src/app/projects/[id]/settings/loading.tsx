export default function ProjectSettingsLoading() {
  return (
    <div className="animate-pulse" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 28, width: 200, backgroundColor: "#E0DDD9", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: 100, backgroundColor: "#E8E6E3", borderRadius: 4 }} />
      </div>
      <div style={{ height: 13, width: 80, backgroundColor: "#E4E1DC", borderRadius: 4, marginBottom: 16 }} />
      <div className="flex flex-col gap-2">
        {[1,2,3,4,5,6,7].map((i) => (
          <div key={i} style={{ height: 48, backgroundColor: "#FFFFFF", borderRadius: 10, border: "1px solid #E4E1DC" }} />
        ))}
      </div>
    </div>
  );
}
