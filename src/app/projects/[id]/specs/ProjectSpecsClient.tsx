"use client";

/**
 * ProjectSpecsClient — /projects/[id]/specs
 *
 * A flat schedule of spec items assigned to this project, grouped by item
 * type. Specs are added by picking from the studio library — no tabs, no
 * parallel design directions, just everything being considered.
 */

import { useState, useTransition, useMemo } from "react";
import { Plus, Package, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addSpecToProject, removeSpecFromProject } from "./actions";
import type { ProjectSpecRow, SpecItemType, SpecStatus } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_TYPE_ORDER: SpecItemType[] = [
  "ffe",
  "joinery",
  "ironmongery",
  "sanitaryware",
  "arch_id_finishes",
  "joinery_finishes",
];

const ITEM_TYPE_LABELS: Record<SpecItemType, string> = {
  ffe: "FF&E",
  ironmongery: "Ironmongery",
  sanitaryware: "Sanitaryware",
  joinery: "Joinery",
  arch_id_finishes: "Arch ID Finishes",
  joinery_finishes: "Joinery Finishes",
};

const STATUS_CONFIG: Record<SpecStatus, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#F0EEEB", color: "#9A9590", label: "Draft" },
  specified: { bg: "#DBEAFE", color: "#2563EB", label: "Specified" },
  approved:  { bg: "#DCFCE7", color: "#16A34A", label: "Approved" },
  ordered:   { bg: "#FED7AA", color: "#EA580C", label: "Ordered" },
  delivered: { bg: "#EDE9FE", color: "#7C3AED", label: "Delivered" },
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  paddingLeft: 12,
  paddingRight: 12,
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13,
  color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 12,
  fontWeight: 600,
  color: "#1A1A1A",
  marginBottom: 6,
  display: "block",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SpecDetail = { id: string; name: string; image_url: string | null };

