"use client";

/**
 * ProjectScheduleClient — /projects/[id]/specs/schedule
 *
 * Two sections:
 *  1. "Not yet scheduled" — specs in the project library with no item_type.
 *     Each has a dropdown to assign to a schedule type.
 *  2. Schedule groups — specs with an item_type, grouped and ordered.
 *     Each has a button to remove from schedule (sends back to unassigned).
 */

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, ChevronDown, X, Loader2 } from "lucide-react";
import { assignSpecToSchedule } from "../actions";
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

  // ── Derived data ──────────────────────────────────────────────────────────────

  const specDetailMap = useMemo(() => {
    const map = new Map<string, SpecDetail>();
    specDetails.forEach((s) => map.set(s.id, s));
    return map;
  }, [specDetails]);

  const unassigned = useMemo(
    () => projectSpecs.filter((ps) => !ps.item_type),
    [projectSpecs]
  );

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

  // ── Assign handler ────────────────────────────────────────────────────────────

  function handleAssign(projectSpecId: string, itemType: string | null) {
    startTransition(async () => {
      await assignSpecToSchedule(projectSpecId, projectId, itemType);
      router.refresh();
    });
  }

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (projectSpecs.length === 0) {
    return (
      <div style={{ maxWidth: 860 }}>
        <ScheduleHeader projectName={projectName} count={0} />
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ borderRadius: 16, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <div className="flex items-center justify-center mb-4" style={{ width: 52, height: 52, backgroundColor: "#F0EEEB", borderRadius: 14 }}>
            <ClipboardList size={22} style={{ color: "#9A9590" }} />
          </div>
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>
            No items in the library yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.6, maxWidth: 320 }}>
            Add products to the Project Library first, then come here to assign them to schedules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <ScheduleHeader projectName={projectName} count={projectSpecs.length} />

      <div className="flex flex-col gap-10">

        {/* ── Unassigned items ───────────────────────────────────────────── */}
        {unassigned.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Not yet scheduled
              </h2>
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
                {unassigned.length}
              </span>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {unassigned.map((ps) => (
                <UnassignedCard
                  key={ps.id}
                  projectSpec={ps}
                  spec={specDetailMap.get(ps.spec_id) ?? null}
                  schedules={schedules}
                  onAssign={handleAssign}
                  onOpen={setOpenSpecId}
                  isPending={isPending}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Schedule groups ────────────────────────────────────────────── */}
        {schedules.map(({ item_type, label }) => {
          const items = grouped.get(item_type);
          if (!items || items.length === 0) return null;
          return (
            <section key={item_type}>
              <div className="flex items-center gap-2 mb-4">
                <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {label}
                </h2>
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 7px" }}>
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map((ps) => (
                  <AssignedCard
                    key={ps.id}
                    projectSpec={ps}
                    spec={specDetailMap.get(ps.spec_id) ?? null}
                    schedules={schedules}
                    currentLabel={scheduleLabelMap.get(ps.item_type!) ?? ps.item_type ?? ""}
                    onAssign={handleAssign}
                    onOpen={setOpenSpecId}
                    isPending={isPending}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Orphaned specs (item_type set but not in visible schedule list) */}
        {(() => {
          const knownTypes = new Set(schedules.map((s) => s.item_type));
          const orphaned = projectSpecs.filter((ps) => ps.item_type && !knownTypes.has(ps.item_type));
          if (orphaned.length === 0) return null;
          return (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 700, color: "#C0BEBB", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Other
                </h2>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {orphaned.map((ps) => (
                  <AssignedCard
                    key={ps.id}
                    projectSpec={ps}
                    spec={specDetailMap.get(ps.spec_id) ?? null}
                    schedules={schedules}
                    currentLabel={ps.item_type ?? ""}
                    onAssign={handleAssign}
                    onOpen={setOpenSpecId}
                    isPending={isPending}
                  />
                ))}
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
          Schedules
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

// ── AssignDropdown ─────────────────────────────────────────────────────────────
// Reusable floating schedule picker used by both card types.

function AssignDropdown({
  schedules,
  currentItemType,
  onAssign,
  trigger,
}: {
  schedules: Schedule[];
  currentItemType: string | null;
  onAssign: (itemType: string | null) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function pick(itemType: string | null) {
    setOpen(false);
    onAssign(itemType);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        {trigger}
      </div>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div
            className="absolute z-20 py-1"
            style={{
              bottom: "calc(100% + 6px)",
              left: 0,
              minWidth: 180,
              backgroundColor: "#FFFFFF",
              borderRadius: 10,
              boxShadow: "0 4px 24px rgba(26,26,26,0.14)",
              border: "1px solid #E4E1DC",
            }}
          >
            {schedules.map(({ item_type, label }) => (
              <button
                key={item_type}
                type="button"
                onClick={() => pick(item_type)}
                className="w-full text-left transition-colors hover:bg-black/[0.04]"
                style={{
                  display: "block",
                  padding: "7px 12px",
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: 12,
                  color: item_type === currentItemType ? "#1A1A1A" : "#4A4A4A",
                  fontWeight: item_type === currentItemType ? 600 : 400,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                {item_type === currentItemType && <span style={{ marginRight: 6 }}>✓</span>}
                {label}
              </button>
            ))}
            {currentItemType && (
              <>
                <div style={{ height: 1, backgroundColor: "#F0EEEB", margin: "4px 0" }} />
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="w-full text-left transition-colors hover:bg-black/[0.04]"
                  style={{ display: "block", padding: "7px 12px", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", border: "none", background: "none", cursor: "pointer", width: "100%" }}
                >
                  Remove from schedule
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── UnassignedCard ─────────────────────────────────────────────────────────────

function UnassignedCard({
  projectSpec,
  spec,
  schedules,
  onAssign,
  onOpen,
  isPending,
}: {
  projectSpec: ProjectSpecRow;
  spec: SpecDetail | null;
  schedules: Schedule[];
  onAssign: (id: string, type: string | null) => void;
  onOpen: (specId: string) => void;
  isPending: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        className="group bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-md"
        style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)", cursor: "pointer", opacity: isPending ? 0.7 : 1 }}
        onClick={() => onOpen(projectSpec.spec_id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(projectSpec.spec_id); }}
      >
        {/* Image */}
        <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backgroundColor: "#F0EEEB",
              backgroundImage: spec?.image_url ? `url(${spec.image_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!spec?.image_url && <Package size={20} style={{ color: "#D4D2CF" }} />}
          </div>
        </div>

        {/* Text */}
        <div className="p-2.5 flex flex-col gap-1 flex-1">
          {spec?.category_name && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {spec.category_name}
            </p>
          )}
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {spec?.name ?? "Unknown"}
          </p>
        </div>

        {/* Assign button at bottom */}
        <AssignDropdown
          schedules={schedules}
          currentItemType={null}
          onAssign={(type) => onAssign(projectSpec.id, type)}
          trigger={
            <div
              className="flex items-center justify-between px-2.5 py-2 transition-colors hover:bg-black/[0.04]"
              style={{ borderTop: "1px solid #F0EEEB" }}
            >
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 500, color: "#9A9590" }}>
                Add to schedule
              </span>
              <ChevronDown size={12} style={{ color: "#9A9590" }} />
            </div>
          }
        />
      </div>
    </div>
  );
}

// ── AssignedCard ───────────────────────────────────────────────────────────────

function AssignedCard({
  projectSpec,
  spec,
  schedules,
  currentLabel,
  onAssign,
  onOpen,
  isPending,
}: {
  projectSpec: ProjectSpecRow;
  spec: SpecDetail | null;
  schedules: Schedule[];
  currentLabel: string;
  onAssign: (id: string, type: string | null) => void;
  onOpen: (specId: string) => void;
  isPending: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        className="group bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-md"
        style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)", cursor: "pointer", opacity: isPending ? 0.7 : 1 }}
        onClick={() => onOpen(projectSpec.spec_id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(projectSpec.spec_id); }}
      >
        {/* Image */}
        <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backgroundColor: "#F0EEEB",
              backgroundImage: spec?.image_url ? `url(${spec.image_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!spec?.image_url && <Package size={20} style={{ color: "#D4D2CF" }} />}
          </div>
        </div>

        {/* Text */}
        <div className="p-2.5 flex flex-col gap-1 flex-1">
          {spec?.category_name && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {spec.category_name}
            </p>
          )}
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {spec?.name ?? "Unknown"}
          </p>
        </div>

        {/* Schedule badge + change dropdown */}
        <AssignDropdown
          schedules={schedules}
          currentItemType={projectSpec.item_type ?? null}
          onAssign={(type) => onAssign(projectSpec.id, type)}
          trigger={
            <div
              className="flex items-center justify-between px-2.5 py-2 transition-colors hover:bg-black/[0.04]"
              style={{ borderTop: "1px solid #F0EEEB" }}
            >
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {currentLabel}
              </span>
              <ChevronDown size={12} style={{ color: "#9A9590", flexShrink: 0, marginLeft: 4 }} />
            </div>
          }
        />
      </div>
    </div>
  );
}
