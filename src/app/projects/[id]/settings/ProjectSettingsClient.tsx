"use client";

/**
 * ProjectSettingsClient — /projects/[id]/settings
 *
 * Schedule configuration for this project.
 * Starts from studio defaults (read-only preview with "Customise" CTA).
 * After customising, saves project-level overrides to project_schedule_preferences.
 * "Reset to studio defaults" deletes the project overrides and falls back.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2, Loader2, GripVertical, RotateCcw } from "lucide-react";
import { saveProjectSchedulePreferences, addProjectCustomSchedule, resetProjectSchedulesToStudio } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SettingsScheduleRow = {
  item_type: string;
  default_label: string | null;
  display_name: string | null;
  is_visible: boolean;
  is_custom: boolean;
  sort_order: number;
  is_project_override: boolean;
};

interface Props {
  projectId: string;
  projectName: string;
  initialRows: SettingsScheduleRow[];
  hasProjectOverride: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayLabel(row: SettingsScheduleRow): string {
  return row.display_name || row.default_label || row.item_type;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProjectSettingsClient({
  projectId,
  projectName,
  initialRows,
  hasProjectOverride,
}: Props) {
  const router = useRouter();
  const [rows, setRows]               = useState<SettingsScheduleRow[]>(initialRows);
  const [isEditing, setIsEditing]     = useState(hasProjectOverride);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Toggle visibility ─────────────────────────────────────────────────────

  function toggleVisible(item_type: string) {
    setRows((prev) =>
      prev.map((r) => r.item_type === item_type ? { ...r, is_visible: !r.is_visible } : r)
    );
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  function rename(item_type: string, value: string) {
    setRows((prev) =>
      prev.map((r) => r.item_type === item_type ? { ...r, display_name: value || null } : r)
    );
  }

  // ── Move up/down ──────────────────────────────────────────────────────────

  function move(item_type: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.item_type === item_type);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((r, i) => ({ ...r, sort_order: i }));
    });
  }

  // ── Remove custom ─────────────────────────────────────────────────────────

  function removeCustom(item_type: string) {
    setRows((prev) => prev.filter((r) => r.item_type !== item_type));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function handleSave() {
    setFormError(null);
    startTransition(async () => {
      const result = await saveProjectSchedulePreferences(
        projectId,
        rows.map((r, i) => ({
          item_type:    r.item_type,
          display_name: r.display_name,
          is_visible:   r.is_visible,
          is_custom:    r.is_custom,
          sort_order:   i,
        }))
      );
      if (result.error) {
        setFormError(result.error);
      } else {
        setIsEditing(true);
        router.refresh();
      }
    });
  }

  // ── Add custom schedule ───────────────────────────────────────────────────

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!newScheduleName.trim()) return;
    setFormError(null);
    startTransition(async () => {
      const result = await addProjectCustomSchedule(projectId, newScheduleName, rows);
      if (result.error) {
        setFormError(result.error);
      } else {
        setRows((prev) => [
          ...prev,
          {
            item_type:    result.item_type!,
            default_label: null,
            display_name: newScheduleName.trim(),
            is_visible:   true,
            is_custom:    true,
            sort_order:   prev.length,
            is_project_override: true,
          },
        ]);
        setNewScheduleName("");
        setShowAddForm(false);
        router.refresh();
      }
    });
  }

  // ── Reset to studio defaults ──────────────────────────────────────────────

  function handleReset() {
    if (!confirm("Reset schedules to studio defaults? Your project customisations will be removed.")) return;
    startTransition(async () => {
      const result = await resetProjectSchedulesToStudio(projectId);
      if (result.error) {
        setFormError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Project Settings
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
          </p>
        </div>
      </div>

      {/* Schedules section */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>
              Schedules
            </h2>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
              {hasProjectOverride
                ? "Custom schedule configuration for this project."
                : "Using studio defaults. Customise to override for this project only."}
            </p>
          </div>
          {hasProjectOverride && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <RotateCcw size={12} />
              Reset to studio defaults
            </button>
          )}
        </div>

        {/* Schedule rows */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 16 }}>
          {rows.map((row, idx) => (
            <div
              key={row.item_type}
              className="flex items-center gap-3"
              style={{
                padding: "10px 14px",
                backgroundColor: "#FFFFFF",
                borderRadius: 10,
                border: "1px solid #E4E1DC",
                opacity: row.is_visible ? 1 : 0.5,
              }}
            >
              {/* Drag handle — visual only for now */}
              <div className="flex flex-col gap-1 cursor-grab" style={{ opacity: 0.3 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#1A1A1A" }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#1A1A1A" }} />
                  ))}
                </div>
              </div>

              {/* Name / editable field */}
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={row.display_name ?? ""}
                  onChange={(e) => rename(row.item_type, e.target.value)}
                  placeholder={row.default_label ?? row.item_type}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1A1A1A",
                    backgroundColor: "transparent",
                    border: "1.5px solid transparent",
                    borderRadius: 6,
                    outline: "none",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#E4E1DC"; e.target.style.backgroundColor = "#FAFAF9"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "transparent"; e.target.style.backgroundColor = "transparent"; }}
                />
                {!row.display_name && row.default_label && (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 1, paddingLeft: 8 }}>
                    {row.default_label}
                  </p>
                )}
              </div>

              {/* Up/down */}
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => move(row.item_type, -1)} disabled={idx === 0 || isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: "1px 2px", lineHeight: 1 }}>▲</button>
                <button type="button" onClick={() => move(row.item_type, 1)} disabled={idx === rows.length - 1 || isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: "1px 2px", lineHeight: 1 }}>▼</button>
              </div>

              {/* Visibility toggle */}
              <button
                type="button"
                onClick={() => toggleVisible(row.item_type)}
                title={row.is_visible ? "Hide schedule" : "Show schedule"}
                style={{ background: "none", border: "none", cursor: "pointer", color: row.is_visible ? "#9A9590" : "#C0BEBB", padding: 4 }}
              >
                {row.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              {/* Delete custom */}
              {row.is_custom && (
                <button
                  type="button"
                  onClick={() => removeCustom(row.item_type)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add custom schedule */}
        {showAddForm ? (
          <form onSubmit={handleAddCustom} className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              placeholder="Schedule name, e.g. Lighting"
              style={{
                flex: 1,
                height: 36,
                padding: "0 12px",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#1A1A1A",
                backgroundColor: "#FAFAF9",
                border: "1.5px solid #E4E1DC",
                borderRadius: 8,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!newScheduleName.trim() || isPending}
              style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewScheduleName(""); }}
              style={{ height: 36, paddingLeft: 12, paddingRight: 12, backgroundColor: "#FFFFFF", border: "1px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", cursor: "pointer" }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Plus size={14} />
            Add custom schedule
          </button>
        )}

        {formError && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626", marginTop: 8 }}>
            {formError}
          </p>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{ height: 38, paddingLeft: 20, paddingRight: 20, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          Save settings
        </button>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          Only affects this project
        </p>
      </div>
    </div>
  );
}
