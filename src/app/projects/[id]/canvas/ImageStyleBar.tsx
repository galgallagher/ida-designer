"use client";

/**
 * Shared floating style bar for canvas shapes that support flip and corner
 * radius controls. Rendered above the shape when it is the sole selected item.
 */

import React from "react";

export function StyleBarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        border: "none",
        borderRadius: 6,
        backgroundColor: active ? "#FFDE28" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#1A1A1A",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function FlipHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 4L1 7l2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 4l2 3-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlipVIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 3L7 1l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 11l3 2 3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MakeSquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="10" height="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 5V2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SharpCornerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RoundCornerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="5" ry="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ImageStyleBar({
  flipX,
  flipY,
  cornerRadius,
  maxRadius = 50,
  isSquare = false,
  onFlipX,
  onFlipY,
  onSetRadius,
  onMakeSquare,
}: {
  flipX: boolean;
  flipY: boolean;
  cornerRadius: number;
  maxRadius?: number;
  isSquare?: boolean;
  onFlipX: () => void;
  onFlipY: () => void;
  onSetRadius: (r: number) => void;
  onMakeSquare: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        backgroundColor: "rgba(255,255,255,0.98)",
        border: "1px solid #E4E1DC",
        borderRadius: 10,
        boxShadow: "0 2px 12px rgba(26,26,26,0.12)",
        padding: "4px 8px",
        zIndex: 999,
        pointerEvents: "all",
        whiteSpace: "nowrap",
      }}
    >
      <StyleBarButton active={flipX} title="Flip horizontal" onClick={onFlipX}>
        <FlipHIcon />
      </StyleBarButton>
      <StyleBarButton active={flipY} title="Flip vertical" onClick={onFlipY}>
        <FlipVIcon />
      </StyleBarButton>
      <StyleBarButton active={isSquare} title="Make square" onClick={onMakeSquare}>
        <MakeSquareIcon />
      </StyleBarButton>

      <div style={{ width: 1, height: 18, backgroundColor: "#E4E1DC", margin: "0 4px", flexShrink: 0 }} />

      <span style={{ color: "#C0BEBB", display: "flex", alignItems: "center" }}>
        <SharpCornerIcon />
      </span>

      <input
        type="range"
        min={0}
        max={maxRadius}
        step={1}
        value={cornerRadius}
        className="ida-radius-slider"
        style={{ margin: "0 4px" }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onChange={(e) => onSetRadius(Number(e.target.value))}
      />

      <span style={{ color: "#C0BEBB", display: "flex", alignItems: "center" }}>
        <RoundCornerIcon />
      </span>
    </div>
  );
}
