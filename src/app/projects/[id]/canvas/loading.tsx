/**
 * Loading skeleton for the Canvas tab.
 * Content-area only — the project nav renders instantly from the layout.
 */

export default function CanvasLoading() {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F4F2" }}>
      {/* Toolbar skeleton */}
      <div
        className="flex items-center gap-3 px-5 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: "1px solid #E4E1DC",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div className="animate-pulse rounded" style={{ width: 120, height: 28, backgroundColor: "#E4E1DC" }} />
        <div className="animate-pulse rounded" style={{ width: 28, height: 28, backgroundColor: "#E4E1DC" }} />
        <div className="flex-1" />
        <div className="animate-pulse rounded" style={{ width: 80, height: 28, backgroundColor: "#E4E1DC" }} />
      </div>

      {/* Canvas area skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse rounded-xl" style={{ width: 280, height: 180, backgroundColor: "#E4E1DC" }} />
      </div>
    </div>
  );
}
