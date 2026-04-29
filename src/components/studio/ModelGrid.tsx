"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Box, Trash2, Loader2, Upload } from "lucide-react";
import type { StudioModelRow } from "@/types/database";

interface ModelGridProps {
  projectName: string;
  models: StudioModelRow[];
  uploading: boolean;
  uploadProgress: number;
  onAdd: () => void;
  onOpen: (model: StudioModelRow) => void;
  onDelete: (modelId: string) => void;
  onRename: (modelId: string, name: string) => void;
}

export default function ModelGrid({
  projectName,
  models,
  uploading,
  uploadProgress,
  onAdd,
  onOpen,
  onDelete,
  onRename,
}: ModelGridProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header — matches Project Options pattern */}
      <div
        className="flex items-center justify-between px-8 flex-shrink-0"
        style={{ height: 64, backgroundColor: "#FFFFFF", borderBottom: "1px solid #E4E1DC", borderRadius: 14 }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
            3D Studio
          </h1>
          <p style={{ fontSize: 12, color: "#9A9590", marginTop: 1 }}>{projectName}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 34, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add model
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ paddingTop: 24 }}>
        {models.length === 0 && !uploading ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {models.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                onOpen={() => onOpen(m)}
                onDelete={() => onDelete(m.id)}
                onRename={(name) => onRename(m.id, name)}
              />
            ))}
            {uploading && <UploadingCard progress={uploadProgress} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight: 360 }}
    >
      <div
        className="flex flex-col items-center justify-center gap-4 p-12"
        style={{
          border: "2px dashed #E4E1DC",
          borderRadius: 14,
          maxWidth: 420,
          textAlign: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: "#F5F3F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Upload size={24} color="#9A9590" />
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
            Upload your first 3D model
          </h2>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.5 }}>
            Drop a GLB, FBX, or OBJ file here, or click to browse. Apply materials from your project spec library and capture renders for client presentations.
          </p>
        </div>
        <button
          onClick={onAdd}
          style={{
            backgroundColor: "#FFDE28",
            color: "#1A1A1A",
            border: "none",
            borderRadius: 10,
            padding: "10px 24px",
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Choose file
        </button>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>
          GLB, FBX, or OBJ · max 100 MB
        </p>
      </div>
    </div>
  );
}

// ── Model card ────────────────────────────────────────────────────────────────

function ModelCard({
  model,
  onOpen,
  onDelete,
  onRename,
}: {
  model: StudioModelRow;
  onOpen: () => void;
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
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col transition-all"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid #E4E1DC",
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: hover ? "0 4px 14px rgba(26,26,26,0.08)" : "0 1px 3px rgba(26,26,26,0.04)",
        transform: hover ? "translateY(-1px)" : "none",
      }}
    >
      {/* Thumbnail (square aspect) */}
      <div
        className="relative flex items-center justify-center"
        style={{ aspectRatio: "1 / 1", backgroundColor: "#F5F3F0" }}
      >
        <Box size={48} color="#C0BEBB" />

        {/* Format chip */}
        <span
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            backgroundColor: "#1A1A1A",
            color: "#fff",
            borderRadius: 4,
            padding: "2px 6px",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          {model.format}
        </span>

        {/* Delete on hover */}
        {hover && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center justify-center transition-opacity"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 7,
              border: "1px solid #E4E1DC",
              backgroundColor: "rgba(255,255,255,0.95)",
              cursor: "pointer",
            }}
            title="Delete model"
          >
            <Trash2 size={13} color="#9A9590" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div
        style={{ padding: "10px 12px" }}
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
              fontSize: 13,
              fontWeight: 600,
              color: "#1A1A1A",
              border: "1px solid #E4E1DC",
              borderRadius: 6,
              outline: "none",
              backgroundColor: "#fff",
              padding: "2px 6px",
            }}
          />
        ) : (
          <p
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="truncate"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#1A1A1A",
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

// ── Uploading-in-progress card ────────────────────────────────────────────────

function UploadingCard({ progress }: { progress: number }) {
  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid #E4E1DC",
        overflow: "hidden",
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center gap-3"
        style={{ aspectRatio: "1 / 1", backgroundColor: "#F5F3F0", padding: 20 }}
      >
        <Loader2 size={28} className="animate-spin" color="#9A9590" />
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          Uploading {progress}%
        </p>
        <div style={{ width: "70%", height: 4, backgroundColor: "#E4E1DC", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: "#FFDE28",
              transition: "width 0.2s",
              borderRadius: 2,
            }}
          />
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p
          className="truncate"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9590" }}
        >
          Uploading…
        </p>
      </div>
    </div>
  );
}
