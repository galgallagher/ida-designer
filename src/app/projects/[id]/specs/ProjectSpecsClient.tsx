"use client";

/**
 * ProjectSpecsClient — /projects/[id]/specs
 *
 * Displays project spec items grouped by SpecItemType, filtered by the
 * active Project Option (A/B/C). A 2-step dialog lets the user add specs
 * from the studio library to the active option.
 */

import { useState, useTransition, useMemo } from "react";
import { Plus, Package, Loader2, Pin, X } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OptionTabs from "@/components/OptionTabs";
import { addSpecToProject, removeSpecFromProject, addProjectOption } from "./actions";
import type { ProjectOptionRow, ProjectSpecRow, SpecItemType, SpecStatus, DrawingType } from "@/types/database";

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
type DrawingOption = {
  id: string;
  name: string;
  project_option_id: string | null;
  drawing_type: DrawingType | null;
};

interface Props {
  projectId: string;
  projectName: string;
  options: ProjectOptionRow[];
  projectSpecs: ProjectSpecRow[];
  specDetails: SpecDetail[];
  drawings: DrawingOption[];
  librarySpecs: SpecDetail[];
}

// ── Step 2 form state ─────────────────────────────────────────────────────────

type Step2Form = {
  item_type: SpecItemType | "";
  drawing_id: string;
  notes: string;
};

