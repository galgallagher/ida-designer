"use client";

/**
 * FinishesClient — /settings/finishes
 *
 * Studio finish palette. Each finish is a reusable code (e.g. WD-01, FB-03)
 * that can be assigned to drawings across any project. Studios that don't
 * use drawings can still maintain a palette and reference codes on spec items.
 */

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Palette } from "lucide-react";
import { createFinish, updateFinish, deleteFinish } from "./actions";
import type { StudioFinishRow } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function SwatchCircle({ hex, size = 24 }: { hex: string | null; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: hex ?? "#E4E1DC",
        border: "1.5px solid rgba(26,26,26,0.1)",
        flexShrink: 0,
      }}
    />
  );
}

// ── Empty form state ──────────────────────────────────────────────────────────

type FinishForm = {
  code: string;
  name: string;
  description: string;
  colour_hex: string;
};

const emptyForm: FinishForm = { code: "", name: "", description: "", colour_hex: "" };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  finishes: StudioFinishRow[];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinishesClient({ finishes }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFinish, setEditingFinish] = useState<StudioFinishRow | null>(null);
  const [form, setForm] = useState<FinishForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Open modal ──────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingFinish(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(finish: StudioFinishRow) {
    setEditingFinish(finish);
    setForm({
      code: finish.code,
      name: finish.name,
      description: finish.description ?? "",
      colour_hex: finish.colour_hex ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingFinish(null);
    setForm(emptyForm);
    setError(null);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      colour_hex: form.colour_hex || null,
    };

    startTransition(async () => {
      const result = editingFinish
        ? await updateFinish(editingFinish.id, payload)
        : await createFinish(payload);

      if (result.error) {
        setError(result.error);
      } else {
        closeModal();
      }
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function handleDelete(finish: StudioFinishRow) {
    if (!window.confirm(`Delete "${finish.code} — ${finish.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteFinish(finish.id);
      if (result.error) setError(result.error);
    });
  }

  // ── Hex preview ─────────────────────────────────────────────────────────────

  const hexValid = /^#[0-9A-Fa-f]{3,6}$/.test(form.colour_hex);
  const hexPreview = hexValid ? form.colour_hex : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Finish Palette
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.5 }}>
            Define the finish codes used across drawings and specifications. Codes are reusable across all projects.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add finish
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* Finish list */}
      <div className="flex flex-col gap-2">
        {finishes.map((finish) => (
          <div
            key={finish.id}
            className="flex items-center gap-4 px-4 py-3 bg-white"
            style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}
          >
            {/* Swatch */}
            <SwatchCircle hex={finish.colour_hex} size={28} />

            {/* Code + name */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <span style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#1A1A1A",
                backgroundColor: "#F0EEEB",
                borderRadius: 6,
                padding: "3px 8px",
                flexShrink: 0,
                letterSpacing: "0.02em",
              }}>
                {finish.code}
              </span>
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {finish.name}
              </span>
              {finish.description && (
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {finish.description}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => openEdit(finish)}
                disabled={isPending}
                className="hover:bg-black/[0.05] transition-colors"
                style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 6, borderRadius: 6 }}
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(finish)}
                disabled={isPending}
                className="hover:bg-red-50 hover:text-red-500 transition-colors"
                style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 6, borderRadius: 6 }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {finishes.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-14 text-center"
            style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
          >
            <div className="flex items-center justify-center mb-4" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB", borderRadius: 12 }}>
              <Palette size={20} style={{ color: "#9A9590" }} />
            </div>
            <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
              No finish codes yet
            </p>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 20, lineHeight: 1.6, maxWidth: 320 }}>
              Add finish codes like WD-01 (White Oak Veneer) or FB-03 (Fabric Option 3) to build your studio palette.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
            >
              <Plus size={14} />
              Add first finish
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              {editingFinish ? "Edit finish" : "Add finish"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* Code + swatch preview row */}
            <div className="flex items-end gap-3">
              <div style={{ flex: "0 0 120px" }}>
                <label style={labelStyle}>Code <span style={{ color: "#DC2626" }}>*</span></label>
                <input
                  autoFocus
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="WD-01"
                  required
                  style={{ ...inputStyle, fontWeight: 600, letterSpacing: "0.04em" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Colour <span style={{ color: "#9A9590", fontWeight: 400 }}>(optional)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    value={form.colour_hex}
                    onChange={(e) => setForm((f) => ({ ...f, colour_hex: e.target.value }))}
                    placeholder="#C4A882"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <SwatchCircle hex={hexPreview} size={38} />
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Name <span style={{ color: "#DC2626" }}>*</span></label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. White Oak Veneer"
                required
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description <span style={{ color: "#9A9590", fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Additional notes about this finish…"
                rows={2}
                style={{
                  ...inputStyle,
                  height: "auto",
                  paddingTop: 10,
                  paddingBottom: 10,
                  resize: "vertical",
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
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
                {editingFinish ? "Save changes" : "Add finish"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
