"use client";

import { useState, useActionState } from "react";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Loader2,
  HelpCircle, GripVertical,
} from "lucide-react";
import { createField, updateField, deleteField, moveField } from "./field-actions";
import type { SpecTemplateFieldRow, FieldType } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; description: string }[] = [
  { value: "text",     label: "Short text",   description: "Single line — names, codes, dimensions" },
  { value: "textarea", label: "Long text",    description: "Multi-line — colourways, notes" },
  { value: "number",   label: "Number",       description: "Numeric values — Martindale, coats" },
  { value: "select",   label: "Dropdown",     description: "Fixed options — fire rating, finish" },
  { value: "boolean",  label: "Yes / No",     description: "Toggle — dimmable, fire door, bespoke" },
  { value: "url",      label: "URL",          description: "Web link — product page, data sheet" },
  { value: "currency", label: "Currency",     description: "Money amount" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldsClientProps {
  categoryId: string;
  categoryName: string;
  templateId: string;
  fields: SpecTemplateFieldRow[];
}

type ModalState =
  | { mode: "add" }
  | { mode: "edit"; field: SpecTemplateFieldRow };

// ── Component ─────────────────────────────────────────────────────────────────

export default function FieldsClient({ categoryId, categoryName, templateId, fields }: FieldsClientProps) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sorted = [...fields].sort((a, b) => a.order_index - b.order_index);

  async function handleDelete(fieldId: string) {
    setDeletingId(fieldId);
    setDeleteError(null);
    const result = await deleteField(fieldId, categoryId);
    if (result.error) { setDeleteError(result.error); setDeletingId(null); }
  }

  async function handleMove(fieldId: string, direction: "up" | "down") {
    setMovingId(fieldId + direction);
    await moveField(fieldId, templateId, categoryId, direction);
    setMovingId(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
            Template fields
          </h2>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 3 }}>
            {sorted.length} field{sorted.length !== 1 ? "s" : ""} · shown on every {categoryName} spec
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{ height: 38, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
        >
          <Plus size={13} /> Add field
        </button>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="flex items-center justify-between mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>{deleteError}</p>
          <button type="button" onClick={() => setDeleteError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Fields list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center" style={{ borderRadius: 12, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}>
          <GripVertical size={24} style={{ color: "#D4D2CF", marginBottom: 10 }} />
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590" }}>No fields yet — add the first one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((field, idx) => {
            const typeLabel = FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type;
            const isFirst = idx === 0;
            const isLast = idx === sorted.length - 1;

            return (
              <div key={field.id} className="bg-white flex items-center gap-3 px-4 py-3" style={{ borderRadius: 11, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button type="button" onClick={() => handleMove(field.id, "up")} disabled={isFirst || movingId === field.id + "up"}
                    style={{ background: "none", border: "none", cursor: isFirst ? "not-allowed" : "pointer", color: isFirst ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => handleMove(field.id, "down")} disabled={isLast || movingId === field.id + "down"}
                    style={{ background: "none", border: "none", cursor: isLast ? "not-allowed" : "pointer", color: isLast ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Order badge */}
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", width: 18, textAlign: "right", flexShrink: 0 }}>
                  {idx + 1}
                </span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
                      {field.name}
                    </p>
                    {field.is_required && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", backgroundColor: "#FEF9C3", color: "#854D0E", borderRadius: 4, padding: "2px 5px" }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                      {typeLabel}
                      {field.field_type === "select" && field.options && ` · ${field.options.length} options`}
                    </span>
                    {field.ai_hint && (
                      <span className="flex items-center gap-1 truncate" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", maxWidth: 340 }} title={field.ai_hint}>
                        <HelpCircle size={10} />
                        {field.ai_hint}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit */}
                <button type="button" onClick={() => setModal({ mode: "edit", field })}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 4, display: "flex" }}>
                  <Pencil size={13} />
                </button>

                {/* Delete */}
                <button type="button" onClick={() => handleDelete(field.id)} disabled={deletingId === field.id}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, display: "flex" }}>
                  {deletingId === field.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <FieldModal
          modal={modal}
          templateId={templateId}
          categoryId={categoryId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── FieldModal ────────────────────────────────────────────────────────────────

function FieldModal({
  modal, templateId, categoryId, onClose,
}: {
  modal: ModalState;
  templateId: string;
  categoryId: string;
  onClose: () => void;
}) {
  const isEdit = modal.mode === "edit";
  const initial = isEdit ? modal.field : null;

  const [fieldType, setFieldType] = useState<FieldType>(initial?.field_type ?? "text");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);

  const action = isEdit
    ? async (_prev: { error?: string } | null, fd: FormData) => {
        fd.set("field_type", fieldType);
        fd.set("is_required", String(isRequired));
        const result = await updateField(initial!.id, categoryId, fd);
        if (!result.error) onClose();
        return result;
      }
    : async (_prev: { error?: string } | null, fd: FormData) => {
        fd.set("field_type", fieldType);
        fd.set("is_required", String(isRequired));
        const result = await createField(templateId, categoryId, fd);
        if (!result.error) onClose();
        return result;
      };

  const [state, formAction, isPending] = useActionState(action, null);
  const errorMessage = state && "error" in state ? state.error : null;

  const selectedTypeInfo = FIELD_TYPES.find((t) => t.value === fieldType);

  return (
    <>
      <div className="fixed inset-0" style={{ backgroundColor: "rgba(26,26,26,0.4)", zIndex: 40, backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, maxHeight: "90vh", overflowY: "auto", backgroundColor: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 40px rgba(26,26,26,0.18)", zIndex: 50, padding: 28 }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
            {isEdit ? `Edit "${initial!.name}"` : "Add field"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 2, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {errorMessage && (
          <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
            {errorMessage}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-5">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Field name <span style={{ color: "#DC2626" }}>*</span></label>
            <input type="text" name="name" defaultValue={initial?.name ?? ""} required autoFocus
              placeholder="e.g. Martindale, Fire Rating, Composition"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
            />
          </div>

          {/* Field type */}
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Field type</label>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setFieldType(t.value)}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 transition-all text-left"
                  style={{ borderRadius: 9, border: `1.5px solid ${fieldType === t.value ? "#1A1A1A" : "#E4E1DC"}`, backgroundColor: fieldType === t.value ? "#FAFAF9" : "#FFFFFF", cursor: "pointer" }}
                >
                  <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{t.label}</span>
                  <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>{t.description}</span>
                </button>
              ))}
            </div>
            {selectedTypeInfo && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                Selected: <strong>{selectedTypeInfo.label}</strong> — {selectedTypeInfo.description}
              </p>
            )}
          </div>

          {/* Options — only for select */}
          {fieldType === "select" && (
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>Options <span style={{ fontSize: 10, fontWeight: 400, color: "#9A9590", textTransform: "none", letterSpacing: 0 }}>(one per line)</span></label>
              <textarea name="options" rows={6}
                defaultValue={initial?.options?.join("\n") ?? ""}
                placeholder={"Option A\nOption B\nOption C"}
                style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", lineHeight: 1.6 }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
              />
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>Required field</p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>Spec cannot be saved without a value</p>
            </div>
            <button type="button" onClick={() => setIsRequired((v) => !v)}
              style={{ width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, backgroundColor: isRequired ? "#1A1A1A" : "#E4E1DC", transition: "background-color 0.2s ease" }}
            >
              <span style={{ position: "absolute", top: 3, left: isRequired ? 19 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s ease" }} />
            </button>
          </div>

          {/* AI hint */}
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>
              AI hint
              <span style={{ fontSize: 10, fontWeight: 400, color: "#9A9590", textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                — tells the scraper what to look for on supplier pages
              </span>
            </label>
            <input type="text" name="ai_hint" defaultValue={initial?.ai_hint ?? ""}
              placeholder="e.g. Martindale abrasion rub count — look for a plain number"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onClose}
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2"
              style={{ height: 42, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 10, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Add field"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 10, fontWeight: 600, color: "#1A1A1A",
  textTransform: "uppercase", letterSpacing: "1.2px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, border: "1px solid #E4E1DC", backgroundColor: "#FAFAF9",
  borderRadius: 8, padding: "0 14px", fontFamily: "var(--font-inter), sans-serif",
  fontSize: 14, color: "#1A1A1A", outline: "none", boxSizing: "border-box",
};