const emptyStep2: Step2Form = { item_type: "", drawing_id: "", notes: "" };

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectSpecsClient({
  projectId,
  projectName,
  options,
  projectSpecs,
  specDetails,
  drawings,
  librarySpecs,
}: Props) {
  // ── Active option ────────────────────────────────────────────────────────────
  const defaultOption = options.find((o) => o.is_default) ?? options[0] ?? null;
  const [activeOptionId, setActiveOptionId] = useState<string | null>(defaultOption?.id ?? null);

  // ── Add spec dialog ──────────────────────────────────────────────────────────
  const [addSpecOpen, setAddSpecOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<SpecDetail | null>(null);
  const [step2Form, setStep2Form] = useState<Step2Form>(emptyStep2);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Add option dialog ────────────────────────────────────────────────────────
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [optionName, setOptionName] = useState("");
  const [optionError, setOptionError] = useState<string | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Build a map for fast spec detail lookup
  const specDetailMap = useMemo(() => {
    const map = new Map<string, SpecDetail>();
    specDetails.forEach((s) => map.set(s.id, s));
    return map;
  }, [specDetails]);

  // Filter project specs to the active option, then group by item_type
  const activeSpecs = useMemo(() => {
    if (!activeOptionId) return [];
    return projectSpecs.filter((ps) => ps.project_option_id === activeOptionId);
  }, [projectSpecs, activeOptionId]);

  // Specs already in active option (to exclude from picker)
  const addedSpecIds = useMemo(() => new Set(activeSpecs.map((ps) => ps.spec_id)), [activeSpecs]);

  // Group by item_type
  const groupedSpecs = useMemo(() => {
    const groups = new Map<SpecItemType | "unassigned", ProjectSpecRow[]>();
    activeSpecs.forEach((ps) => {
      const key = ps.item_type ?? "unassigned";
      if (!groups.has(key as SpecItemType | "unassigned")) {
        groups.set(key as SpecItemType | "unassigned", []);
      }
      groups.get(key as SpecItemType | "unassigned")!.push(ps);
    });
    return groups;
  }, [activeSpecs]);

  // Drawings for the active option (used in step 2 drawing picker)
  const activeDrawings = useMemo(() => {
    if (!activeOptionId) return [];
    return drawings.filter((d) => d.project_option_id === activeOptionId);
  }, [drawings, activeOptionId]);

  // Filtered library specs for the search in step 1
  const filteredLibrary = useMemo(() => {
    const q = search.toLowerCase().trim();
    return librarySpecs.filter(
      (s) => !addedSpecIds.has(s.id) && (q === "" || s.name.toLowerCase().includes(q))
    );
  }, [librarySpecs, search, addedSpecIds]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openAddSpec() {
    setAddStep(1);
    setSearch("");
    setSelectedSpec(null);
    setStep2Form(emptyStep2);
    setAddError(null);
    setAddSpecOpen(true);
  }

  function closeAddSpec() {
    setAddSpecOpen(false);
    setSelectedSpec(null);
    setStep2Form(emptyStep2);
    setAddError(null);
    setSearch("");
  }

  function pickSpec(spec: SpecDetail) {
    setSelectedSpec(spec);
    setAddStep(2);
    setAddError(null);
  }

  function handleAddSpecSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSpec || !activeOptionId) return;
    if (!step2Form.item_type) { setAddError("Please select an item type."); return; }
    setAddError(null);

    startTransition(async () => {
      const result = await addSpecToProject(projectId, {
        project_option_id: activeOptionId,
        spec_id: selectedSpec.id,
        item_type: step2Form.item_type as SpecItemType,
        drawing_id: step2Form.drawing_id || null,
        notes: step2Form.notes.trim() || null,
      });
      if (result.error) {
        setAddError(result.error);
      } else {
        closeAddSpec();
      }
    });
  }

  function handleRemoveSpec(projectSpecId: string) {
    if (!window.confirm("Remove this spec from the project option?")) return;
    startTransition(async () => {
      await removeSpecFromProject(projectSpecId, projectId);
    });
  }

  function handleAddOption(e: React.FormEvent) {
    e.preventDefault();
    setOptionError(null);
    startTransition(async () => {
      const result = await addProjectOption(projectId, optionName);
      if (result.error) {
        setOptionError(result.error);
      } else {
        setAddOptionOpen(false);
        setOptionName("");
        // Switch to the new option
        if (result.optionId) setActiveOptionId(result.optionId);
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const activeOption = options.find((o) => o.id === activeOptionId);

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Specs
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
          </p>
        </div>
        {activeOptionId && (
          <button
            type="button"
            onClick={openAddSpec}
            disabled={isPending}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            <Plus size={14} />
            Add spec
          </button>
        )}
      </div>

      {/* ── Option tabs ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <OptionTabs
          options={options}
          activeId={activeOptionId}
          onSelect={setActiveOptionId}
          onAddOption={() => { setOptionName(""); setOptionError(null); setAddOptionOpen(true); }}
          disabled={isPending}
        />
      </div>

      {/* ── No options yet ──────────────────────────────────────────────────── */}
      {options.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
            No options yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 16, maxWidth: 320, lineHeight: 1.6 }}>
            This project has no design options. Create Option A to start adding specs.
          </p>
          <button
            type="button"
            onClick={() => { setOptionName("Option A"); setOptionError(null); setAddOptionOpen(true); }}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
          >
            <Plus size={14} />
            Create Option A
          </button>
        </div>
      )}

      {/* ── Spec groups ────────────────────────────────────────────────────── */}
      {activeOptionId && (
        <div className="flex flex-col gap-8">
          {/* Show sections in order for types that have items */}
          {ITEM_TYPE_ORDER.map((itemType) => {
            const items = groupedSpecs.get(itemType);
            if (!items || items.length === 0) return null;
            return (
              <SpecSection
                key={itemType}
                label={ITEM_TYPE_LABELS[itemType]}
                items={items}
                specDetailMap={specDetailMap}
                onRemove={handleRemoveSpec}
                isPending={isPending}
              />
            );
          })}

          {/* Unassigned specs (item_type is null) */}
          {(() => {
            const unassigned = groupedSpecs.get("unassigned");
            if (!unassigned || unassigned.length === 0) return null;
            return (
              <SpecSection
                label="Unassigned"
                items={unassigned}
                specDetailMap={specDetailMap}
                onRemove={handleRemoveSpec}
                isPending={isPending}
              />
            );
          })()}

          {/* Empty state */}
          {activeSpecs.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-16 text-center"
              style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
            >
              <div className="flex items-center justify-center mb-4" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB", borderRadius: 12 }}>
                <Package size={20} style={{ color: "#9A9590" }} />
              </div>
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
                No specs yet for Option {activeOption?.label}
              </p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 20, lineHeight: 1.6, maxWidth: 320 }}>
                Add specs from your studio library to build the schedule for this option.
              </p>
              <button
                type="button"
                onClick={openAddSpec}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
              >
                <Plus size={14} />
                Add first spec
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add Spec Dialog (2-step) ────────────────────────────────────────── */}
      <Dialog open={addSpecOpen} onOpenChange={(open) => { if (!open) closeAddSpec(); }}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              {addStep === 1 ? "Choose a spec" : `Configure: ${selectedSpec?.name ?? ""}`}
            </DialogTitle>
          </DialogHeader>

          {/* ── Step 1: Library picker ─────────────────────────────────────── */}
          {addStep === 1 && (
            <div className="flex flex-col gap-3 mt-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search specs…"
                style={inputStyle}
              />
              <div
                className="flex flex-col gap-1 overflow-y-auto"
                style={{ maxHeight: 320, minHeight: 120 }}
              >
                {filteredLibrary.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", textAlign: "center", padding: "24px 0" }}>
                    {search ? "No matching specs." : "Your library is empty. Scrape some specs first."}
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
                      {/* Thumbnail */}
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#F0EEEB", overflow: "hidden" }}
                      >
                        {spec.image_url ? (
                          <Image src={spec.image_url} alt={spec.name} width={40} height={40} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
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

          {/* ── Step 2: Configure ──────────────────────────────────────────── */}
          {addStep === 2 && selectedSpec && (
            <form onSubmit={handleAddSpecSubmit} className="flex flex-col gap-4 mt-2">
              {/* Item type */}
              <div>
                <label style={labelStyle}>
                  Item type <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  value={step2Form.item_type}
                  onChange={(e) => setStep2Form((f) => ({ ...f, item_type: e.target.value as SpecItemType | "" }))}
                  required
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="" disabled>Select item type…</option>
                  {ITEM_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Drawing pin (optional) */}
              <div>
                <label style={labelStyle}>
                  Pin to drawing <span style={{ color: "#9A9590", fontWeight: 400 }}>(optional)</span>
                </label>
                <select
                  value={step2Form.drawing_id}
                  onChange={(e) => setStep2Form((f) => ({ ...f, drawing_id: e.target.value }))}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="">None</option>
                  {activeDrawings.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {activeDrawings.length === 0 && (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", marginTop: 4 }}>
                    No drawings in this option yet — add drawings first to pin specs.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>
                  Notes <span style={{ color: "#9A9590", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={step2Form.notes}
                  onChange={(e) => setStep2Form((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes for this spec item…"
                  rows={2}
                  style={{ ...inputStyle, height: "auto", paddingTop: 10, paddingBottom: 10, resize: "vertical", lineHeight: 1.5 }}
                />
              </div>

              {addError && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                  {addError}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setAddStep(1); setAddError(null); }}
                  style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "transparent", border: "1.5px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#9A9590", cursor: "pointer" }}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={isPending || !step2Form.item_type}
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Add spec
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Option Dialog ──────────────────────────────────────────────── */}
      <Dialog open={addOptionOpen} onOpenChange={(open) => { if (!open) { setAddOptionOpen(false); setOptionName(""); setOptionError(null); } }}>
        <DialogContent style={{ maxWidth: 380 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              Add option
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddOption} className="flex flex-col gap-4 mt-2">
            <div>
              <label style={labelStyle}>Option name <span style={{ color: "#DC2626" }}>*</span></label>
              <input
                autoFocus
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                placeholder="e.g. Option B"
                required
                style={inputStyle}
              />
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", marginTop: 6 }}>
                The option label (A, B, C…) is assigned automatically.
              </p>
            </div>
            {optionError && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                {optionError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setAddOptionOpen(false); setOptionName(""); setOptionError(null); }}
                style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "transparent", border: "1.5px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#9A9590", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                Add option
              </button>
            </div>
          </form>
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
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
          {items.length}
        </span>
      </div>

      {/* Horizontally scrollable card row */}
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((ps) => {
          const spec = specDetailMap.get(ps.spec_id);
          return (
            <SpecCard
              key={ps.id}
              projectSpec={ps}
              spec={spec ?? null}
              onRemove={onRemove}
              isPending={isPending}
            />
          );
        })}
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
      className="flex flex-col flex-shrink-0"
      style={{ width: 200, backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 2px 12px rgba(26,26,26,0.08)", padding: 14, position: "relative" }}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(projectSpec.id)}
        disabled={isPending}
        title="Remove from option"
        className="absolute transition-opacity hover:opacity-100 opacity-0 group-hover:opacity-100"
        style={{
          top: 8,
          right: 8,
          width: 22,
          height: 22,
          border: "none",
          background: "rgba(26,26,26,0.06)",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9A9590",
        }}
      >
        <X size={11} />
      </button>

      {/* Thumbnail */}
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "#F0EEEB", overflow: "hidden" }}
      >
        {spec?.image_url ? (
          <Image src={spec.image_url} alt={spec.name ?? ""} width={48} height={48} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        ) : (
          <Package size={20} style={{ color: "#C0BEBB" }} />
        )}
      </div>

      {/* Spec name */}
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", lineHeight: 1.4, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {spec?.name ?? "Unknown spec"}
      </p>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
        {/* Status badge */}
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", backgroundColor: statusCfg.bg, color: statusCfg.color, borderRadius: 20, padding: "2px 7px" }}>
          {statusCfg.label}
        </span>

        {/* Drawing pin indicator */}
        {projectSpec.drawing_id && (
          <span
            title="Pinned to a drawing"
            className="flex items-center gap-1"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "2px 7px" }}
          >
            <Pin size={9} />
            Pinned
          </span>
        )}
      </div>
    </div>
  );
}
