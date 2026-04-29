"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, RotateCcw, SlidersHorizontal, Check, Link2, Link2Off } from "lucide-react";
import type { SpecLite } from "@/app/projects/[id]/studio/actions";
import type { MeshInfo, MaterialAssignments } from "./StudioCanvas";
import { readAssignment } from "./StudioCanvas";

interface MaterialPanelProps {
  selectedMeshes: MeshInfo[];
  specs: SpecLite[];
  materialAssignments: MaterialAssignments;
  meshLabels: Record<string, string>;
  linkSameMaterial: boolean;
  onLinkSameMaterialChange: (next: boolean) => void;
  onAssign: (specId: string) => void;
  onUnassign: () => void;
  onUpdateTransform: (
    meshKey: string,
    transform: {
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
      roughness?: number;
      metalness?: number;
      brightness?: number;
    },
  ) => void;
}

const EXCLUDED_KEY = "studio:excluded-categories";
const SCALE_LINKED_KEY = "studio:scale-linked";

export default function MaterialPanel({
  selectedMeshes,
  specs,
  materialAssignments,
  meshLabels,
  linkSameMaterial,
  onLinkSameMaterialChange,
  onAssign,
  onUnassign,
  onUpdateTransform,
}: MaterialPanelProps) {
  const primaryMesh = selectedMeshes[selectedMeshes.length - 1] ?? null;
  const isMulti = selectedMeshes.length > 1;
  const primaryLabel = primaryMesh
    ? (meshLabels[primaryMesh.name || primaryMesh.id] ?? primaryMesh.name ?? "Unnamed mesh")
    : null;
  const [query, setQuery] = useState("");
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const [scaleLinked, setScaleLinked] = useState<boolean>(true);

  // Load excluded categories + scale-linked pref from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXCLUDED_KEY);
      if (raw) setExcludedCategories(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(SCALE_LINKED_KEY);
      if (raw !== null) setScaleLinked(raw === "true");
    } catch { /* ignore */ }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(Array.from(excludedCategories)));
  }, [excludedCategories]);
  useEffect(() => {
    localStorage.setItem(SCALE_LINKED_KEY, String(scaleLinked));
  }, [scaleLinked]);

  // Close filter on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!filterWrapRef.current?.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filterOpen]);

  const allCategories = Array.from(
    new Set(specs.map((s) => s.category ?? "Uncategorised")),
  ).sort((a, b) => a.localeCompare(b));

  const visibleSpecs = specs.filter(
    (s) => !excludedCategories.has(s.category ?? "Uncategorised"),
  );

  const filtered = query.trim()
    ? visibleSpecs.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          (s.category ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : visibleSpecs;

  const toggleCategory = (cat: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const grouped = filtered.reduce<Record<string, SpecLite[]>>((acc, s) => {
    const cat = s.category ?? "Uncategorised";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // For levels/transforms, show controls only when a single mesh is selected
  const rawAssignment = primaryMesh && !isMulti
    ? materialAssignments[primaryMesh.name] ?? materialAssignments[primaryMesh.id]
    : undefined;
  const assignment = readAssignment(rawAssignment);
  const assignedSpecId = assignment?.specId ?? null;
  const assignedSpec = assignedSpecId ? specs.find((s) => s.id === assignedSpecId) : null;
  const meshKey = primaryMesh ? (primaryMesh.name || primaryMesh.id) : null;

  // For multi-select, find the most-common assigned spec (just for highlight in picker)
  const multiAssignedSpecId = isMulti
    ? selectedMeshes
        .map((m) => readAssignment(materialAssignments[m.name] ?? materialAssignments[m.id])?.specId ?? null)
        .find((id): id is string => Boolean(id)) ?? null
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid #E4E1DC" }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Material
        </p>
        {primaryMesh ? (
          isMulti ? (
            <p
              className="mt-0.5"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
            >
              {selectedMeshes.length} meshes selected
            </p>
          ) : (
            <p
              className="truncate mt-0.5"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
            >
              {primaryLabel}
            </p>
          )
        ) : (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", marginTop: 2 }}>
            Select a mesh to assign material
          </p>
        )}
        {isMulti && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 2 }}>
            Pick a spec to apply to all
          </p>
        )}
      </div>

      {/* Current assignment (single-select only) */}
      {primaryMesh && !isMulti && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #E4E1DC" }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Assigned
          </p>
          {assignedSpec ? (
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: "#E4E1DC",
                  flexShrink: 0,
                }}
              >
                {assignedSpec.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assignedSpec.image_url}
                    alt={assignedSpec.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
                  {assignedSpec.name}
                </p>
                {assignedSpec.category && (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
                    {assignedSpec.category}
                  </p>
                )}
              </div>
              <button
                onClick={onUnassign}
                className="flex items-center justify-center transition-opacity hover:opacity-60"
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E4E1DC", backgroundColor: "#fff", flexShrink: 0, cursor: "pointer" }}
                title="Remove assignment"
              >
                <X size={12} color="#9A9590" />
              </button>
            </div>
          ) : (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}>
              No material assigned
            </p>
          )}

          {/* Texture transforms (only when assigned) */}
          {assignedSpec && assignment && meshKey && (
            <div className="mt-3 flex flex-col gap-2.5">
              {/* Link toggle */}
              <label
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  backgroundColor: linkSameMaterial ? "#FFFBEB" : "#F5F3F0",
                  border: linkSameMaterial ? "1px solid #FFE873" : "1px solid #E4E1DC",
                }}
                title="When on, scale/rotation/level changes apply to every mesh using this same material"
              >
                <input
                  type="checkbox"
                  checked={linkSameMaterial}
                  onChange={(e) => onLinkSameMaterialChange(e.target.checked)}
                  style={{ width: 13, height: 13, cursor: "pointer", accentColor: "#1A1A1A" }}
                />
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", fontWeight: 500 }}>
                  Apply to all meshes using this material
                </span>
              </label>

              <div className="flex items-center justify-between mt-1">
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Texture
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // When linking, snap Y to current X so they match
                      if (!scaleLinked) onUpdateTransform(meshKey, { scaleY: assignment.scaleX });
                      setScaleLinked(!scaleLinked);
                    }}
                    className="flex items-center justify-center transition-colors"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: "1px solid #E4E1DC",
                      backgroundColor: scaleLinked ? "#FFFBEB" : "#fff",
                      cursor: "pointer",
                    }}
                    title={scaleLinked ? "Unlink X / Y scale" : "Link X / Y scale"}
                  >
                    {scaleLinked
                      ? <Link2 size={10} color="#1A1A1A" />
                      : <Link2Off size={10} color="#9A9590" />}
                  </button>
                  <button
                    onClick={() => onUpdateTransform(meshKey, { scaleX: 1, scaleY: 1, rotation: 0 })}
                    className="flex items-center gap-1 transition-opacity hover:opacity-60"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 10 }}
                    title="Reset texture transforms"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                </div>
              </div>

              {scaleLinked ? (
                <SliderRow
                  label="Scale"
                  value={assignment.scaleX}
                  min={0.1}
                  max={10}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}×`}
                  onChange={(v) => onUpdateTransform(meshKey, { scaleX: v, scaleY: v })}
                />
              ) : (
                <>
                  <SliderRow
                    label="Scale X"
                    value={assignment.scaleX}
                    min={0.1}
                    max={10}
                    step={0.1}
                    format={(v) => `${v.toFixed(1)}×`}
                    onChange={(v) => onUpdateTransform(meshKey, { scaleX: v })}
                  />
                  <SliderRow
                    label="Scale Y"
                    value={assignment.scaleY}
                    min={0.1}
                    max={10}
                    step={0.1}
                    format={(v) => `${v.toFixed(1)}×`}
                    onChange={(v) => onUpdateTransform(meshKey, { scaleY: v })}
                  />
                </>
              )}
              <SliderRow
                label="Rotation"
                value={assignment.rotation}
                min={0}
                max={360}
                step={1}
                format={(v) => `${Math.round(v)}°`}
                onChange={(v) => onUpdateTransform(meshKey, { rotation: v })}
              />

              <div className="flex items-center justify-between mt-1">
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Levels
                </p>
                <button
                  onClick={() => onUpdateTransform(meshKey, { roughness: 0.55, metalness: 0, brightness: 1 })}
                  className="flex items-center gap-1 transition-opacity hover:opacity-60"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 10 }}
                  title="Reset levels"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              </div>

              <SliderRow
                label="Brightness"
                value={assignment.brightness}
                min={0.2}
                max={1}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onUpdateTransform(meshKey, { brightness: v })}
              />
              <SliderRow
                label="Roughness"
                value={assignment.roughness}
                min={0}
                max={1}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdateTransform(meshKey, { roughness: v })}
              />
              <SliderRow
                label="Metalness"
                value={assignment.metalness}
                min={0}
                max={1}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdateTransform(meshKey, { metalness: v })}
              />
            </div>
          )}
        </div>
      )}

      {/* Spec picker */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Project Specs {excludedCategories.size > 0 && (
                <span style={{ color: "#C0BEBB", fontWeight: 500 }}>· {excludedCategories.size} hidden</span>
              )}
            </p>
            <div ref={filterWrapRef} className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center justify-center transition-colors"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: "1px solid #E4E1DC",
                  backgroundColor: filterOpen || excludedCategories.size > 0 ? "#FFFBEB" : "#fff",
                  cursor: "pointer",
                }}
                title="Filter categories"
              >
                <SlidersHorizontal size={11} color={excludedCategories.size > 0 ? "#1A1A1A" : "#9A9590"} />
              </button>

              {filterOpen && (
                <div
                  className="absolute z-30 mt-1.5"
                  style={{
                    top: "100%",
                    right: 0,
                    width: 220,
                    maxHeight: 320,
                    overflow: "auto",
                    backgroundColor: "#fff",
                    border: "1px solid #E4E1DC",
                    borderRadius: 10,
                    boxShadow: "0 4px 16px rgba(26,26,26,0.10)",
                    padding: 6,
                  }}
                >
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 6px 6px" }}>
                    Show categories
                  </p>
                  {allCategories.length === 0 && (
                    <div className="px-2 py-3 text-center" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}>
                      No specs yet
                    </div>
                  )}
                  {allCategories.map((cat) => {
                    const visible = !excludedCategories.has(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center gap-2 transition-colors"
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F5F3F0"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            border: visible ? "none" : "1px solid #E4E1DC",
                            backgroundColor: visible ? "#FFDE28" : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {visible && <Check size={10} color="#1A1A1A" strokeWidth={3} />}
                        </div>
                        <span
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-inter), sans-serif",
                            fontSize: 12,
                            color: visible ? "#1A1A1A" : "#9A9590",
                          }}
                        >
                          {cat}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#C0BEBB" />
            <input
              type="text"
              placeholder="Search specs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: 28,
                paddingRight: 8,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 8,
                border: "1px solid #E4E1DC",
                fontSize: 12,
                fontFamily: "var(--font-inter), sans-serif",
                color: "#1A1A1A",
                backgroundColor: "#F5F3F0",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-3">
          {specs.length === 0 && (
            <div className="px-4 py-6 text-center" style={{ color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", fontSize: 12 }}>
              No specs in this project yet.
            </div>
          )}

          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catSpecs]) => (
            <div key={cat} className="mb-1">
              <p
                className="px-4 py-1.5"
                style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.06em" }}
              >
                {cat}
              </p>
              {catSpecs.map((spec) => {
                const isAssigned = isMulti
                  ? multiAssignedSpecId === spec.id
                  : assignedSpecId === spec.id;
                const disabled = selectedMeshes.length === 0;

                return (
                  <button
                    key={spec.id}
                    onClick={() => !disabled && onAssign(spec.id)}
                    disabled={disabled}
                    className="w-full flex items-center gap-2.5 px-4 py-2 transition-colors"
                    style={{
                      backgroundColor: isAssigned ? "#FFFBEB" : "transparent",
                      border: "none",
                      cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.5 : 1,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onMouseEnter={(e: any) => { if (!disabled && !isAssigned) e.currentTarget.style.backgroundColor = "#F5F3F0"; }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onMouseLeave={(e: any) => { if (!isAssigned) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 7,
                        overflow: "hidden",
                        backgroundColor: "#E4E1DC",
                        flexShrink: 0,
                        border: isAssigned ? "2px solid #FFDE28" : "2px solid transparent",
                      }}
                    >
                      {spec.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spec.image_url}
                          alt={spec.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className="truncate"
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontSize: 12,
                          fontWeight: isAssigned ? 600 : 400,
                          color: isAssigned ? "#1A1A1A" : "#9A9590",
                        }}
                      >
                        {spec.name}
                      </p>
                    </div>
                    {isAssigned && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FFDE28", flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
