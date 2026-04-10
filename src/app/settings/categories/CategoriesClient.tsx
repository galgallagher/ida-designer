"use client";

import { useState, useActionState } from "react";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, ChevronRight, X, Loader2,
  Layers, Lightbulb, Scissors, Grid3x3, Hammer, Paintbrush,
  Droplets, Key, Armchair, Square, Check, HelpCircle, Lock,
} from "lucide-react";
import {
  createCategory, updateCategory, deleteCategory,
  moveCategory, toggleCategoryActive, ensureCategoryTemplate,
} from "./actions";
import {
  createField, updateField, deleteField, moveField,
} from "./[id]/field-actions";
import type { SpecCategoryRow, SpecTemplateFieldRow, FieldType } from "@/types/database";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS: { key: string; Icon: React.ElementType }[] = [
  { key: "layers",     Icon: Layers },
  { key: "lightbulb",  Icon: Lightbulb },
  { key: "scissors",   Icon: Scissors },
  { key: "grid",       Icon: Grid3x3 },
  { key: "hammer",     Icon: Hammer },
  { key: "paintbrush", Icon: Paintbrush },
  { key: "droplets",   Icon: Droplets },
  { key: "key",        Icon: Key },
  { key: "armchair",   Icon: Armchair },
  { key: "square",     Icon: Square },
];

const FIELD_TYPES: { value: FieldType; label: string; description: string }[] = [
  { value: "text",     label: "Short text",  description: "Single line" },
  { value: "textarea", label: "Long text",   description: "Multi-line" },
  { value: "number",   label: "Number",      description: "Numeric" },
  { value: "select",   label: "Dropdown",    description: "Fixed options" },
  { value: "boolean",  label: "Yes / No",    description: "Toggle" },
  { value: "url",      label: "URL",         description: "Web link" },
  { value: "currency", label: "Currency",    description: "Money" },
];

