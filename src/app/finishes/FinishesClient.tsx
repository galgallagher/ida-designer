"use client";

/**
 * FinishesClient — /finishes
 *
 * Browsable, editable grid of studio materials organised by category.
 * Studios can add, rename, re-image, or delete any entry.
 * Seeded with ~50 standard finishes on studio creation.
 */

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMaterial, updateMaterial, deleteMaterial, uploadMaterialImage } from "./actions";
import type { StudioMaterialRow, MaterialCategory } from "@/types/database";
import { MATERIAL_CATEGORIES } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  materials: StudioMaterialRow[];
  studioId: string;
}

type ActiveCategory = "all" | MaterialCategory;

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 12,
  fontWeight: 600,
  color: "#1A1A1A",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13,
  color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: 80,
  padding: "10px 12px",
  resize: "vertical",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239A9590' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
};

// ── Category colour accents ───────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<MaterialCategory, string> = {
  wood:     "#C4A882",
  stone:    "#B0ADA8",
  metal:    "#A8AAAD",
  glass:    "#96B4C0",
  concrete: "#9A9896",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function FinishesClient({ materials: initialMaterials, studioId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all");
  const [editingMaterial, setEditingMaterial] = useState<StudioMaterialRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const materials = initialMaterials;

  const filtered = activeCategory === "all"
    ? materials
    : materials.filter((m) => m.category === activeCategory);

  // Group by category for the "All" view section headers
  const grouped = MATERIAL_CATEGORIES
    .map(({ key, label }) => ({
      key,
      label,
      items: filtered.filter((m) => m.category === key),
    }))
    .filter(({ items }) => items.length > 0);

  function openCreate() {
    setEditingMaterial(null);
    setPreviewUrl(null);
    setFormError(null);
    setIsCreating(true);
  }

  function openEdit(m: StudioMaterialRow) {
    setEditingMaterial(m);
    setPreviewUrl(m.image_url);
    setFormError(null);
    setIsCreating(false);
  }

  function closeModal() {
    setEditingMaterial(null);
    setIsCreating(false);
    setPreviewUrl(null);
    setFormError(null);
  }

  // ── Image upload ────────────────────────────────────────────────────────────

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingMaterial) return;

    // Show local preview immediately
    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadMaterialImage(editingMaterial.id, fd);
    setIsUploading(false);

    if (result.error) {
      setFormError(result.error);
      setPreviewUrl(editingMaterial.image_url); // revert preview
    } else {
      router.refresh();
    }
  }

  // ── Save (create or update) ─────────────────────────────────────────────────

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = editingMaterial
        ? await updateMaterial(editingMaterial.id, fd)
        : await createMaterial(fd);

      if (result.error) {
        setFormError(result.error);
      } else {
        closeModal();
        router.refresh();
      }
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!editingMaterial) return;
    if (!confirm(`Delete "${editingMaterial.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteMaterial(editingMaterial.id);
      if (result.error) {
        setFormError(result.error);
      } else {
        closeModal();
        router.refresh();
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#1A1A1A",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              marginBottom: 4,
            }}
          >
            Finishes Library
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {materials.length} material{materials.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{
            height: 36,
            paddingLeft: 16,
            paddingRight: 16,
            backgroundColor: "#FFDE28",
            borderRadius: 8,
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#1A1A1A",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Plus size={14} />
          Add material
        </button>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2" style={{ marginBottom: 28, flexWrap: "wrap" }}>
        {(["all", ...MATERIAL_CATEGORIES.map((c) => c.key)] as ActiveCategory[]).map((key) => {
          const label = key === "all" ? "All" : MATERIAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
          const count = key === "all" ? materials.length : materials.filter((m) => m.category === key).length;
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              style={{
                height: 32,
                paddingLeft: 14,
                paddingRight: 14,
                borderRadius: 8,
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#1A1A1A" : "#9A9590",
                backgroundColor: isActive ? "#1A1A1A" : "#FFFFFF",
                border: isActive ? "none" : "1.5px solid #E4E1DC",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 11 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Material grid ────────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center py-16"
          style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
            No materials yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            Add your first material to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {grouped.map(({ key, label, items }) => (
            <div key={key}>
              {/* Section header — only shown in "All" view */}
              {activeCategory === "all" && (
                <h2
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9A9590",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                  }}
                >
                  {label} · {items.length}
                </h2>
              )}

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
              >
                {items.map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    onEdit={() => openEdit(m)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit modal ──────────────────────────────────────────── */}
      <Dialog open={isCreating || !!editingMaterial} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              {isCreating ? "Add material" : "Edit material"}
            </DialogTitle>
          </DialogHeader>

          {/* Image area — only shown when editing (material must exist first) */}
          {editingMaterial && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Image</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: previewUrl ? undefined : CATEGORY_ACCENT[editingMaterial.category] + "30",
                  border: "1.5px solid #E4E1DC",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={editingMaterial.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="flex flex-col items-center gap-2" style={{ color: "#9A9590" }}>
                    <Upload size={20} />
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12 }}>Upload image</span>
                  </div>
                )}

                {/* Hover overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: "rgba(26,26,26,0.4)" }}
                >
                  {isUploading ? (
                    <Loader2 size={20} color="#FFFFFF" className="animate-spin" />
                  ) : (
                    <>
                      <Upload size={16} color="#FFFFFF" />
                      <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#FFFFFF", fontWeight: 500 }}>
                        {previewUrl ? "Replace" : "Upload"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 6 }}>
                JPG, PNG or WebP · max 4 MB
              </p>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Category */}
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  name="category"
                  defaultValue={editingMaterial?.category ?? "wood"}
                  style={selectStyle}
                  required
                >
                  {MATERIAL_CATEGORIES.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingMaterial?.name ?? ""}
                  placeholder="e.g. White Oak, Carrara Marble"
                  style={inputStyle}
                  required
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: "#9A9590" }}>(optional)</span></label>
                <textarea
                  name="description"
                  defaultValue={editingMaterial?.description ?? ""}
                  placeholder="What is it? Typical uses, finish options, notes for contractors..."
                  style={textareaStyle}
                />
              </div>

              {formError && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626" }}>
                  {formError}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
                {editingMaterial ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
                    style={{
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: 12,
                      color: "#DC2626",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      height: 36,
                      paddingLeft: 16,
                      paddingRight: 16,
                      backgroundColor: "#FFFFFF",
                      border: "1.5px solid #E4E1DC",
                      borderRadius: 8,
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1A1A1A",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 transition-opacity hover:opacity-80"
                    style={{
                      height: 36,
                      paddingLeft: 16,
                      paddingRight: 16,
                      backgroundColor: "#FFDE28",
                      border: "none",
                      borderRadius: 8,
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    {isCreating ? "Add material" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── MaterialCard ───────────────────────────────────────────────────────────────

function MaterialCard({ material, onEdit }: { material: StudioMaterialRow; onEdit: () => void }) {
  const accent = CATEGORY_ACCENT[material.category];
  const label  = MATERIAL_CATEGORIES.find((c) => c.key === material.category)?.label ?? material.category;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        boxShadow: "0 2px 12px rgba(26,26,26,0.07)",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
      }}
      onClick={onEdit}
      className="group transition-shadow hover:shadow-md"
    >
      {/* Image / placeholder */}
      <div
        style={{
          aspectRatio: "4/3",
          backgroundColor: material.image_url ? undefined : accent + "28",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {material.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={material.image_url}
            alt={material.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: accent + "50",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 700, color: accent }}>
              {material.name[0]}
            </span>
          </div>
        )}

        {/* Edit overlay on hover */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(26,26,26,0.35)" }}
        >
          <div
            className="flex items-center gap-1.5"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              borderRadius: 8,
              padding: "6px 12px",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1A1A",
            }}
          >
            <Pencil size={11} />
            Edit
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div style={{ padding: "10px 12px 12px" }}>
        <p
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#1A1A1A",
            marginBottom: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {material.name}
        </p>
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontFamily: "var(--font-inter), sans-serif",
            fontWeight: 600,
            color: accent,
            backgroundColor: accent + "18",
            borderRadius: 4,
            padding: "2px 6px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
