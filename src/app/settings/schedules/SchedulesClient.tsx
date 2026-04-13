"use client";

/**
 * SchedulesClient — /settings/schedules
 *
 * Toggle which schedule types appear in project specs, rename them with
 * studio-specific labels, and reorder them with up/down arrows.
 * Changes are saved all at once with the "Save changes" button.
 */

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Loader2, Eye, EyeOff } from "lucide-react";
import { saveAllSchedulePreferences } from "./actions";
import type { SpecItemType } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SchedulePref = {
  item_type: SpecItemType;
  default_label: string;
  display_name: string | null;
  is_visible: boolean;
  sort_order: number;
};

interface Props {
  preferences: SchedulePref[];
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 34,
  paddingLeft: 10,
  paddingRight: 10,
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13,
  color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
  flex: 1,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function SchedulesClient({ preferences }: Props) {
  const [rows, setRows] = useState<SchedulePref[]>(preferences);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Mutate helpers ────────────────────────────────────────────────────────

  function update(index: number, patch: Partial<SchedulePref>) {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
    setIsDirty(true);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((r, i) => ({ ...r, sort_order: i }));
    });
    setIsDirty(true);
  }

  function moveDown(index: number) {
    if (index === rows.length - 1) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((r, i) => ({ ...r, sort_order: i }));
    });
    setIsDirty(true);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveAllSchedulePreferences(
        rows.map((r, i) => ({
          item_type: r.item_type,
          is_visible: r.is_visible,
          display_name: r.display_name,
          sort_order: i,
        }))
      );
      if (result.error) {
        setError(result.error);
      } else {
        setIsDirty(false);
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 580 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Schedule Types
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.5 }}>
            Control which schedule types appear in projects. Hide ones you don't use, rename them to match your studio's language, and reorder them.
          </p>
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer", flexShrink: 0, marginLeft: 16 }}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            Save changes
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 mb-2 px-1" style={{ paddingLeft: 52 }}>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>
          Default name
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>
          Studio label (optional)
        </span>
        <span style={{ width: 56 }} />
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={row.item_type}
            className="flex items-center gap-3"
            style={{
              padding: "10px 14px",
              backgroundColor: row.is_visible ? "#FFFFFF" : "#FAFAF9",
              borderRadius: 12,
              boxShadow: row.is_visible ? "0 1px 6px rgba(26,26,26,0.06)" : "none",
              border: row.is_visible ? "none" : "1.5px solid #E4E1DC",
              opacity: row.is_visible ? 1 : 0.55,
              transition: "opacity 0.15s",
            }}
          >
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => update(index, { is_visible: !row.is_visible })}
              title={row.is_visible ? "Hide this schedule type" : "Show this schedule type"}
              className="transition-colors hover:opacity-80"
              style={{ border: "none", background: "none", cursor: "pointer", color: row.is_visible ? "#9A9590" : "#C0BEBB", padding: 4, flexShrink: 0 }}
            >
              {row.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>

            {/* Default label */}
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: row.is_visible ? "#1A1A1A" : "#9A9590", flex: 1 }}>
              {row.default_label}
            </span>

            {/* Custom label input */}
            <input
              value={row.display_name ?? ""}
              onChange={(e) => update(index, { display_name: e.target.value || null })}
              placeholder={`e.g. ${row.default_label}`}
              disabled={!row.is_visible}
              style={{ ...inputStyle, color: row.is_visible ? "#1A1A1A" : "#9A9590" }}
            />

            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="transition-opacity hover:opacity-80 disabled:opacity-20"
                style={{ border: "none", background: "none", cursor: index === 0 ? "default" : "pointer", color: "#9A9590", padding: "1px 2px", lineHeight: 1 }}
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={index === rows.length - 1}
                className="transition-opacity hover:opacity-80 disabled:opacity-20"
                style={{ border: "none", background: "none", cursor: index === rows.length - 1 ? "default" : "pointer", color: "#9A9590", padding: "1px 2px", lineHeight: 1 }}
              >
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* Info note */}
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", marginTop: 16, lineHeight: 1.6 }}>
        Hidden schedule types won't appear when adding specs to a project. Existing specs of a hidden type remain in the project — they just won't be shown in the add dialog.
      </p>
    </div>
  );
}
