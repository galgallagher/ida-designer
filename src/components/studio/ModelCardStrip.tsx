"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Plus, Trash2, Loader2, Check, Cloud, AlertCircle } from "lucide-react";
import type { StudioModelRow } from "@/types/database";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ModelCardStripProps {
  models: StudioModelRow[];
  activeModelId: string | null;
  uploading: boolean;
  uploadProgress: number;
  saveStatus: SaveStatus;
  onSelect: (model: StudioModelRow) => void;
  onAdd: () => void;
  onDelete: (modelId: string) => void;
  onRename: (modelId: string, name: string) => void;
}

export default function ModelCardStrip({
  models,
  activeModelId,
  uploading,
  uploadProgress,
  saveStatus,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}: ModelCardStripProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3"
      style={{
        height: 116,
        borderBottom: "1px solid #E4E1DC",
        backgroundColor: "#F5F3F0",
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {models.map((m) => (
        <ModelCard
          key={m.id}
          model={m}
          active={m.id === activeModelId}
          onSelect={() => onSelect(m)}
          onDelete={() => onDelete(m.id)}
          onRename={(name) => onRename(m.id, name)}
        />
      ))}

      {/* Upload-in-progress card */}
      {uploading && (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: 140,
            height: 92,
            borderRadius: 10,
            border: "1px solid #E4E1DC",
            backgroundColor: "#fff",
            flexShrink: 0,
            padding: 10,
          }}
        >
          <Loader2 size={18} className="animate-spin" color="#9A9590" />
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 6 }}>
            Uploading {uploadProgress}%
          </p>
          <div style={{ width: "100%", height: 3, backgroundColor: "#E4E1DC", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
            <div
              style={{
                height: "100%",
                width: `${uploadProgress}%`,
                backgroundColor: "#FFDE28",
                transition: "width 0.2s",
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      )}

      {/* Add new card */}
      {!uploading && (
        <button
          onClick={onAdd}
          className="flex flex-col items-center justify-center transition-colors"
          style={{
            width: 140,
            height: 92,
            borderRadius: 10,
            border: "2px dashed #C0BEBB",
            backgroundColor: "transparent",
            cursor: "pointer",
            flexShrink: 0,
            color: "#9A9590",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = "#1A1A1A"; e.currentTarget.style.color = "#1A1A1A"; }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = "#C0BEBB"; e.currentTarget.style.color = "#9A9590"; }}
        >
          <Plus size={20} />
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, marginTop: 4 }}>
            Add model
          </span>
        </button>
      )}

      {/* Spacer pushes save status to the right */}
      <div style={{ flex: 1, minWidth: 16 }} />

      {/* Save status */}
      <SaveStatusBadge status={saveStatus} />
    </div>
  );
}

// ── Model card ────────────────────────────────────────────────────────────────

function ModelCard({
  model,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  model: StudioModelRow;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model.name);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => { setDraft(model.name); }, [model.name]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model.name) onRename(trimmed);
    else setDraft(model.name);
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col transition-all"
      style={{
        width: 140,
        height: 92,
        borderRadius: 10,
        border: active ? "2px solid #FFDE28" : "1px solid #E4E1DC",
        backgroundColor: "#fff",
        cursor: "pointer",
        flexShrink: 0,
        boxShadow: active ? "0 2px 12px rgba(26,26,26,0.10)" : "0 1px 3px rgba(26,26,26,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Thumbnail area */}
      <div
        className="flex items-center justify-center"
        style={{ flex: 1, backgroundColor: "#F5F3F0", position: "relative" }}
      >
        <Box size={22} color={active ? "#1A1A1A" : "#C0BEBB"} />

        {/* Format chip */}
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            backgroundColor: "#1A1A1A",
            color: "#fff",
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          {model.format}
        </span>

        {/* Delete button on hover */}
        {hover && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center justify-center transition-opacity"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: 5,
              border: "1px solid #E4E1DC",
              backgroundColor: "rgba(255,255,255,0.95)",
              cursor: "pointer",
            }}
            title="Delete model"
          >
            <Trash2 size={11} color="#9A9590" />
          </button>
        )}
      </div>

      {/* Name */}
      <div
        style={{ padding: "5px 8px", borderTop: "1px solid #E4E1DC" }}
        onClick={(e) => { e.stopPropagation(); }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(model.name); }
            }}
            style={{
              width: "100%",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1A1A",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        ) : (
          <p
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="truncate"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? "#1A1A1A" : "#9A9590",
              cursor: "text",
            }}
            title="Double-click to rename"
          >
            {model.name}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Save status badge ─────────────────────────────────────────────────────────

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const config =
    status === "saving" ? { icon: <Loader2 size={11} className="animate-spin" />, label: "Saving…", color: "#9A9590", bg: "#F5F3F0" } :
    status === "saved"  ? { icon: <Check size={11} />, label: "Saved", color: "#16A34A", bg: "#F0FDF4" } :
    status === "error"  ? { icon: <AlertCircle size={11} />, label: "Save failed", color: "#DC2626", bg: "#FEF2F2" } :
    { icon: <Cloud size={11} />, label: "", color: "#9A9590", bg: "#F5F3F0" };

  return (
    <div
      className="flex items-center gap-1.5 flex-shrink-0"
      style={{
        padding: "5px 10px",
        borderRadius: 7,
        backgroundColor: config.bg,
        color: config.color,
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {config.icon}
      {config.label}
    </div>
  );
}
