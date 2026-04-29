"use client";

import { useEffect, useRef, useState } from "react";
import type { MeshInfo, MaterialAssignments } from "./StudioCanvas";
import { readAssignment } from "./StudioCanvas";
import type { SpecLite } from "@/app/projects/[id]/studio/actions";
import { Box, Pencil } from "lucide-react";

interface MeshListPanelProps {
  meshes: MeshInfo[];
  selectedMeshIds: string[];
  materialAssignments: MaterialAssignments;
  meshLabels: Record<string, string>;
  specs: SpecLite[];
  onSelectMesh: (id: string, additive: boolean) => void;
  onRenameMesh: (meshKey: string, label: string) => void;
}

export default function MeshListPanel({
  meshes,
  selectedMeshIds,
  materialAssignments,
  meshLabels,
  specs,
  onSelectMesh,
  onRenameMesh,
}: MeshListPanelProps) {
  const specMap = Object.fromEntries(specs.map((s) => [s.id, s]));
  const selectedCount = selectedMeshIds.length;

  return (
    <aside
      className="flex flex-col"
      style={{
        width: 220,
        flexShrink: 0,
        backgroundColor: "#F5F3F0",
        borderRight: "1px solid #E4E1DC",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid #E4E1DC" }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Meshes
        </p>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", marginTop: 2 }}>
          {meshes.length} {meshes.length === 1 ? "object" : "objects"}
          {selectedCount > 1 && <span style={{ color: "#1A1A1A", fontWeight: 600 }}> · {selectedCount} selected</span>}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {meshes.length === 0 && (
          <div className="px-4 py-6 text-center" style={{ color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", fontSize: 12 }}>
            Loading model…
          </div>
        )}

        {meshes.map((mesh) => {
          const meshKey = mesh.name || mesh.id;
          const label = meshLabels[meshKey] ?? mesh.name ?? "Unnamed";
          const isSelected = selectedMeshIds.includes(mesh.id);
          const assignedSpecId = readAssignment(materialAssignments[mesh.name] ?? materialAssignments[mesh.id])?.specId ?? null;
          const assignedSpec = assignedSpecId ? specMap[assignedSpecId] : null;

          return (
            <MeshRow
              key={mesh.id}
              displayName={label}
              originalName={mesh.name}
              isSelected={isSelected}
              assignedSpec={assignedSpec}
              onSelect={(e) => onSelectMesh(mesh.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              onRename={(name) => onRenameMesh(meshKey, name)}
            />
          );
        })}
      </div>
    </aside>
  );
}

// ── Mesh row ──────────────────────────────────────────────────────────────────

function MeshRow({
  displayName,
  originalName,
  isSelected,
  assignedSpec,
  onSelect,
  onRename,
}: {
  displayName: string;
  originalName: string;
  isSelected: boolean;
  assignedSpec: SpecLite | null;
  onSelect: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => { setDraft(displayName); }, [displayName]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    // If the user clears the field, revert to the original mesh name
    if (!trimmed) {
      if (displayName !== originalName) onRename(""); // empty triggers delete in handler
      setDraft(originalName);
      return;
    }
    if (trimmed !== displayName) onRename(trimmed);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
      style={{
        backgroundColor: isSelected ? "#fff" : "transparent",
        borderRadius: isSelected ? 8 : 0,
        margin: isSelected ? "0 4px" : 0,
        width: isSelected ? "calc(100% - 8px)" : "100%",
        boxShadow: isSelected ? "0 1px 6px rgba(26,26,26,0.07)" : "none",
        cursor: "pointer",
      }}
      onClick={editing ? undefined : onSelect}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          flexShrink: 0,
          overflow: "hidden",
          backgroundColor: "#E4E1DC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {assignedSpec?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assignedSpec.image_url}
            alt={assignedSpec.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box size={14} color="#C0BEBB" />
        )}
      </div>

      <div className="flex-1 min-w-0" onClick={(e) => { if (editing) e.stopPropagation(); }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(displayName); }
            }}
            style={{
              width: "100%",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1A1A",
              border: "1px solid #E4E1DC",
              outline: "none",
              backgroundColor: "#fff",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          />
        ) : (
          <p
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="truncate"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              fontWeight: isSelected ? 600 : 400,
              color: isSelected ? "#1A1A1A" : "#9A9590",
              cursor: "text",
            }}
            title="Double-click to rename"
          >
            {displayName}
          </p>
        )}
        {assignedSpec && !editing && (
          <p
            className="truncate"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 1 }}
          >
            {assignedSpec.name}
          </p>
        )}
      </div>

      {!editing && hover && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex items-center justify-center transition-opacity"
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: "1px solid #E4E1DC",
            backgroundColor: "rgba(255,255,255,0.95)",
            cursor: "pointer",
            flexShrink: 0,
          }}
          title="Rename mesh"
        >
          <Pencil size={10} color="#9A9590" />
        </button>
      )}

      {!editing && !hover && isSelected && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#FFDE28",
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}