function getIcon(key: string | null): React.ElementType {
  return ICONS.find((i) => i.key === key)?.Icon ?? Layers;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 11,
  fontWeight: 600,
  color: "#9A9590",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

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
  borderRadius: 9,
  outline: "none",
  boxSizing: "border-box",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoriesClientProps {
  categories: SpecCategoryRow[];
  specCountByCategory: Record<string, number>;
  allFields: SpecTemplateFieldRow[];
}

type AddModalState =
  | { mode: "add-top" }
  | { mode: "add-sub"; parentId: string; parentName: string };

type FieldModalState =
  | { mode: "add" }
  | { mode: "edit"; field: SpecTemplateFieldRow };

// ── Root component ────────────────────────────────────────────────────────────

export default function CategoriesClient({ categories, specCountByCategory, allFields }: CategoriesClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addModal, setAddModal] = useState<AddModalState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;
  const panelOpen = !!selectedCategory;

  // Derive parent + fields for the panel
  const parentCategory = selectedCategory?.parent_id
    ? categories.find((c) => c.id === selectedCategory.parent_id) ?? null
    : null;
  const parentFields = parentCategory?.template_id
    ? allFields.filter((f) => f.template_id === parentCategory.template_id).sort((a, b) => a.order_index - b.order_index)
    : [];
  const ownFields = selectedCategory?.template_id
    ? allFields.filter((f) => f.template_id === selectedCategory.template_id).sort((a, b) => a.order_index - b.order_index)
    : [];

  const topLevel = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteCategory(id);
    if (result.error) { setDeleteError(result.error); setDeletingId(null); }
    else if (selectedId === id) setSelectedId(null);
  }

  async function handleToggle(id: string, current: boolean) {
    setTogglingId(id);
    await toggleCategoryActive(id, current);
    setTogglingId(null);
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setMovingId(id + direction);
    await moveCategory(id, direction);
    setMovingId(null);
  }

  // height:100% fills <main>'s content box (AppShell sets padding:28, main is flex-1 h-screen)
  // grid-template-rows: auto 1fr → header takes its natural height, content fills the rest
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>

      {/* ── Header row — always visible, no sticky needed ─────────────────── */}
      <div style={{ paddingBottom: 20 }}>
        <div className="flex items-center gap-2 mb-3" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          <span>Settings</span>
          <span>/</span>
          <span style={{ color: "#1A1A1A", fontWeight: 500 }}>Spec Categories</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>
              Spec Categories
            </h1>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>
              Click the pencil to edit a category and manage its template fields.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddModal({ mode: "add-top" })}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ height: 40, paddingLeft: 18, paddingRight: 18, backgroundColor: "#FFDE28", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", flexShrink: 0 }}
          >
            <Plus size={14} /> Add category
          </button>
        </div>
      </div>

      {/* ── Content row — left and right scroll independently ───────────────── */}
      <div style={{ display: "flex", alignItems: "stretch", overflow: "hidden" }}>

      {/* ── LEFT: category list — its own scroll ────────────────────────────── */}
      <div style={{ width: 480, flexShrink: 0, overflowY: "auto", paddingBottom: 28 }}>

        {/* Delete error */}
        {deleteError && (
          <div className="flex items-center justify-between mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }}>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>{deleteError}</p>
            <button type="button" onClick={() => setDeleteError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Category list */}
        <div className="flex flex-col gap-3">
          {topLevel.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center" style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}>
              <Layers size={28} style={{ color: "#D4D2CF", marginBottom: 12 }} />
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>No categories yet</p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>Add your first category to get started.</p>
            </div>
          )}

          {topLevel.map((cat, idx) => {
            const Icon = getIcon(cat.icon);
            const children = childrenOf(cat.id);
            const specCount = specCountByCategory[cat.id] ?? 0;
            const isFirst = idx === 0;
            const isLast = idx === topLevel.length - 1;
            const isSelected = selectedId === cat.id;
            const isExpanded = expandedCats.has(cat.id);

            return (
              <div
                key={cat.id}
                className="bg-white transition-all"
                style={{
                  borderRadius: 12,
                  boxShadow: isSelected
                    ? "0 0 0 2px #1A1A1A, 0 2px 12px rgba(26,26,26,0.08)"
                    : "0 1px 6px rgba(26,26,26,0.06)",
                }}
              >
                {/* Parent row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button type="button" onClick={() => handleMove(cat.id, "up")} disabled={isFirst || movingId === cat.id + "up"}
                      style={{ background: "none", border: "none", cursor: isFirst ? "not-allowed" : "pointer", color: isFirst ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" onClick={() => handleMove(cat.id, "down")} disabled={isLast || movingId === cat.id + "down"}
                      style={{ background: "none", border: "none", cursor: isLast ? "not-allowed" : "pointer", color: isLast ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  {/* Icon */}
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, backgroundColor: cat.is_active ? "#F0EEEB" : "#F7F6F4", borderRadius: 8 }}>
                    <Icon size={15} style={{ color: cat.is_active ? "#9A9590" : "#C0BEBB" }} />
                  </div>

                  {/* Expand/collapse chevron (only when sub-categories exist) */}
                  {children.length > 0 && (
                    <button type="button" onClick={() => toggleExpand(cat.id)}
                      className="flex-shrink-0 transition-all hover:opacity-70"
                      title={isExpanded ? "Collapse" : "Expand sub-categories"}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 2, display: "flex" }}>
                      <ChevronRight size={13} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                    </button>
                  )}

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: cat.is_active ? "#1A1A1A" : "#9A9590" }}>
                      {cat.name}
                    </p>
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>
                      {children.length > 0 && `${children.length} sub-categor${children.length === 1 ? "y" : "ies"}`}
                      {children.length > 0 && specCount > 0 && " · "}
                      {specCount > 0 && `${specCount} spec${specCount !== 1 ? "s" : ""}`}
                      {children.length === 0 && specCount === 0 && "No specs yet"}
                    </p>
                  </div>

                  {/* Active toggle */}
                  <button type="button" onClick={() => handleToggle(cat.id, cat.is_active)} disabled={togglingId === cat.id}
                    title={cat.is_active ? "Deactivate" : "Activate"}
                    style={{ width: 34, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, backgroundColor: cat.is_active ? "#1A1A1A" : "#E4E1DC", transition: "background-color 0.2s ease" }}>
                    <span style={{ position: "absolute", top: 3, left: cat.is_active ? 17 : 3, width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s ease" }} />
                  </button>

                  {/* Add sub-category */}
                  <button type="button" onClick={() => setAddModal({ mode: "add-sub", parentId: cat.id, parentName: cat.name })}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity" title="Add sub-category"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, display: "flex" }}>
                    <Plus size={13} />
                  </button>

                  {/* Delete */}
                  <button type="button" onClick={() => handleDelete(cat.id)} disabled={deletingId === cat.id}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, display: "flex" }}>
                    {deletingId === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>

                  {/* Edit pencil — opens right panel */}
                  <button type="button"
                    onClick={() => setSelectedId(isSelected ? null : cat.id)}
                    className="flex-shrink-0 transition-all hover:opacity-80"
                    title="Edit category & template fields"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", display: "flex", borderRadius: 7, backgroundColor: isSelected ? "#1A1A1A" : "transparent", color: isSelected ? "#FFFFFF" : "#9A9590" }}>
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Sub-categories — only shown when expanded */}
                {children.length > 0 && isExpanded && (
                  <div style={{ borderTop: "1px solid #F0EEEB" }}>
                    {children.map((child, childIdx) => {
                      const ChildIcon = getIcon(child.icon);
                      const childSpecCount = specCountByCategory[child.id] ?? 0;
                      const isChildSelected = selectedId === child.id;

                      return (
                        <div key={child.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: childIdx < children.length - 1 ? "1px solid #F7F6F4" : undefined, backgroundColor: isChildSelected ? "#FAFAF9" : undefined }}>
                          <div style={{ width: 20, flexShrink: 0 }} />
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button type="button" onClick={() => handleMove(child.id, "up")} disabled={childIdx === 0}
                              style={{ background: "none", border: "none", cursor: childIdx === 0 ? "not-allowed" : "pointer", color: childIdx === 0 ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                              <ChevronUp size={11} />
                            </button>
                            <button type="button" onClick={() => handleMove(child.id, "down")} disabled={childIdx === children.length - 1}
                              style={{ background: "none", border: "none", cursor: childIdx === children.length - 1 ? "not-allowed" : "pointer", color: childIdx === children.length - 1 ? "#E4E1DC" : "#C0BEBB", padding: 1, display: "flex" }}>
                              <ChevronDown size={11} />
                            </button>
                          </div>
                          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: "#F7F6F4", borderRadius: 6 }}>
                            <ChildIcon size={12} style={{ color: "#C0BEBB" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: child.is_active ? "#1A1A1A" : "#9A9590" }}>{child.name}</p>
                            {childSpecCount > 0 && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>{childSpecCount} spec{childSpecCount !== 1 ? "s" : ""}</p>}
                          </div>
                          <button type="button" onClick={() => handleToggle(child.id, child.is_active)} disabled={togglingId === child.id} title={child.is_active ? "Deactivate" : "Activate"}
                            style={{ width: 30, height: 18, borderRadius: 9, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, backgroundColor: child.is_active ? "#1A1A1A" : "#E4E1DC", transition: "background-color 0.2s ease" }}>
                            <span style={{ position: "absolute", top: 2, left: child.is_active ? 14 : 2, width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s ease" }} />
                          </button>
                          <button type="button" onClick={() => handleDelete(child.id)} disabled={deletingId === child.id}
                            className="flex-shrink-0 hover:opacity-70 transition-opacity"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, display: "flex" }}>
                            {deletingId === child.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                          {/* Edit pencil for sub-category */}
                          <button type="button"
                            onClick={() => setSelectedId(isChildSelected ? null : child.id)}
                            className="flex-shrink-0 transition-all hover:opacity-80"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", display: "flex", borderRadius: 6, backgroundColor: isChildSelected ? "#1A1A1A" : "transparent", color: isChildSelected ? "#FFFFFF" : "#9A9590" }}>
                            <Pencil size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MIDDLE: category details panel ───────────────────────────────────── */}
      <div style={{
        width: panelOpen ? 340 : 0,
        overflow: "clip",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
        marginLeft: panelOpen ? 20 : 0,
      }}>
        {selectedCategory && (
          <CategoryPanel
            key={selectedCategory.id}
            category={selectedCategory}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* ── RIGHT: template fields card ───────────────────────────────────────── */}
      <div style={{
        width: panelOpen ? 320 : 0,
        overflow: "clip",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
        marginLeft: panelOpen ? 20 : 0,
      }}>
        {selectedCategory && (
          <TemplateFieldsCard
            key={selectedCategory.id}
            category={selectedCategory}
            ownFields={ownFields}
            parentCategory={parentCategory}
            parentFields={parentFields}
          />
        )}
      </div>

      </div>{/* end content row */}

      {/* Add category modal */}
      {addModal && (
        <AddCategoryModal modal={addModal} onClose={() => setAddModal(null)} />
      )}
    </div>
  );
}

// ── CategoryPanel (details only) ─────────────────────────────────────────────

function CategoryPanel({
  category,
  onClose,
}: {
  category: SpecCategoryRow;
  onClose: () => void;
}) {
  const isSubcategory = !!category.parent_id;
  const [selectedIcon, setSelectedIcon] = useState(category.icon ?? "layers");
  const [isActive, setIsActive] = useState(category.is_active);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [, saveAction, isSaving] = useActionState(
    async (_prev: { error?: string } | null, fd: FormData) => {
      fd.set("icon", selectedIcon);
      fd.set("is_active", String(isActive));
      const result = await updateCategory(category.id, fd);
      if (result.error) setSaveError(result.error);
      return result;
    },
    null
  );

  return (
    <div style={{
      width: 340,
      height: "100%",
      backgroundColor: "#FFFFFF",
      borderRadius: 14,
      boxShadow: "0 4px 24px rgba(26,26,26,0.10)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F0EEEB", flexShrink: 0 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
            {category.name}
          </h2>
          {isSubcategory && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
              Sub-category
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", display: "flex", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 24px" }}>
        <form action={saveAction}>
          {saveError && (
            <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
              {saveError}
            </div>
          )}

          {/* Name + Code */}
          <div className="flex gap-3 mb-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label style={labelStyle}>Name</label>
              <input type="text" name="name" defaultValue={category.name} required
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ width: 72 }}>
              <label style={labelStyle}>Code</label>
              <input type="text" name="abbreviation"
                defaultValue={category.abbreviation ?? ""}
                maxLength={6} placeholder="e.g. FB"
                style={{ ...inputStyle, textTransform: "uppercase", textAlign: "center", letterSpacing: "0.08em" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
              />
            </div>
          </div>

          {/* Icon picker */}
          <div className="flex flex-col gap-2 mb-4">
            <label style={labelStyle}>Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(({ key, Icon }) => (
                <button key={key} type="button" onClick={() => setSelectedIcon(key)}
                  className="flex items-center justify-center transition-all relative"
                  style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: selectedIcon === key ? "#1A1A1A" : "#F0EEEB" }}>
                  <Icon size={15} style={{ color: selectedIcon === key ? "#FFDE28" : "#9A9590" }} />
                  {selectedIcon === key && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 13, height: 13, backgroundColor: "#FFDE28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={7} style={{ color: "#1A1A1A" }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", fontWeight: 500 }}>Active</p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>Show in spec library and new spec form</p>
            </div>
            <button type="button" onClick={() => setIsActive((v) => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, backgroundColor: isActive ? "#1A1A1A" : "#E4E1DC", transition: "background-color 0.2s ease" }}>
              <span style={{ position: "absolute", top: 3, left: isActive ? 18 : 3, width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s ease" }} />
            </button>
          </div>

          <button type="submit" disabled={isSaving} className="flex items-center gap-2 w-full justify-center transition-opacity hover:opacity-80"
            style={{ height: 40, backgroundColor: isSaving ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 9, cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
            {isSaving && <Loader2 size={13} className="animate-spin" />}
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── TemplateFieldsCard ────────────────────────────────────────────────────────

function TemplateFieldsCard({
  category,
  ownFields,
  parentCategory,
  parentFields,
}: {
  category: SpecCategoryRow;
  ownFields: SpecTemplateFieldRow[];
  parentCategory: SpecCategoryRow | null;
  parentFields: SpecTemplateFieldRow[];
}) {
  const isSubcategory = !!category.parent_id;
  // activeTemplateId starts from the category's existing template, or gets set
  // when we lazily create one on first "Add field" click.
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(category.template_id);
  const [fieldModal, setFieldModal] = useState<FieldModalState | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  const [movingFieldId, setMovingFieldId] = useState<string | null>(null);
  const [ensuringTemplate, setEnsuringTemplate] = useState(false);

  async function handleAddField() {
    if (activeTemplateId) {
      setFieldModal({ mode: "add" });
      return;
    }
    // No template yet — create one first, then open the modal
    setEnsuringTemplate(true);
    const result = await ensureCategoryTemplate(category.id);
    setEnsuringTemplate(false);
    if (result.templateId) {
      setActiveTemplateId(result.templateId);
      setFieldModal({ mode: "add" });
    }
  }

  async function handleDeleteField(fieldId: string) {
    setDeletingFieldId(fieldId);
    await deleteField(fieldId, category.id);
    setDeletingFieldId(null);
  }

  async function handleMoveField(fieldId: string, direction: "up" | "down") {
    if (!activeTemplateId) return;
    setMovingFieldId(fieldId + direction);
    await moveField(fieldId, activeTemplateId, category.id, direction);
    setMovingFieldId(null);
  }

  return (
    <div style={{
      width: 320,
      height: "100%",
      backgroundColor: "#FFFFFF",
      borderRadius: 14,
      boxShadow: "0 4px 24px rgba(26,26,26,0.10)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F0EEEB", flexShrink: 0 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
            Template Fields
          </h2>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
            {isSubcategory
              ? `Inherited + additional fields for ${category.name}`
              : `Shown on every ${category.name} spec`}
          </p>
        </div>
        <button type="button" onClick={handleAddField} disabled={ensuringTemplate}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ height: 32, paddingLeft: 12, paddingRight: 12, backgroundColor: "#F0EEEB", border: "none", borderRadius: 8, cursor: ensuringTemplate ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
          {ensuringTemplate ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {ensuringTemplate ? "Setting up…" : "Add field"}
        </button>
      </div>

      {/* Scrollable field list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>

        {/* Inherited fields (subcategory only) */}
        {isSubcategory && parentCategory && (
          <div style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-2 mb-2">
              <Lock size={10} style={{ color: "#C0BEBB", flexShrink: 0 }} />
              <p style={sectionLabel}>Inherited from {parentCategory.name}</p>
            </div>
            {parentFields.length === 0 ? (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", fontStyle: "italic", paddingLeft: 4 }}>
                No shared fields on parent yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {parentFields.map((field) => {
                  const typeLabel = FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type;
                  return (
                    <div key={field.id} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderRadius: 8, backgroundColor: "#F7F6F4", border: "1px solid #EDEBE8", opacity: 0.75 }}>
                      <Lock size={9} style={{ color: "#D4D2CF", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#6B6966" }}>{field.name}</p>
                          {field.is_required && (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", backgroundColor: "#F3F0EC", color: "#A09D99", borderRadius: 4, padding: "1px 4px" }}>req</span>
                          )}
                        </div>
                        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#B0ADA9" }}>
                          {typeLabel}{field.field_type === "select" && field.options ? ` · ${field.options.length} opts` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Divider between inherited and own */}
        {isSubcategory && parentCategory && (
          <div style={{ borderTop: "1px solid #F0EEEB", marginBottom: 16 }}>
            <p style={{ ...sectionLabel, marginTop: 16 }}>
              {ownFields.length > 0 ? "Additional fields" : "Additional fields"}
            </p>
          </div>
        )}

        {/* Own fields */}
        {ownFields.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB" }}>
              {isSubcategory ? "No extra fields yet." : "No fields yet — add the first one."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ownFields.map((field, idx) => {
              const typeLabel = FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type;
              const isFirst = idx === 0;
              const isLast = idx === ownFields.length - 1;

              return (
                <div key={field.id} className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 8, backgroundColor: "#FAFAF9", border: "1px solid #F0EEEB" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{field.name}</p>
                      {field.is_required && (
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", backgroundColor: "#FEF9C3", color: "#854D0E", borderRadius: 4, padding: "1px 4px" }}>req</span>
                      )}
                    </div>
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                      {typeLabel}{field.field_type === "select" && field.options ? ` · ${field.options.length} opts` : ""}
                    </span>
                  </div>

                  {/* Edit */}
                  <button type="button" onClick={() => setFieldModal({ mode: "edit", field })}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 3, display: "flex" }}>
                    <Pencil size={12} />
                  </button>

                  {/* Delete */}
                  <button type="button" onClick={() => handleDeleteField(field.id)} disabled={deletingFieldId === field.id}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 3, display: "flex" }}>
                    {deletingFieldId === field.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>

                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0" style={{ borderLeft: "1px solid #F0EEEB", paddingLeft: 6, marginLeft: 2 }}>
                    <button type="button" onClick={() => handleMoveField(field.id, "up")} disabled={isFirst || movingFieldId === field.id + "up"}
                      style={{ background: "none", border: "none", cursor: isFirst ? "not-allowed" : "pointer", color: isFirst ? "#E4E1DC" : "#C0BEBB", padding: 0, display: "flex" }}>
                      <ChevronUp size={11} />
                    </button>
                    <button type="button" onClick={() => handleMoveField(field.id, "down")} disabled={isLast || movingFieldId === field.id + "down"}
                      style={{ background: "none", border: "none", cursor: isLast ? "not-allowed" : "pointer", color: isLast ? "#E4E1DC" : "#C0BEBB", padding: 0, display: "flex" }}>
                      <ChevronDown size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Field modal */}
      {fieldModal && activeTemplateId && (
        <FieldModal
          modal={fieldModal}
          templateId={activeTemplateId}
          categoryId={category.id}
          onClose={() => setFieldModal(null)}
        />
      )}
    </div>
  );
}

// ── Section label style ───────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 10,
  fontWeight: 600,
  color: "#9A9590",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

// ── AddCategoryModal ──────────────────────────────────────────────────────────

function AddCategoryModal({ modal, onClose }: { modal: AddModalState; onClose: () => void }) {
  const [selectedIcon, setSelectedIcon] = useState("layers");

  const action = async (_prev: { error?: string } | null, fd: FormData) => {
    fd.set("icon", selectedIcon);
    if (modal.mode === "add-sub") fd.set("parent_id", modal.parentId);
    const result = await createCategory(fd);
    if (!result.error) onClose();
    return result;
  };

  const [state, formAction, isPending] = useActionState(action, null);
  const errorMessage = state && "error" in state ? state.error : null;
  const title = modal.mode === "add-sub" ? `Add sub-category to "${modal.parentName}"` : "Add category";

  return (
    <>
      <div className="fixed inset-0" style={{ backgroundColor: "rgba(26,26,26,0.4)", zIndex: 40, backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 420, backgroundColor: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 40px rgba(26,26,26,0.18)", zIndex: 50, padding: 28 }}>
        <div className="flex items-start justify-between mb-6">
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 2, display: "flex" }}><X size={16} /></button>
        </div>
        {errorMessage && (
          <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{errorMessage}</div>
        )}
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Name <span style={{ color: "#DC2626" }}>*</span></label>
            <input type="text" name="name" required autoFocus placeholder="e.g. Soft Furnishings"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(({ key, Icon }) => (
                <button key={key} type="button" onClick={() => setSelectedIcon(key)}
                  className="relative flex items-center justify-center transition-all"
                  style={{ width: 38, height: 38, borderRadius: 9, border: "none", cursor: "pointer", backgroundColor: selectedIcon === key ? "#1A1A1A" : "#F0EEEB" }}>
                  <Icon size={16} style={{ color: selectedIcon === key ? "#FFDE28" : "#9A9590" }} />
                  {selectedIcon === key && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, backgroundColor: "#FFDE28", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={8} style={{ color: "#1A1A1A" }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onClose} style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Cancel</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2"
              style={{ height: 42, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 10, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? "Saving…" : "Add category"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── FieldModal ────────────────────────────────────────────────────────────────

function FieldModal({ modal, templateId, categoryId, onClose }: { modal: FieldModalState; templateId: string; categoryId: string; onClose: () => void }) {
  const isEdit = modal.mode === "edit";
  const initial = isEdit ? modal.field : null;
  const [fieldType, setFieldType] = useState<FieldType>(initial?.field_type ?? "text");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);

  const action = isEdit
    ? async (_prev: { error?: string } | null, fd: FormData) => {
        fd.set("field_type", fieldType); fd.set("is_required", String(isRequired));
        const result = await updateField(initial!.id, categoryId, fd);
        if (!result.error) onClose(); return result;
      }
    : async (_prev: { error?: string } | null, fd: FormData) => {
        fd.set("field_type", fieldType); fd.set("is_required", String(isRequired));
        const result = await createField(templateId, categoryId, fd);
        if (!result.error) onClose(); return result;
      };

  const [state, formAction, isPending] = useActionState(action, null);
  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      <div className="fixed inset-0" style={{ backgroundColor: "rgba(26,26,26,0.35)", zIndex: 50, backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, maxHeight: "88vh", overflowY: "auto", backgroundColor: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 40px rgba(26,26,26,0.18)", zIndex: 60, padding: 28 }}>
        <div className="flex items-start justify-between mb-5">
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 17, fontWeight: 700, color: "#1A1A1A" }}>
            {isEdit ? `Edit "${initial!.name}"` : "Add field"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 2, display: "flex" }}><X size={16} /></button>
        </div>
        {errorMessage && (
          <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 14 }}>{errorMessage}</div>
        )}
        <form action={formAction} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Field name <span style={{ color: "#DC2626" }}>*</span></label>
            <input type="text" name="name" defaultValue={initial?.name ?? ""} required autoFocus
              placeholder="e.g. Fire Rating, Composition" style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
            />
          </div>

          {/* Field type */}
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>Field type</label>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {FIELD_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setFieldType(t.value)}
                  style={{ padding: "10px 8px", borderRadius: 9, border: `1.5px solid ${fieldType === t.value ? "#1A1A1A" : "#E4E1DC"}`, backgroundColor: fieldType === t.value ? "#1A1A1A" : "#FAFAF9", cursor: "pointer", textAlign: "left" }}>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: fieldType === t.value ? "#FFFFFF" : "#1A1A1A" }}>{t.label}</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: fieldType === t.value ? "#C0BEBB" : "#9A9590", marginTop: 2 }}>{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options (select only) */}
          {fieldType === "select" && (
            <div className="flex flex-col gap-1.5">
              <label style={labelStyle}>Options <span style={{ fontWeight: 400, textTransform: "none", color: "#C0BEBB" }}>(one per line)</span></label>
              <textarea name="options" rows={4}
                defaultValue={initial?.options ? (initial.options as string[]).join("\n") : ""}
                placeholder={"Fabric\nLeather\nVelvet\nBoucle"}
                style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
              />
            </div>
          )}

          {/* AI hint */}
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>AI hint <span style={{ fontWeight: 400, textTransform: "none", color: "#C0BEBB" }}>(optional)</span></label>
            <input type="text" name="ai_hint" defaultValue={initial?.ai_hint ?? ""}
              placeholder="e.g. Look for fire rating certificate or label"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
            />
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", fontWeight: 500 }}>Required</p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>Must be filled before saving a spec</p>
            </div>
            <button type="button" onClick={() => setIsRequired((v) => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, backgroundColor: isRequired ? "#1A1A1A" : "#E4E1DC", transition: "background-color 0.2s ease" }}>
              <span style={{ position: "absolute", top: 3, left: isRequired ? 18 : 3, width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s ease" }} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #F0EEEB", paddingTop: 16 }}>
            <button type="button" onClick={onClose} style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Cancel</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2"
              style={{ height: 42, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 10, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? "Saving…" : isEdit ? "Save field" : "Add field"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
