"use client";

import { useState, useRef, useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, Loader2, Tag, Trash2, ImageIcon } from "lucide-react";
import { updateSpec, deleteSpec } from "../../actions";
import type { UpdateSpecResult } from "../../actions";
import { useRouter } from "next/navigation";
import type { SpecRow, SpecCategoryRow, SpecTemplateFieldRow } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditSpecClientProps {
  spec: SpecRow;
  category: SpecCategoryRow | null;
  fields: SpecTemplateFieldRow[];
  valueMap: Record<string, string>;
  initialTags: string[];
  existingSupplierJunction: { supplier_id: string; supplier_code: string | null; unit_cost: number | null } | null;
  suppliers: { id: string; name: string; website: string | null }[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditSpecClient({
  spec, category, fields, valueMap, initialTags, existingSupplierJunction, suppliers,
}: EditSpecClientProps) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [supplierMode, setSupplierMode] = useState<"existing" | "new" | "none">(
    existingSupplierJunction ? "existing" : "none"
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageUrl, setImageUrl] = useState(spec.image_url ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(spec.image_url ?? null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: UpdateSpecResult | null, formData: FormData) => {
      formData.set("tags", tags.join(","));
      formData.set("supplier_mode", supplierMode);
      return await updateSpec(spec.id, formData);
    },
    null
  );

  const errorMessage = state && "error" in state ? state.error : null;

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleDelete() {
    setIsDeleting(true);
    await deleteSpec(spec.id);
    router.push("/specs");
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6" style={{ fontSize: 12, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
        <Link href="/specs" style={{ color: "#9A9590", textDecoration: "none" }} className="hover:text-[#1A1A1A] transition-colors">
          Spec Library
        </Link>
        <span>/</span>
        <Link href={`/specs/${spec.id}`} className="flex items-center gap-1 hover:text-[#1A1A1A] transition-colors" style={{ color: "#9A9590", textDecoration: "none" }}>
          <ArrowLeft size={11} /> {spec.name}
        </Link>
        <span>/</span>
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>Edit</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          {category && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
              {category.name}
            </p>
          )}
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>
            Edit spec
          </h1>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Trash2 size={12} /> Delete spec
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-6 p-4" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", marginBottom: 12, fontWeight: 500 }}>
            Are you sure you want to delete <strong>{spec.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2"
              style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#DC2626", border: "none", borderRadius: 8, cursor: isDeleting ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}
            >
              {isDeleting && <Loader2 size={13} className="animate-spin" />}
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "#F0EEEB", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626", marginBottom: 20 }}>
          {errorMessage}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        {/* Pass existing image_path so the action can preserve it if no new file is uploaded */}
        <input type="hidden" name="image_path" value={spec.image_path ?? ""} />

        {/* ── Core fields ── */}
        <Section label="Item details">
          <Field label="Name" required>
            <input
              type="text"
              name="name"
              defaultValue={spec.name}
              required
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              rows={2}
              defaultValue={spec.description ?? ""}
              style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>
        </Section>

        {/* ── Image ── */}
        <Section label="Image">
          <div className="flex gap-4">
            {/* Preview thumbnail */}
            <div style={{
              width: 88, height: 88, flexShrink: 0, borderRadius: 10,
              backgroundColor: "#F0EEEB", border: "1px solid #E4E1DC",
              backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {!previewUrl && <ImageIcon size={22} style={{ color: "#C0BEBB" }} />}
            </div>
            {/* Inputs */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <Field label="Image URL">
                <input
                  type="url"
                  name="image_url"
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setPreviewUrl(e.target.value.trim() || null); }}
                  placeholder="https://brand.com/product-image.jpg"
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </Field>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", textAlign: "center", margin: "2px 0" }}>— or upload a file —</p>
              <Field label="File (max 2 MB)">
                <input
                  type="file"
                  name="image_file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setImageUrl(""); setPreviewUrl(URL.createObjectURL(file)); }
                  }}
                  style={{ ...inputStyle, padding: "10px 14px", height: "auto", cursor: "pointer", fontSize: 13 }}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Template fields ── */}
        {fields.length > 0 && (
          <Section label="Characteristics">
            {fields.map((field) => (
              <Field key={field.id} label={field.name} required={field.is_required}>
                {field.field_type === "textarea" ? (
                  <textarea
                    name={`field_${field.id}`}
                    rows={2}
                    defaultValue={valueMap[field.id] ?? ""}
                    style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                ) : field.field_type === "select" && field.options ? (
                  <select
                    name={`field_${field.id}`}
                    defaultValue={valueMap[field.id] ?? ""}
                    style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  >
                    <option value="">— Select —</option>
                    {(field.options as string[]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.field_type === "boolean" ? (
                  <select
                    name={`field_${field.id}`}
                    defaultValue={valueMap[field.id] ?? ""}
                    style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }}
                  >
                    <option value="">— Select —</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    type={field.field_type === "number" || field.field_type === "currency" ? "number" : field.field_type === "url" ? "url" : "text"}
                    name={`field_${field.id}`}
                    defaultValue={valueMap[field.id] ?? ""}
                    step={field.field_type === "currency" ? "0.01" : undefined}
                    style={inputStyle}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                )}
              </Field>
            ))}
          </Section>
        )}

        {/* ── Cost ── */}
        <Section label="Cost estimate">
          <div className="grid grid-cols-3 gap-3">
            <Field label="From (£)">
              <input
                type="number"
                name="cost_from"
                min="0"
                step="0.01"
                defaultValue={spec.cost_from ?? ""}
                placeholder="0.00"
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </Field>
            <Field label="To (£)">
              <input
                type="number"
                name="cost_to"
                min="0"
                step="0.01"
                defaultValue={spec.cost_to ?? ""}
                placeholder="0.00"
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                name="cost_unit"
                defaultValue={spec.cost_unit ?? ""}
                placeholder="per m², per unit…"
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </Field>
          </div>
        </Section>

        {/* ── Tags ── */}
        <Section label="Tags">
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1" style={{ backgroundColor: "#F0EEEB", borderRadius: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A" }}>
                <Tag size={10} />
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 0, display: "flex" }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Type a tag and press Enter"
              style={{ ...inputStyle, flex: 1 }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
            <button
              type="button"
              onClick={addTag}
              style={{ height: 44, paddingLeft: 16, paddingRight: 16, backgroundColor: "#F0EEEB", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </Section>

        {/* ── Supplier ── */}
        <Section label="Supplier">
          <div className="flex gap-2 mb-4">
            {(["none", "existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSupplierMode(mode)}
                style={{
                  height: 34, paddingLeft: 14, paddingRight: 14, borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500,
                  backgroundColor: supplierMode === mode ? "#1A1A1A" : "#F0EEEB",
                  color: supplierMode === mode ? "#FFFFFF" : "#9A9590",
                  transition: "all 0.15s ease",
                }}
              >
                {mode === "none" ? "No supplier" : mode === "existing" ? "Existing" : "Add new supplier"}
              </button>
            ))}
          </div>

          {supplierMode === "existing" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supplier" required>
                <select
                  name="supplier_id"
                  required
                  defaultValue={existingSupplierJunction?.supplier_id ?? ""}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                >
                  <option value="">— Choose supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier code / SKU">
                <input
                  type="text"
                  name="supplier_code"
                  defaultValue={existingSupplierJunction?.supplier_code ?? ""}
                  placeholder="e.g. HAL-65-0123"
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </Field>
              <Field label="Unit cost (£)">
                <input
                  type="number"
                  name="unit_cost"
                  min="0"
                  step="0.01"
                  defaultValue={existingSupplierJunction?.unit_cost ?? ""}
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </Field>
            </div>
          )}

          {supplierMode === "new" && (
            <div className="grid grid-cols-2 gap-3" style={{ backgroundColor: "#FAFAF9", borderRadius: 10, border: "1px solid #E4E1DC", padding: 14 }}>
              <Field label="Company name" required style={{ gridColumn: "1 / -1" }}>
                <input type="text" name="new_supplier_name" required placeholder="e.g. Kvadrat" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Website">
                <input type="url" name="new_supplier_website" placeholder="https://kvadrat.com" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Email">
                <input type="email" name="new_supplier_email" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Phone">
                <input type="text" name="new_supplier_phone" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Supplier code / SKU">
                <input type="text" name="supplier_code" placeholder="e.g. HAL-65-0123" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Unit cost (£)">
                <input type="number" name="unit_cost" min="0" step="0.01" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Footer ── */}
        <div className="flex items-center gap-4 pt-2 pb-8">
          <Link
            href={`/specs/${spec.id}`}
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", textDecoration: "none" }}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            className="flex items-center gap-2"
            style={{
              height: 44, paddingLeft: 28, paddingRight: 28,
              backgroundColor: isPending ? "#FFF0A0" : "#FFDE28",
              border: "none", borderRadius: 10,
              cursor: isPending ? "not-allowed" : "pointer",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A",
            }}
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{label}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children, style }: { label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: "1.2px" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, border: "1px solid #E4E1DC", backgroundColor: "#FAFAF9",
  borderRadius: 8, padding: "0 14px", fontFamily: "var(--font-inter), sans-serif",
  fontSize: 14, color: "#1A1A1A", outline: "none", boxSizing: "border-box",
};

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239A9590' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`;

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
}
