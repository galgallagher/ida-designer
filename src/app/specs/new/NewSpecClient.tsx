"use client";

import { useState, useRef, useActionState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Plus, X, Loader2, Tag, ImageIcon,
  Layers, Lightbulb, Scissors, Grid3x3, Hammer,
  Paintbrush, Droplets, Key, Armchair, Square,
} from "lucide-react";
import { createSpec } from "../actions";
import type { CreateSpecResult } from "../actions";
import type { LibraryCategoryRow, LibraryTemplateRow, LibraryTemplateFieldRow } from "@/types/database";

// ── Icon map ──────────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  layers: Layers, lightbulb: Lightbulb, scissors: Scissors,
  grid: Grid3x3, hammer: Hammer, paintbrush: Paintbrush,
  droplets: Droplets, key: Key, armchair: Armchair, square: Square,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewSpecClientProps {
  categories: LibraryCategoryRow[];
  templates: LibraryTemplateRow[];
  fieldsByTemplate: Record<string, LibraryTemplateFieldRow[]>;
  suppliers: { id: string; name: string; website: string | null }[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewSpecClient({ categories, templates, fieldsByTemplate, suppliers }: NewSpecClientProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [supplierMode, setSupplierMode] = useState<"existing" | "new" | "none">("none");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: CreateSpecResult | null, formData: FormData) => {
      // Inject tags as comma-separated string
      formData.set("tags", tags.join(","));
      return await createSpec(formData);
    },
    null
  );

  const errorMessage = state && "error" in state ? state.error : null;

  // Category tree
  const topLevelCats = categories.filter((c) => !c.parent_id);
  const childCats = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const templateFields = selectedTemplateId ? (fieldsByTemplate[selectedTemplateId] ?? []) : [];

  function handleCategorySelect(catId: string) {
    setSelectedCategoryId(catId);
    // Auto-pick template by name match or first available
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      const match = templates.find((t) => t.name.toLowerCase().includes(cat.name.toLowerCase().split(" ")[0]));
      setSelectedTemplateId(match?.id ?? templates[0]?.id ?? null);
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  // Step 1: Category picker
  if (step === 1) {
    return (
      <div className="max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6" style={{ fontSize: 12, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
          <Link href="/specs" style={{ color: "#9A9590", textDecoration: "none" }} className="hover:text-[#1A1A1A] transition-colors">Spec Library</Link>
          <span>/</span>
          <span style={{ color: "#1A1A1A", fontWeight: 500 }}>New item</span>
        </div>

        <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
          Choose a category
        </h1>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 28 }}>
          Pick the category that best describes this item. This determines which fields appear on the spec.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {topLevelCats.map((cat) => {
            const Icon = cat.icon ? (iconMap[cat.icon] ?? Layers) : Layers;
            const children = childCats(cat.id);
            const isSelected = selectedCategoryId === cat.id || children.some((c) => c.id === selectedCategoryId);

            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className="w-full flex flex-col items-start gap-2 p-4 bg-white transition-all text-left"
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${isSelected ? "#1A1A1A" : "#F0EEEB"}`,
                    boxShadow: isSelected ? "0 2px 12px rgba(26,26,26,0.1)" : "0 1px 4px rgba(26,26,26,0.05)",
                    cursor: "pointer",
                  }}
                >
                  <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, backgroundColor: isSelected ? "#1A1A1A" : "#F0EEEB" }}>
                    <Icon size={16} style={{ color: isSelected ? "#FFDE28" : "#9A9590" }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{cat.name}</p>
                    {children.length > 0 && (
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 2 }}>
                        {children.map((c) => c.name).join(", ")}
                      </p>
                    )}
                  </div>
                </button>

                {/* Sub-category chips if parent selected */}
                {isSelected && children.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(child.id)}
                        className="px-2.5 py-1 transition-all"
                        style={{
                          borderRadius: 6, border: "none", cursor: "pointer",
                          fontFamily: "var(--font-inter), sans-serif", fontSize: 11,
                          backgroundColor: selectedCategoryId === child.id ? "#FFDE28" : "#F0EEEB",
                          color: "#1A1A1A",
                          fontWeight: selectedCategoryId === child.id ? 600 : 400,
                        }}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Template picker (if multiple templates) */}
        {templates.length > 1 && (
          <div className="mb-8">
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Spec template
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className="px-3 py-1.5 transition-all"
                  style={{
                    borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "var(--font-inter), sans-serif", fontSize: 13,
                    backgroundColor: selectedTemplateId === t.id ? "#1A1A1A" : "#F0EEEB",
                    color: selectedTemplateId === t.id ? "#FFFFFF" : "#9A9590",
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link href="/specs" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", textDecoration: "none" }}>
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!selectedCategoryId}
            className="flex items-center gap-2"
            style={{
              height: 44, paddingLeft: 24, paddingRight: 24,
              backgroundColor: selectedCategoryId ? "#FFDE28" : "#F0EEEB",
              border: "none", borderRadius: 10, cursor: selectedCategoryId ? "pointer" : "not-allowed",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600,
              color: selectedCategoryId ? "#1A1A1A" : "#C0BEBB",
            }}
          >
            Continue <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Fill in the spec
  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6" style={{ fontSize: 12, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
        <Link href="/specs" style={{ color: "#9A9590", textDecoration: "none" }}>Spec Library</Link>
        <span>/</span>
        <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 hover:text-[#1A1A1A] transition-colors" style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, padding: 0 }}>
          <ArrowLeft size={11} /> {selectedCategory?.name ?? "Category"}
        </button>
        <span>/</span>
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>New item</span>
      </div>

      <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
        New {selectedCategory?.name} spec
      </h1>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 28 }}>
        Fill in the details. Fields marked * are required.
      </p>

      {errorMessage && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626", marginBottom: 20 }}>
          {errorMessage}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        {/* Hidden fields */}
        <input type="hidden" name="template_id" value={selectedTemplateId ?? ""} />
        <input type="hidden" name="category_id" value={selectedCategoryId ?? ""} />

        {/* ── Core fields ── */}
        <Section label="Item details">
          <Field label="Name" required>
            <input type="text" name="name" placeholder="e.g. Kvadrat — Hallingdal 65 in Stone" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={2} placeholder="Optional short description…" style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }} onFocus={focusHandler} onBlur={blurHandler} />
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
        {templateFields.length > 0 && (
          <Section label="Characteristics">
            {templateFields.map((field) => (
              <Field key={field.id} label={field.name} required={field.is_required}>
                {field.field_type === "textarea" ? (
                  <textarea name={`field_${field.id}`} rows={2} style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }} onFocus={focusHandler} onBlur={blurHandler} />
                ) : field.field_type === "select" && field.options ? (
                  <select name={`field_${field.id}`} style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }} onFocus={focusHandler} onBlur={blurHandler}>
                    <option value="">— Select —</option>
                    {(field.options as string[]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.field_type === "boolean" ? (
                  <select name={`field_${field.id}`} style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }}>
                    <option value="">— Select —</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    type={field.field_type === "number" || field.field_type === "currency" ? "number" : field.field_type === "url" ? "url" : "text"}
                    name={`field_${field.id}`}
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
              <input type="number" name="cost_from" min="0" step="0.01" placeholder="0.00" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="To (£)">
              <input type="number" name="cost_to" min="0" step="0.01" placeholder="0.00" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="Unit">
              <input type="text" name="cost_unit" placeholder="per m², per unit…" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
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
                <button type="button" onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 0, display: "flex" }}>
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
              placeholder="Type a tag and press Enter (e.g. fire-rated, sustainable)"
              style={{ ...inputStyle, flex: 1 }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
            <button type="button" onClick={addTag} style={{ height: 44, paddingLeft: 16, paddingRight: 16, backgroundColor: "#F0EEEB", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}>
              Add
            </button>
          </div>
        </Section>

        {/* ── Supplier ── */}
        <Section label="Supplier">
          <div className="flex gap-2 mb-4">
            {(["none", "existing", "new"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setSupplierMode(mode)}
                style={{ height: 34, paddingLeft: 14, paddingRight: 14, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, backgroundColor: supplierMode === mode ? "#1A1A1A" : "#F0EEEB", color: supplierMode === mode ? "#FFFFFF" : "#9A9590", transition: "all 0.15s ease" }}
              >
                {mode === "none" ? "No supplier" : mode === "existing" ? "Existing" : "Add new supplier"}
              </button>
            ))}
          </div>

          {supplierMode === "existing" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supplier" required>
                <select name="supplier_id" required style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }} onFocus={focusHandler} onBlur={blurHandler}>
                  <option value="">— Choose supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier code / SKU">
                <input type="text" name="supplier_code" placeholder="e.g. HAL-65-0123" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </Field>
              <Field label="Unit cost (£)">
                <input type="number" name="unit_cost" min="0" step="0.01" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
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
        <div className="flex items-center gap-4 pt-2">
          <Link href="/specs" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", textDecoration: "none" }}>Cancel</Link>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            className="flex items-center gap-2"
            style={{ height: 44, paddingLeft: 28, paddingRight: 28, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 10, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isPending ? "Saving…" : "Save to library"}
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