interface Props {
  projectId: string;
  projectName: string;
  projectSpecs: ProjectSpecRow[];
  specDetails: SpecDetail[];
  librarySpecs: SpecDetail[];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectSpecsClient({
  projectId,
  projectName,
  projectSpecs,
  specDetails,
  librarySpecs,
}: Props) {
  // ── Add spec dialog ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<SpecDetail | null>(null);
  const [itemType, setItemType] = useState<SpecItemType | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Derived data ─────────────────────────────────────────────────────────────

  const specDetailMap = useMemo(() => {
    const map = new Map<string, SpecDetail>();
    specDetails.forEach((s) => map.set(s.id, s));
    return map;
  }, [specDetails]);

  // Spec IDs already in the project (exclude from picker)
  const addedSpecIds = useMemo(() => new Set(projectSpecs.map((ps) => ps.spec_id)), [projectSpecs]);

  // Group specs by item_type
  const groupedSpecs = useMemo(() => {
    const groups = new Map<SpecItemType | "unassigned", ProjectSpecRow[]>();
    projectSpecs.forEach((ps) => {
      const key = (ps.item_type as SpecItemType | null) ?? "unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ps);
    });
    return groups;
  }, [projectSpecs]);

  // Filtered library for the picker
  const filteredLibrary = useMemo(() => {
    const q = search.toLowerCase().trim();
    return librarySpecs.filter(
      (s) => !addedSpecIds.has(s.id) && (q === "" || s.name.toLowerCase().includes(q))
    );
  }, [librarySpecs, search, addedSpecIds]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openDialog() {
    setStep(1);
    setSearch("");
    setSelectedSpec(null);
    setItemType("");
    setNotes("");
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedSpec(null);
    setItemType("");
    setNotes("");
    setError(null);
    setSearch("");
  }

  function pickSpec(spec: SpecDetail) {
    setSelectedSpec(spec);
    setStep(2);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSpec || !itemType) { setError("Please select an item type."); return; }
    setError(null);
    startTransition(async () => {
      const result = await addSpecToProject(projectId, {
        spec_id: selectedSpec.id,
        item_type: itemType as SpecItemType,
        notes: notes.trim() || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        closeDialog();
      }
    });
  }

  function handleRemove(projectSpecId: string) {
    if (!window.confirm("Remove this spec from the project?")) return;
    startTransition(async () => {
      await removeSpecFromProject(projectSpecId, projectId);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalCount = projectSpecs.length;

  return (
    <div style={{ maxWidth: 860 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Specs
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
            {totalCount > 0 && (
              <span style={{ marginLeft: 8, backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 8px" }}>
                {totalCount}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          disabled={isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add spec
        </button>
      </div>

      {/* ── Grouped spec sections ──────────────────────────────────────────── */}
      {projectSpecs.length > 0 ? (
        <div className="flex flex-col gap-8">
          {ITEM_TYPE_ORDER.map((type) => {
            const items = groupedSpecs.get(type);
            if (!items || items.length === 0) return null;
            return (
              <SpecSection
                key={type}
                label={ITEM_TYPE_LABELS[type]}
                items={items}
                specDetailMap={specDetailMap}
                onRemove={handleRemove}
                isPending={isPending}
              />
            );
          })}
          {/* Unassigned (no item_type set) */}
          {(() => {
            const items = groupedSpecs.get("unassigned");
            if (!items || items.length === 0) return null;
            return (
              <SpecSection
                label="Unassigned"
                items={items}
                specDetailMap={specDetailMap}
                onRemove={handleRemove}
                isPending={isPending}
              />
            );
          })()}
        </div>
      ) : (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ borderRadius: 16, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <div className="flex items-center justify-center mb-4" style={{ width: 52, height: 52, backgroundColor: "#F0EEEB", borderRadius: 14 }}>
            <Package size={22} style={{ color: "#9A9590" }} />
          </div>
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>
            No specs yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 24, lineHeight: 1.6, maxWidth: 340 }}>
            Add products and materials from your studio library to build the schedule for this project.
          </p>
          <button
            type="button"
            onClick={openDialog}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 38, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
          >
            <Plus size={14} />
            Add first spec
          </button>
        </div>
      )}

      {/* ── Add Spec Dialog ────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              {step === 1 ? "Add spec" : selectedSpec?.name ?? "Configure spec"}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — Library picker */}
          {step === 1 && (
            <div className="flex flex-col gap-3 mt-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your library…"
                style={inputStyle}
              />
              <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 340, minHeight: 100 }}>
                {filteredLibrary.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", textAlign: "center", padding: "28px 0" }}>
                    {librarySpecs.length === 0
                      ? "Your library is empty. Use Ida to scrape some products first."
                      : search
                      ? "No matching specs."
                      : "All library specs are already in this project."}
                  </p>
                ) : (
                  filteredLibrary.map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => pickSpec(spec)}
                      className="flex items-center gap-3 text-left transition-colors hover:bg-black/[0.04]"
                      style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "none", cursor: "pointer", width: "100%" }}
                    >
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#F0EEEB", overflow: "hidden" }}
                      >
                        {spec.image_url ? (
                          <img src={spec.image_url} alt={spec.name} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                        ) : (
                          <Package size={16} style={{ color: "#C0BEBB" }} />
                        )}
                      </div>
                      <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {spec.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === 2 && selectedSpec && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
              {/* Selected spec preview */}
              <div
                className="flex items-center gap-3"
                style={{ padding: "10px 12px", backgroundColor: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EEEB" }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#F0EEEB", overflow: "hidden" }}
                >
                  {selectedSpec.image_url ? (
                    <img src={selectedSpec.image_url} alt={selectedSpec.name} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                  ) : (
                    <Package size={14} style={{ color: "#C0BEBB" }} />
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedSpec.name}
                </span>
              </div>

              {/* Item type */}
              <div>
                <label style={labelStyle}>
                  Schedule type <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  autoFocus
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as SpecItemType | "")}
                  required
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="" disabled>Which schedule does this belong to?</option>
                  {ITEM_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>
                  Notes <span style={{ color: "#9A9590", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for this item…"
                  rows={2}
                  style={{ ...inputStyle, height: "auto", paddingTop: 10, paddingBottom: 10, resize: "vertical", lineHeight: 1.5 }}
                />
              </div>

              {error && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null); }}
                  style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "transparent", border: "1.5px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#9A9590", cursor: "pointer" }}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={isPending || !itemType}
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Add to project
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SpecSection ───────────────────────────────────────────────────────────────

function SpecSection({
  label,
  items,
  specDetailMap,
  onRemove,
  isPending,
}: {
  label: string;
  items: ProjectSpecRow[];
  specDetailMap: Map<string, SpecDetail>;
  onRemove: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
          {items.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((ps) => (
          <SpecCard
            key={ps.id}
            projectSpec={ps}
            spec={specDetailMap.get(ps.spec_id) ?? null}
            onRemove={onRemove}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

// ── SpecCard ──────────────────────────────────────────────────────────────────

function SpecCard({
  projectSpec,
  spec,
  onRemove,
  isPending,
}: {
  projectSpec: ProjectSpecRow;
  spec: SpecDetail | null;
  onRemove: (id: string) => void;
  isPending: boolean;
}) {
  const statusCfg = STATUS_CONFIG[projectSpec.status] ?? STATUS_CONFIG.draft;

  return (
    <div
      className="group flex flex-col flex-shrink-0"
      style={{ width: 180, backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 2px 12px rgba(26,26,26,0.07)", padding: "14px 14px 12px", position: "relative" }}
    >
      {/* Remove button — visible on hover */}
      <button
        type="button"
        onClick={() => onRemove(projectSpec.id)}
        disabled={isPending}
        title="Remove from project"
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          top: 8, right: 8,
          width: 20, height: 20,
          border: "none",
          background: "rgba(26,26,26,0.08)",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9A9590",
          padding: 0,
        }}
      >
        <X size={10} />
      </button>

      {/* Thumbnail */}
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#F0EEEB", overflow: "hidden" }}
      >
        {spec?.image_url ? (
          <img src={spec.image_url} alt={spec.name ?? ""} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        ) : (
          <Package size={18} style={{ color: "#C0BEBB" }} />
        )}
      </div>

      {/* Spec name */}
      <p
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: "#1A1A1A",
          lineHeight: 1.4,
          marginBottom: 8,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {spec?.name ?? "Unknown spec"}
      </p>

      {/* Status badge */}
      <span
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          backgroundColor: statusCfg.bg,
          color: statusCfg.color,
          borderRadius: 20,
          padding: "2px 7px",
          alignSelf: "flex-start",
          marginTop: "auto",
        }}
      >
        {statusCfg.label}
      </span>
    </div>
  );
}
