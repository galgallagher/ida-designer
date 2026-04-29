"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2, Box } from "lucide-react";
import type { StudioModelRow } from "@/types/database";

interface ModelPickerProps {
  models: StudioModelRow[];
  activeModelId: string | null;
  onSelect: (model: StudioModelRow) => void;
  onDelete: (modelId: string) => void;
}

export default function ModelPicker({
  models,
  activeModelId,
  onSelect,
  onDelete,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const active = models.find((m) => m.id === activeModelId);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 transition-colors"
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "#1A1A1A",
          border: "1px solid #E4E1DC",
          borderRadius: 8,
          padding: "5px 10px 5px 10px",
          backgroundColor: open ? "#F5F3F0" : "#fff",
          cursor: "pointer",
          minWidth: 160,
        }}
      >
        <Box size={13} color="#9A9590" />
        <span className="truncate" style={{ maxWidth: 220 }}>
          {active?.name ?? "Select model"}
        </span>
        <ChevronDown
          size={12}
          color="#9A9590"
          style={{
            marginLeft: "auto",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 flex flex-col"
          style={{
            top: "100%",
            left: 0,
            minWidth: 280,
            maxHeight: 360,
            overflow: "auto",
            backgroundColor: "#fff",
            border: "1px solid #E4E1DC",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(26,26,26,0.10)",
            padding: 4,
          }}
        >
          {models.length === 0 && (
            <div
              className="px-3 py-3 text-center"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}
            >
              No models yet
            </div>
          )}

          {models.map((m) => {
            const isActive = m.id === activeModelId;
            return (
              <div
                key={m.id}
                className="group flex items-center gap-2 transition-colors"
                style={{
                  borderRadius: 7,
                  padding: "6px 8px",
                  backgroundColor: isActive ? "#FFFBEB" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#F5F3F0";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                }}
              >
                <button
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      flexShrink: 0,
                      backgroundColor: "#E4E1DC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box size={13} color={isActive ? "#1A1A1A" : "#9A9590"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        color: "#1A1A1A",
                      }}
                    >
                      {m.name}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontSize: 10,
                        color: "#9A9590",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginTop: 1,
                      }}
                    >
                      {m.format}
                    </p>
                  </div>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m.id);
                  }}
                  className="flex items-center justify-center transition-opacity"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: "1px solid #E4E1DC",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: 0.6,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#FCA5A5";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#E4E1DC";
                  }}
                  title="Delete model"
                >
                  <Trash2 size={12} color="#9A9590" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
