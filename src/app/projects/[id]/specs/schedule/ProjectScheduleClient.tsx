"use client";

/**
 * Stage 3 — Specs / Schedule (/projects/[id]/specs/schedule)
 *
 * The working spec document. Items here are committed — they have a project
 * code (FB01) and a schedule assignment. Table view grouped by schedule type.
 * Editable: Project Price, Quantity, Unit, Notes.
 * Empty slots (spec detached, code retained) appear here in a muted style.
 * See ADR 022.
 */

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, MoreHorizontal } from "lucide-react";
import { assignSpecToSchedule, updateProjectSpec } from "../actions";
import SpecDetailModal from "@/app/specs/SpecDetailModal";
import type { ProjectSpecRow } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

type SpecDetail = {
  id: string;
  name: string;
  code: string | null;
  image_url: string | null;
  category_name: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
};

type Schedule = { item_type: string; label: string };

interface Props {
  projectId: string;
  projectName: string;
  projectSpecs: ProjectSpecRow[];
  specDetails: SpecDetail[];
  schedules: Schedule[];
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProjectScheduleClient({
  projectId,
  projectName,
  projectSpecs,
  specDetails,
  schedules,
}: Props) {
  const router = useRouter();
  const [openSpecId, setOpenSpecId]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const specDetailMap = useMemo(() => {
    const map = new Map<string, SpecDetail>();
    specDetails.forEach((s) => map.set(s.id, s));
    return map;
  }, [specDetails]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectSpecRow[]>();
    projectSpecs
      .filter((ps) => !!ps.item_type)
      .forEach((ps) => {
        const key = ps.item_type!;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ps);
      });
    return map;
  }, [projectSpecs]);

  const scheduleLabelMap = useMemo(
    () => new Map(schedules.map((s) => [s.item_type, s.label])),
    [schedules]
  );

  function handleAssign(projectSpecId: string, itemType: string | null) {
    startTransition(async () => {
      await assignSpecToSchedule(projectSpecId, projectId, itemType);
      router.refresh();
    });
  }

  function handleUpdate(projectSpecId: string, payload: Parameters<typeof updateProjectSpec>[2]) {
    startTransition(async () => {
      await updateProjectSpec(projectSpecId, projectId, payload);
      router.refresh();
    });
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (projectSpecs.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <ScheduleHeader projectName={projectName} count={0} />
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ borderRadius: 16, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <div className="flex items-center justify-center mb-4" style={{ width: 52, height: 52, backgroundColor: "#F0EEEB", borderRadius: 14 }}>
            <ClipboardList size={22} style={{ color: "#9A9590" }} />
          </div>
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>
            No specs yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.6, maxWidth: 320 }}>
            Add items to the Project Library and assign them to a schedule to see them here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <ScheduleHeader projectName={projectName} count={projectSpecs.length} />

      <div className="flex flex-col gap-10">

        {/* ── Schedule groups ──────────────────────────────────────────────── */}
        {schedules.map(({ item_type, label }) => {
          const items = grouped.get(item_type);
          if (!items || items.length === 0) return null;
          return (
            <section key={item_type}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {label}
                </h2>
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
                  {items.length}
                </span>
              </div>

              {/* Table */}
              <div style={{ borderRadius: 12, border: "1px solid #E4E1DC", backgroundColor: "#FFFFFF" }}>
                {/* Column headers */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "70px 48px 1fr 100px 100px 1fr 32px", padding: "0 12px", borderBottom: "1px solid #E4E1DC", backgroundColor: "#FAFAF9", borderRadius: "12px 12px 0 0" }}
                >
                  {["Code", "", "Item", "Price", "Qty", "Notes", ""].map((h, i) => (
                    <div key={i} style={{ padding: "10px 8px", fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {items.map((ps, idx) => {
                  const spec = ps.spec_id ? (specDetailMap.get(ps.spec_id) ?? null) : null;
                  return (
                    <SpecRow
                      key={ps.id}
                      projectSpec={ps}
                      spec={spec}
                      schedules={schedules}
                      currentItemType={ps.item_type!}
                      currentLabel={scheduleLabelMap.get(ps.item_type!) ?? ps.item_type ?? ""}
                      onAssign={handleAssign}
                      onOpen={setOpenSpecId}
                      onUpdate={handleUpdate}
                      isPending={isPending}
                      isLast={idx === items.length - 1}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ── Orphaned (item_type not in visible schedule list) ────────────── */}
        {(() => {
          const knownTypes = new Set(schedules.map((s) => s.item_type));
          const orphaned = projectSpecs.filter((ps) => ps.item_type && !knownTypes.has(ps.item_type));
          if (orphaned.length === 0) return null;
          return (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#C0BEBB", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Other
                </h2>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #E4E1DC", backgroundColor: "#FFFFFF" }}>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "70px 48px 1fr 100px 100px 1fr 32px", padding: "0 12px", borderBottom: "1px solid #E4E1DC", backgroundColor: "#FAFAF9", borderRadius: "12px 12px 0 0" }}
                >
                  {["Code", "", "Item", "Price", "Qty", "Notes", ""].map((h, i) => (
                    <div key={i} style={{ padding: "10px 8px", fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </div>
                  ))}
                </div>
                {orphaned.map((ps, idx) => {
                  const spec = ps.spec_id ? (specDetailMap.get(ps.spec_id) ?? null) : null;
                  return (
                    <SpecRow
                      key={ps.id}
                      projectSpec={ps}
                      spec={spec}
                      schedules={schedules}
                      currentItemType={ps.item_type!}
                      currentLabel={ps.item_type ?? ""}
                      onAssign={handleAssign}
                      onOpen={setOpenSpecId}
                      onUpdate={handleUpdate}
                      isPending={isPending}
                      isLast={idx === orphaned.length - 1}
                    />
                  );
                })}
              </div>
            </section>
          );
        })()}
      </div>

      <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />
    </div>
  );
}

// ── ScheduleHeader ─────────────────────────────────────────────────────────────

function ScheduleHeader({ projectName, count }: { projectName: string; count: number }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
          Specs
        </h1>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
          {projectName}
          {count > 0 && (
            <span style={{ marginLeft: 8, backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 8px" }}>
              {count}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── SpecRow ────────────────────────────────────────────────────────────────────

function SpecRow({
  projectSpec,
  spec,
  schedules,
  currentItemType,
  currentLabel,
  onAssign,
  onOpen,
  onUpdate,
  isPending,
  isLast,
}: {
  projectSpec: ProjectSpecRow;
  spec: SpecDetail | null;
  schedules: Schedule[];
  currentItemType: string;
  currentLabel: string;
  onAssign: (id: string, type: string | null) => void;
  onOpen: (specId: string) => void;
  onUpdate: (id: string, payload: { notes?: string | null; quantity?: number | null; unit?: string | null; project_price?: number | null }) => void;
  isPending: boolean;
  isLast: boolean;
}) {
  const isEmpty = !projectSpec.spec_id;

  return (
    <div
      className="group grid items-center hover:bg-[#FAFAF9]"
      style={{
        gridTemplateColumns: "70px 48px 1fr 100px 100px 1fr 32px",
        padding: "0 12px",
        borderBottom: isLast ? "none" : "1px solid #F0EEEB",
        borderRadius: isLast ? "0 0 12px 12px" : undefined,
        opacity: isPending ? 0.7 : 1,
        minHeight: 58,
        backgroundColor: isEmpty ? "#FAFAF9" : undefined,
        transition: "background-color 0.1s",
      }}
    >
      {/* Col 1: Project code */}
      <div className="px-2">
        {projectSpec.project_code ? (
          <span style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 10, fontWeight: 700,
            color: isEmpty ? "#C0BEBB" : "#1A1A1A",
            backgroundColor: "#F0EEEB",
            borderRadius: 4, padding: "3px 6px", letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}>
            {projectSpec.project_code}
          </span>
        ) : (
          <span style={{ color: "#E4E1DC", fontSize: 12 }}>—</span>
        )}
      </div>

      {/* Col 2: Thumbnail */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 36, height: 36, borderRadius: 6,
          backgroundColor: "#F0EEEB",
          overflow: "hidden",
          cursor: isEmpty ? "default" : "pointer",
          border: isEmpty ? "1.5px dashed #D4D2CF" : "none",
        }}
        onClick={() => !isEmpty && projectSpec.spec_id && onOpen(projectSpec.spec_id)}
      >
        {isEmpty
          ? <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 8, fontWeight: 700, color: "#C0BEBB", letterSpacing: "0.05em" }}>EMPTY</span>
          : spec?.image_url
            ? <img src={spec.image_url} alt={spec.name} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            : <Package size={14} style={{ color: "#D4D2CF" }} />}
      </div>

      {/* Col 3: Name + category */}
      <div
        className="px-2"
        style={{ cursor: isEmpty ? "default" : "pointer", minWidth: 0 }}
        onClick={() => !isEmpty && projectSpec.spec_id && onOpen(projectSpec.spec_id)}
      >
        <p style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 12, fontWeight: 600,
          color: isEmpty ? "#C0BEBB" : "#1A1A1A",
          fontStyle: isEmpty ? "italic" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {isEmpty ? "Empty slot" : (spec?.name ?? "—")}
        </p>
        {!isEmpty && spec?.category_name && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 1 }}>
            {spec.category_name}
          </p>
        )}
      </div>

      {/* Col 4: Price */}
      <div className="px-2">
        <InlineNumberCell
          value={projectSpec.project_price}
          placeholder="Add price…"
          prefix="£"
          onSave={(val) => onUpdate(projectSpec.id, { project_price: val })}
        />
      </div>

      {/* Col 5: Qty + unit */}
      <div className="px-2">
        <InlineQtyCell
          quantity={projectSpec.quantity}
          unit={projectSpec.unit}
          onSave={(qty, unit) => onUpdate(projectSpec.id, { quantity: qty, unit })}
        />
      </div>

      {/* Col 6: Notes — 1fr, no clipping */}
      <div className="px-2" style={{ minWidth: 0 }}>
        <InlineTextCell
          value={projectSpec.notes}
          placeholder="Add note…"
          onSave={(val) => onUpdate(projectSpec.id, { notes: val })}
        />
      </div>

      {/* Col 7: Schedule change / remove */}
      <div className="flex items-center justify-center">
        <ScheduleMenu
          schedules={schedules}
          currentItemType={currentItemType}
          onAssign={(type) => onAssign(projectSpec.id, type)}
        />
      </div>
    </div>
  );
}

// ── ScheduleMenu ───────────────────────────────────────────────────────────────
// Three-dot style menu: change schedule or remove from schedule.

function ScheduleMenu({
  schedules,
  currentItemType,
  onAssign,
}: {
  schedules: Schedule[];
  currentItemType: string;
  onAssign: (itemType: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/[0.06]"
        style={{ width: 26, height: 26, border: "none", background: "none", cursor: "pointer", borderRadius: 6, color: "#9A9590", padding: 0, outline: "none" }}
        title="Move or remove"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute z-20 py-1"
            style={{ top: "calc(100% + 4px)", right: 0, minWidth: 170, backgroundColor: "#FFFFFF", borderRadius: 10, boxShadow: "0 4px 24px rgba(26,26,26,0.14)", border: "1px solid #E4E1DC" }}
          >
            {schedules.map(({ item_type, label }) => (
              <button
                key={item_type}
                type="button"
                onClick={() => { setOpen(false); onAssign(item_type); }}
                className="w-full text-left transition-colors hover:bg-black/[0.04]"
                style={{ display: "block", padding: "7px 12px", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: item_type === currentItemType ? "#1A1A1A" : "#4A4A4A", fontWeight: item_type === currentItemType ? 600 : 400, border: "none", background: "none", cursor: "pointer", width: "100%" }}
              >
                {item_type === currentItemType && <span style={{ marginRight: 6 }}>✓</span>}
                {label}
              </button>
            ))}
            <div style={{ height: 1, backgroundColor: "#F0EEEB", margin: "4px 0" }} />
            <button
              type="button"
              onClick={() => { setOpen(false); onAssign(null); }}
              className="w-full text-left transition-colors hover:bg-black/[0.04]"
              style={{ display: "block", padding: "7px 12px", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", border: "none", background: "none", cursor: "pointer", width: "100%" }}
            >
              Remove from schedule
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── InlineTextCell ─────────────────────────────────────────────────────────────

function InlineTextCell({ value, placeholder, onSave }: { value: string | null; placeholder: string; onSave: (val: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function commit() {
    setEditing(false);
    const trimmed = draft.trim() || null;
    if (trimmed !== (value ?? null)) onSave(trimmed);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
        style={{ width: "100%", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", background: "none", border: "none", borderBottom: "1px solid #C0BEBB", outline: "none", padding: "2px 0" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="transition-colors hover:bg-black/[0.04]"
      style={{ background: "none", border: "none", cursor: "text", padding: "4px 6px", margin: "-4px -6px", borderRadius: 4, textAlign: "left", width: "calc(100% + 12px)", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: value ? "#1A1A1A" : "#C0BEBB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {value ?? placeholder}
    </button>
  );
}

// ── InlineNumberCell ───────────────────────────────────────────────────────────

function InlineNumberCell({ value, placeholder, prefix, onSave }: { value: number | null; placeholder: string; prefix?: string; onSave: (val: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : "");

  function commit() {
    setEditing(false);
    const n = parseFloat(draft);
    const newVal = isNaN(n) ? null : n;
    if (newVal !== value) onSave(newVal);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value !== null ? String(value) : ""); setEditing(false); } }}
        style={{ width: "100%", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", background: "none", border: "none", borderBottom: "1px solid #C0BEBB", outline: "none", padding: "2px 0" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value !== null ? String(value) : ""); setEditing(true); }}
      className="transition-colors hover:bg-black/[0.04]"
      style={{ background: "none", border: "none", cursor: "text", padding: "4px 6px", margin: "-4px -6px", borderRadius: 4, textAlign: "left", width: "calc(100% + 12px)", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: value !== null ? "#1A1A1A" : "#C0BEBB" }}
    >
      {value !== null ? `${prefix ?? ""}${value.toLocaleString()}` : placeholder}
    </button>
  );
}

// ── InlineQtyCell ──────────────────────────────────────────────────────────────

function InlineQtyCell({ quantity, unit, onSave }: { quantity: number | null; unit: string | null; onSave: (qty: number | null, unit: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(quantity !== null ? String(quantity) : "");
  const [draftUnit, setDraftUnit] = useState(unit ?? "");

  function commit() {
    setEditing(false);
    const n = parseFloat(draftQty);
    const newQty = isNaN(n) ? null : n;
    const newUnit = draftUnit.trim() || null;
    if (newQty !== quantity || newUnit !== (unit ?? null)) onSave(newQty, newUnit);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draftQty}
          onChange={(e) => setDraftQty(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraftQty(quantity !== null ? String(quantity) : ""); setDraftUnit(unit ?? ""); setEditing(false); } }}
          style={{ width: 40, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", background: "none", border: "none", borderBottom: "1px solid #C0BEBB", outline: "none", padding: "2px 0" }}
        />
        <input
          value={draftUnit}
          onChange={(e) => setDraftUnit(e.target.value)}
          placeholder="unit"
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          style={{ width: 34, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", background: "none", border: "none", borderBottom: "1px solid #C0BEBB", outline: "none", padding: "2px 0" }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraftQty(quantity !== null ? String(quantity) : ""); setDraftUnit(unit ?? ""); setEditing(true); }}
      className="transition-colors hover:bg-black/[0.04]"
      style={{ background: "none", border: "none", cursor: "text", padding: "4px 6px", margin: "-4px -6px", borderRadius: 4, textAlign: "left", width: "calc(100% + 12px)", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: quantity !== null ? "#1A1A1A" : "#C0BEBB" }}
    >
      {quantity !== null ? `${quantity}${unit ? ` ${unit}` : ""}` : "—"}
    </button>
  );
}
