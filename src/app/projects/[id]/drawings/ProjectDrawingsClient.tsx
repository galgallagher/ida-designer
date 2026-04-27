"use client";

/**
 * ProjectDrawingsClient — /projects/[id]/drawings
 *
 * Shows drawings grouped by type (Arch ID, Joinery, FF&E), filtered by the
 * active Project Option. Each drawing card shows its assigned finish codes.
 * Clicking a card opens a Sheet panel to manage finishes and view pinned specs.
 */

import { useState, useTransition, useMemo } from "react";
import { Plus, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addDrawing, addFinishToDrawing, removeFinishFromDrawing, deleteDrawing } from "./actions";
import type { DrawingType, SpecItemType, SpecStatus } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrawingEntry = {
  id: string;
  name: string;
  drawing_type: DrawingType | null;
  order_index: number;
};

export type DrawingFinishEntry = {
  drawing_id: string;
  studio_finish_id: string;
  order_index: number;
};

export type StudioFinishEntry = {
  id: string;
  code: string;
  name: string;
  colour_hex: string | null;
};

export type PinnedSpecEntry = {
  id: string;
  spec_id: string | null;
  drawing_id: string | null;
  item_type: SpecItemType | null;
  status: SpecStatus;
};

interface Props {
  projectId: string;
  projectName: string;
  drawings: DrawingEntry[];
  drawingFinishes: DrawingFinishEntry[];
  studioFinishes: StudioFinishEntry[];
  pinnedSpecs: PinnedSpecEntry[];
  specNames: { id: string; name: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAWING_TYPE_SECTIONS: { type: DrawingType; label: string }[] = [
  { type: "arch_id", label: "Arch ID" },
  { type: "joinery", label: "Joinery" },
  { type: "ffe",     label: "FF&E" },
];

const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  arch_id: "Arch ID",
  joinery: "Joinery",
  ffe: "FF&E",
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectDrawingsClient({
  projectId,
  projectName,
  drawings,
  drawingFinishes,
  studioFinishes,
  pinnedSpecs,
  specNames,
}: Props) {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [addDrawingOpen, setAddDrawingOpen] = useState(false);
  const [drawingName, setDrawingName] = useState("");
  const [drawingType, setDrawingType] = useState<DrawingType | "">("");
  const [addDrawingError, setAddDrawingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [selectedFinishId, setSelectedFinishId] = useState("");

  // ── Derived data ─────────────────────────────────────────────────────────────

  const specNameMap = useMemo(() => {
    const map = new Map<string, string>();
    specNames.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [specNames]);


  // Finishes for a given drawing, sorted by order_index
  function getDrawingFinishes(drawingId: string): StudioFinishEntry[] {
    const finishIds = drawingFinishes
      .filter((df) => df.drawing_id === drawingId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((df) => df.studio_finish_id);
    return finishIds
      .map((id) => studioFinishes.find((f) => f.id === id))
      .filter((f): f is StudioFinishEntry => f !== undefined);
  }

  // Pinned specs for a given drawing
  function getDrawingPinnedSpecs(drawingId: string): PinnedSpecEntry[] {
    return pinnedSpecs.filter((ps) => ps.drawing_id === drawingId);
  }

  // Studio finishes NOT yet assigned to the selected drawing
  const availableFinishes = useMemo(() => {
    if (!selectedDrawingId) return studioFinishes;
    const assigned = new Set(
      drawingFinishes
        .filter((df) => df.drawing_id === selectedDrawingId)
        .map((df) => df.studio_finish_id)
    );
    return studioFinishes.filter((f) => !assigned.has(f.id));
  }, [selectedDrawingId, drawingFinishes, studioFinishes]);

  // Selected drawing object
  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openAddDrawing() {
    setDrawingName("");
    setDrawingType("");
    setAddDrawingError(null);
    setAddDrawingOpen(true);
  }

  function handleAddDrawing(e: React.FormEvent) {
    e.preventDefault();
    if (!drawingType) return;
    setAddDrawingError(null);
    startTransition(async () => {
      const result = await addDrawing(projectId, {
        name: drawingName,
        drawing_type: drawingType as DrawingType,
      });
      if (result.error) {
        setAddDrawingError(result.error);
      } else {
        setAddDrawingOpen(false);
        setDrawingName("");
        setDrawingType("");
      }
    });
  }

  function handleAddFinish() {
    if (!selectedDrawingId || !selectedFinishId) return;
    setSheetError(null);
    startTransition(async () => {
      const result = await addFinishToDrawing(selectedDrawingId, selectedFinishId, projectId);
      if (result.error) {
        setSheetError(result.error);
      } else {
        setSelectedFinishId("");
      }
    });
  }

  function handleRemoveFinish(studioFinishId: string) {
    if (!selectedDrawingId) return;
    setSheetError(null);
    startTransition(async () => {
      const result = await removeFinishFromDrawing(selectedDrawingId, studioFinishId, projectId);
      if (result.error) setSheetError(result.error);
    });
  }

  function handleDeleteDrawing(drawingId: string, drawingName: string) {
    if (!window.confirm(`Delete drawing "${drawingName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteDrawing(drawingId, projectId);
      if (selectedDrawingId === drawingId) setSelectedDrawingId(null);
    });
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Drawings
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
          </p>
        </div>
        <button
          type="button"
          onClick={openAddDrawing}
          disabled={isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add drawing
        </button>
      </div>

      {/* ── Drawing sections ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-8">
        {DRAWING_TYPE_SECTIONS.map(({ type, label }) => {
          const sectionDrawings = drawings.filter((d) => d.drawing_type === type);
          if (sectionDrawings.length === 0) return null;
          return (
            <DrawingSection
              key={type}
              label={label}
              drawings={sectionDrawings}
              drawingFinishes={drawingFinishes}
              studioFinishes={studioFinishes}
              pinnedSpecs={pinnedSpecs}
              onSelect={setSelectedDrawingId}
              onDelete={handleDeleteDrawing}
              isPending={isPending}
            />
          );
        })}

        {/* Drawings with null drawing_type */}
        {(() => {
          const others = drawings.filter((d) => !d.drawing_type);
          if (others.length === 0) return null;
          return (
            <DrawingSection
              label="Other"
              drawings={others}
              drawingFinishes={drawingFinishes}
              studioFinishes={studioFinishes}
              pinnedSpecs={pinnedSpecs}
              onSelect={setSelectedDrawingId}
              onDelete={handleDeleteDrawing}
              isPending={isPending}
            />
          );
        })()}

        {/* Empty state */}
        {drawings.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
          >
            <div className="flex items-center justify-center mb-4" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB", borderRadius: 12 }}>
              <ImageIcon size={20} style={{ color: "#9A9590" }} />
            </div>
            <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
              No drawings yet
            </p>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 20, lineHeight: 1.6, maxWidth: 320 }}>
              Add drawings like floor plans and elevations. Assign finish codes to each drawing and pin spec items to specific drawings.
            </p>
            <button
              type="button"
              onClick={openAddDrawing}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
            >
              <Plus size={14} />
              Add first drawing
            </button>
          </div>
        )}
      </div>

      {/* ── Drawing detail Sheet ───────────────────────────────────────────── */}
      <Sheet
        open={!!selectedDrawingId}
        onOpenChange={(open) => {
          if (!open) { setSelectedDrawingId(null); setSheetError(null); setSelectedFinishId(""); }
        }}
      >
        <SheetContent style={{ width: 400, padding: 0, display: "flex", flexDirection: "column" }}>
          {selectedDrawing && (
            <>
              <SheetHeader style={{ padding: "24px 24px 16px" }}>
                <SheetTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700 }}>
                  {selectedDrawing.name}
                </SheetTitle>
                {selectedDrawing.drawing_type && (
                  <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "2px 8px", alignSelf: "flex-start", marginTop: 4 }}>
                    {DRAWING_TYPE_LABELS[selectedDrawing.drawing_type]}
                  </span>
                )}
              </SheetHeader>

              <div className="flex flex-col gap-6 overflow-y-auto flex-1" style={{ padding: "0 24px 24px" }}>

                {/* ── Finish codes section ─────────────────────────────── */}
                <div>
                  <h3 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                    Finish Codes
                  </h3>

                  {/* Assigned finishes */}
                  <div className="flex flex-col gap-2 mb-3">
                    {getDrawingFinishes(selectedDrawing.id).map((finish) => (
                      <div
                        key={finish.id}
                        className="flex items-center gap-3"
                        style={{ padding: "8px 10px", backgroundColor: "#FAFAF9", borderRadius: 8, border: "1px solid #F0EEEB" }}
                      >
                        {/* Swatch */}
                        <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: finish.colour_hex ?? "#E4E1DC", border: "1px solid rgba(26,26,26,0.1)", flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 700, color: "#1A1A1A", letterSpacing: "0.02em", backgroundColor: "#F0EEEB", borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>
                          {finish.code}
                        </span>
                        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {finish.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFinish(finish.id)}
                          disabled={isPending}
                          title="Remove finish"
                          className="transition-colors hover:text-red-500"
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, borderRadius: 4, flexShrink: 0 }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {getDrawingFinishes(selectedDrawing.id).length === 0 && (
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB" }}>
                        No finish codes assigned yet.
                      </p>
                    )}
                  </div>

                  {/* Add finish row */}
                  {availableFinishes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedFinishId}
                        onChange={(e) => setSelectedFinishId(e.target.value)}
                        style={{ ...inputStyle, flex: 1, height: 34, fontSize: 12 }}
                      >
                        <option value="">Add a finish code…</option>
                        {availableFinishes.map((f) => (
                          <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddFinish}
                        disabled={!selectedFinishId || isPending}
                        className="flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ width: 34, height: 34, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}
                      >
                        {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                      </button>
                    </div>
                  )}
                  {availableFinishes.length === 0 && studioFinishes.length > 0 && getDrawingFinishes(selectedDrawing.id).length > 0 && (
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}>
                      All finish codes assigned.
                    </p>
                  )}
                  {studioFinishes.length === 0 && (
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}>
                      No finish codes in your palette yet — add some in{" "}
                      <a href="/settings/finishes" style={{ color: "#9A9590", textDecoration: "underline" }}>Settings → Finish Palette</a>.
                    </p>
                  )}

                  {sheetError && (
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626", marginTop: 8 }}>
                      {sheetError}
                    </p>
                  )}
                </div>

                {/* ── Divider ────────────────────────────────────────────── */}
                <div style={{ height: 1, backgroundColor: "#F0EEEB" }} />

                {/* ── Pinned specs section ──────────────────────────────── */}
                <div>
                  <h3 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                    Pinned Specs
                  </h3>
                  {getDrawingPinnedSpecs(selectedDrawing.id).length === 0 ? (
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB" }}>
                      No specs pinned to this drawing yet. Pin a spec from the Specs page.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {getDrawingPinnedSpecs(selectedDrawing.id).map((ps) => (
                        <div
                          key={ps.id}
                          style={{ padding: "8px 10px", backgroundColor: "#FAFAF9", borderRadius: 8, border: "1px solid #F0EEEB" }}
                        >
                          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", marginBottom: 2 }}>
                            {ps.spec_id ? (specNameMap.get(ps.spec_id) ?? "Unknown spec") : "Empty slot"}
                          </p>
                          {ps.item_type && (
                            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 6px" }}>
                              {ps.item_type.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Delete drawing ────────────────────────────────────── */}
                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #F0EEEB" }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteDrawing(selectedDrawing.id, selectedDrawing.name)}
                    disabled={isPending}
                    className="flex items-center gap-2 transition-colors hover:text-red-600"
                    style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <Trash2 size={13} />
                    Delete drawing
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add Drawing Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addDrawingOpen} onOpenChange={(open) => { if (!open) { setAddDrawingOpen(false); setAddDrawingError(null); } }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              Add drawing
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddDrawing} className="flex flex-col gap-4 mt-2">
            <div>
              <label style={labelStyle}>Drawing name <span style={{ color: "#DC2626" }}>*</span></label>
              <input
                autoFocus
                value={drawingName}
                onChange={(e) => setDrawingName(e.target.value)}
                placeholder="e.g. Kitchen Elevation"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Drawing type <span style={{ color: "#DC2626" }}>*</span></label>
              <select
                value={drawingType}
                onChange={(e) => setDrawingType(e.target.value as DrawingType | "")}
                required
                style={{ ...inputStyle, appearance: "auto" }}
              >
                <option value="" disabled>Select type…</option>
                <option value="arch_id">Arch ID</option>
                <option value="joinery">Joinery</option>
                <option value="ffe">FF&E</option>
              </select>
            </div>
            {addDrawingError && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                {addDrawingError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setAddDrawingOpen(false); setAddDrawingError(null); }}
                style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "transparent", border: "1.5px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#9A9590", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !drawingType}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                Add drawing
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── DrawingSection ────────────────────────────────────────────────────────────

function DrawingSection({
  label,
  drawings,
  drawingFinishes,
  studioFinishes,
  pinnedSpecs,
  onSelect,
  onDelete,
  isPending,
}: {
  label: string;
  drawings: DrawingEntry[];
  drawingFinishes: DrawingFinishEntry[];
  studioFinishes: StudioFinishEntry[];
  pinnedSpecs: PinnedSpecEntry[];
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  isPending: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
          {drawings.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-4">
        {drawings.map((drawing) => {
          const finishIds = drawingFinishes
            .filter((df) => df.drawing_id === drawing.id)
            .sort((a, b) => a.order_index - b.order_index)
            .map((df) => df.studio_finish_id);
          const assignedFinishes = finishIds
            .map((id) => studioFinishes.find((f) => f.id === id))
            .filter((f): f is StudioFinishEntry => f !== undefined);
          const pinnedCount = pinnedSpecs.filter((ps) => ps.drawing_id === drawing.id).length;

          return (
            <DrawingCard
              key={drawing.id}
              drawing={drawing}
              finishes={assignedFinishes}
              pinnedCount={pinnedCount}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── DrawingCard ───────────────────────────────────────────────────────────────

function DrawingCard({
  drawing,
  finishes,
  pinnedCount,
  onSelect,
}: {
  drawing: DrawingEntry;
  finishes: StudioFinishEntry[];
  pinnedCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(drawing.id)}
      className="flex flex-col text-left transition-shadow hover:shadow-md"
      style={{ width: 200, backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 2px 12px rgba(26,26,26,0.08)", overflow: "hidden", border: "none", cursor: "pointer", padding: 0 }}
    >
      {/* Placeholder thumbnail */}
      <div
        className="flex items-center justify-center"
        style={{ width: "100%", height: 96, backgroundColor: "#F0EEEB" }}
      >
        <ImageIcon size={24} style={{ color: "#D6D2CC" }} />
      </div>

      {/* Card content */}
      <div style={{ padding: "12px 14px 14px" }}>
        {/* Drawing type badge */}
        {drawing.drawing_type && (
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", color: "#9A9590", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 6px", marginBottom: 6, display: "inline-block" }}>
            {drawing.drawing_type === "arch_id" ? "Arch ID" : drawing.drawing_type === "ffe" ? "FF&E" : "Joinery"}
          </span>
        )}

        {/* Drawing name */}
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1A1A", lineHeight: 1.3, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {drawing.name}
        </p>

        {/* Finish chips */}
        {finishes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {finishes.slice(0, 4).map((finish) => (
              <span
                key={finish.id}
                className="flex items-center gap-1"
                style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#1A1A1A", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "2px 6px", letterSpacing: "0.02em" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: finish.colour_hex ?? "#C0BEBB", display: "inline-block", flexShrink: 0 }} />
                {finish.code}
              </span>
            ))}
            {finishes.length > 4 && (
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}>
                +{finishes.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Pinned specs count */}
        {pinnedCount > 0 && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 2 }}>
            {pinnedCount} spec{pinnedCount !== 1 ? "s" : ""} pinned
          </p>
        )}
      </div>
    </button>
  );
}
