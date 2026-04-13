"use client";

/**
 * SchedulesClient — /settings/schedules
 *
 * Configure which schedule types appear in projects:
 * - System types: toggle visibility, rename, reorder (cannot delete)
 * - Custom types: all of the above + delete
 * - "New schedule" button to add studio-specific types
 */

import { useState, useTransition, useRef } from "react";
import { ChevronUp, ChevronDown, Loader2, Eye, EyeOff, Trash2, Plus, Lock } from "lucide-react";
import { saveSchedulePreferences, createCustomSchedule, deleteCustomSchedule } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduleRow = {
  item_type: string;
  default_label: string | null;  // null for custom schedules
  display_name: string | null;
  is_visible: boolean;
  is_custom: boolean;
  sort_order: number;
};

interface Props {
  initialRows: ScheduleRow[];
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

export default function SchedulesClient({ initialRows }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>(initialRows);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // New schedule input state
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // ── Row mutations ─────────────────────────────────────────────────────────

  function update(index: number, patch: Partial<ScheduleRow>) {
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

  // ── Save all ─────────────────────────────────────────────────────────────

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveSchedulePreferences(
        rows.map((r, i) => ({
          item_type: r.item_type,
          is_visible: r.is_visible,
          display_name: r.display_name,
          sort_order: i,
          is_custom: r.is_custom,
        }))
      );
      if (result.error) {
        setSaveError(result.error);
      } else {
        setIsDirty(false);
      }
    });
  }

  // ── Add custom schedule ───────────────────────────────────────────────────

  function startAdding() {
    setAddingNew(true);
    setNewName("");
    setAddError(null);
    setTimeout(() => newInputRef.current?.focus(), 50);
  }

  function cancelAdding() {
    setAddingNew(false);
    setNewName("");
    setAddError(null);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError(null);
    startTransition(async () => {
      const result = await createCustomSchedule(newName, rows.length);
      if (result.error) {
        setAddError(result.error);
      } else if (result.itemType) {
        // Append to local state immediately
        setRows((prev) => [
          ...prev,
          {
            item_type: result.itemType!,
            default_label: null,
            display_name: newName.trim(),
            is_visible: true,
            is_custom: true,
            sort_order: prev.length,
          },
        ]);
        setAddingNew(false);
        setNewName("");
      }
    });
  }

  // ── Delete custom schedule ────────────────────────────────────────────────

  function handleDelete(itemType: string, label: string) {
    if (!window.confirm(`Delete schedule "${label}"? Existing specs using this schedule will become unassigned.`)) return;
    startTransition(async () => {
      const result = await deleteCustomSchedule(itemType);
      if (result.error) {
        setSaveError(result.error);
      } else {
        setRows((prev) => prev.filter((r) => r.item_type !== itemType));
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Schedule Types
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.5 }}>
            Control which schedules appear in projects. Rename, reorder, hide, or create your own.
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
      <div className="flex items-center gap-3 mb-2" style={{ paddingLeft: 44, paddingRight: 8 }}>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase", flex: "0 0 160px" }}>
          Schedule
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#C0BEBB", letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>
          Studio label
        </span>
        <span style={{ width: 72, flexShrink: 0 }} />
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const displayedLabel = row.display_name || row.default_label || "Unnamed";
          const placeholder = row.default_label
            ? `e.g. ${row.default_label}`
            : "Schedule name…";

          return (
            <div
              key={row.item_type}
              className="flex items-center gap-3"
              style={{
                padding: "10px 12px",
                backgroundColor: row.is_visible ? "#FFFFFF" : "#FAFAF9",
                borderRadius: 12,
                boxShadow: row.is_visible ? "0 1px 6px rgba(26,26,26,0.06)" : "none",
                border: row.is_visible ? "none" : "1.5px solid #E4E1DC",
                opacity: row.is_visible ? 1 : 0.5,
                transition: "opacity 0.15s",
              }}
            >
              {/* Visibility toggle */}
              <button
                type="button"
                onClick={() => update(index, { is_visible: !row.is_visible })}
                title={row.is_visible ? "Hide" : "Show"}
                className="transition-opacity hover:opacity-60 flex-shrink-0"
                style={{ border: "none", background: "none", cursor: "pointer", color: row.is_visible ? "#9A9590" : "#C0BEBB", padding: 2 }}
              >
                {row.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              {/* Schedule name (default label for system, or custom name) */}
              <div style={{ flex: "0 0 160px", overflow: "hidden" }}>
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: row.is_visible ? "#1A1A1A" : "#9A9590", display: "flex", alignItems: "center", gap: 6 }}>
                  {row.default_label ?? row.display_name ?? "Unnamed"}
                  {!row.is_custom && (
                    <Lock size={10} style={{ color: "#C0BEBB", flexShrink: 0 }} />
                  )}
                </span>
              </div>

              {/* Studio label override (system) or name edit (custom) */}
              <input
                value={row.is_custom ? (row.display_name ?? "") : (row.display_name ?? "")}
                onChange={(e) => update(index, { display_name: e.target.value || null })}
                placeholder={placeholder}
                disabled={!row.is_visible}
                style={{ ...inputStyle, color: row.is_visible ? "#1A1A1A" : "#9A9590" }}
              />

              {/* Reorder + action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="flex flex-col gap-0.5">
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

                {/* Delete — custom schedules only */}
                {row.is_custom ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(row.item_type, displayedLabel)}
                    disabled={isPending}
                    title="Delete schedule"
                    className="transition-colors hover:text-red-500"
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, borderRadius: 6 }}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  // Spacer to keep layout consistent
                  <span style={{ width: 21 }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Add custom schedule row */}
        {addingNew ? (
          <form
            onSubmit={handleAddSubmit}
            className="flex items-center gap-3"
            style={{ padding: "10px 12px", backgroundColor: "#FAFAF9", borderRadius: 12, border: "1.5px solid #E4E1DC" }}
          >
            <Plus size={15} style={{ color: "#9A9590", flexShrink: 0 }} />
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Schedule name, e.g. Lighting"
              required
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="submit"
              disabled={isPending || !newName.trim()}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ height: 34, paddingLeft: 12, paddingRight: 12, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer", flexShrink: 0 }}
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : "Add"}
            </button>
            <button
              type="button"
              onClick={cancelAdding}
              style={{ height: 34, paddingLeft: 10, paddingRight: 10, backgroundColor: "transparent", border: "1.5px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", cursor: "pointer", flexShrink: 0 }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={startAdding}
            disabled={isPending}
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ padding: "10px 12px", backgroundColor: "transparent", border: "1.5px dashed #D6D2CC", borderRadius: 12, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", cursor: "pointer", width: "100%", justifyContent: "flex-start" }}
          >
            <Plus size={14} />
            New schedule type
          </button>
        )}
      </div>

      {/* Errors */}
      {(saveError || addError) && (
        <div className="mt-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {saveError || addError}
        </div>
      )}

      {/* Hint */}
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", marginTop: 16, lineHeight: 1.6 }}>
        <Lock size={10} style={{ display: "inline", marginRight: 4 }} />
        System types can be hidden and renamed but not deleted. Changes to visibility and order take effect immediately in projects.
      </p>
    </div>
  );
}
