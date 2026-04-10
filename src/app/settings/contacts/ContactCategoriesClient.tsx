"use client";

import { useState, useActionState } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, X, Loader2,
  Users, Package, Hammer, Briefcase, Building, Palette, Camera, Zap,
  Layers, Check,
} from "lucide-react";
import {
  createContactCategory, updateContactCategory, deleteContactCategory,
  moveContactCategory, toggleContactCategoryActive,
} from "./actions";
import type { ContactCategoryRow } from "@/types/database";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS: { key: string; Icon: React.ElementType }[] = [
  { key: "users",    Icon: Users },
  { key: "package",  Icon: Package },
  { key: "hammer",   Icon: Hammer },
  { key: "briefcase",Icon: Briefcase },
  { key: "building", Icon: Building },
  { key: "palette",  Icon: Palette },
  { key: "camera",   Icon: Camera },
  { key: "zap",      Icon: Zap },
  { key: "layers",   Icon: Layers },
];

function getIcon(key: string | null): React.ElementType {
  return ICONS.find((i) => i.key === key)?.Icon ?? Users;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 11, fontWeight: 600, color: "#9A9590",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 38,
  paddingLeft: 12, paddingRight: 12,
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13, color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 9, outline: "none",
  boxSizing: "border-box",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  categories: ContactCategoryRow[];
  companyCountByCategory: Record<string, number>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContactCategoriesClient({ categories, companyCountByCategory }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);
  const selected = categories.find((c) => c.id === selectedId) ?? null;

  function toggleExpand(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 56px)", overflow: "hidden" }}>

      {/* ── Left: Category list ── */}
      <div style={{ width: 480, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 24, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Contact Categories
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            Organise your contacts into categories. Studios can add, rename and reorder freely.
          </p>
        </div>

        {/* Category tree */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
          {topLevel.map((cat) => {
            const children = childrenOf(cat.id);
            const isExpanded = expandedCats.has(cat.id);
            const Icon = getIcon(cat.icon);
            const count = companyCountByCategory[cat.id] ?? 0;

            return (
              <div key={cat.id} style={{ marginBottom: 2 }}>
                {/* Parent row */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10, border: "none",
                      cursor: "pointer", textAlign: "left",
                      backgroundColor: selectedId === cat.id ? "#FFFFFF" : "transparent",
                      boxShadow: selectedId === cat.id ? "0 1px 6px rgba(26,26,26,0.08)" : "none",
                      opacity: cat.is_active ? 1 : 0.45,
                    }}
                  >
                    <Icon size={15} style={{ color: selectedId === cat.id ? "#1A1A1A" : "#9A9590", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: selectedId === cat.id ? 600 : 400, color: selectedId === cat.id ? "#1A1A1A" : "#6B7280", flex: 1 }}>
                      {cat.name}
                    </span>
                    {count > 0 && (
                      <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>{count}</span>
                    )}
                  </button>

                  {/* Move buttons */}
                  <MoveButtons id={cat.id} />

                  {/* Expand toggle */}
                  {children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.id)}
                      style={{ padding: "4px 3px", background: "none", border: "none", cursor: "pointer", color: "#C0BEBB" }}
                    >
                      <ChevronRight size={13} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }} />
                    </button>
                  )}
                </div>

                {/* Children */}
                {isExpanded && children.length > 0 && (
                  <div style={{ marginLeft: 28, marginBottom: 4 }}>
                    {children.map((child) => {
                      const childCount = companyCountByCategory[child.id] ?? 0;
                      return (
                        <div key={child.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(selectedId === child.id ? null : child.id)}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 12px", borderRadius: 8, border: "none",
                              cursor: "pointer", textAlign: "left",
                              backgroundColor: selectedId === child.id ? "#FFFFFF" : "transparent",
                              boxShadow: selectedId === child.id ? "0 1px 4px rgba(26,26,26,0.07)" : "none",
                              opacity: child.is_active ? 1 : 0.45,
                            }}
                          >
                            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: selectedId === child.id ? 600 : 400, color: selectedId === child.id ? "#1A1A1A" : "#9A9590" }}>
                              {child.name}
                            </span>
                            {childCount > 0 && (
                              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB" }}>{childCount}</span>
                            )}
                          </button>
                          <MoveButtons id={child.id} />
                        </div>
                      );
                    })}

                    {/* Add sub-category */}
                    <AddCategoryRow parentId={cat.id} />
                  </div>
                )}

                {/* Expand to show add sub-cat if no children yet but selected */}
                {!isExpanded && children.length === 0 && selectedId === cat.id && (
                  <div style={{ marginLeft: 28, marginBottom: 4 }}>
                    <AddCategoryRow parentId={cat.id} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Add top-level category */}
          <AddCategoryRow parentId={null} />
        </div>
      </div>

      {/* ── Right: Detail panel ── */}
      <div
        style={{
          width: selectedId ? 340 : 0,
          overflow: "hidden",
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
        }}
      >
        {selected && (
          <CategoryPanel
            key={selected.id}
            category={selected}
            companyCount={companyCountByCategory[selected.id] ?? 0}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Move buttons ──────────────────────────────────────────────────────────────

function MoveButtons({ id }: { id: string }) {
  const moveUp = async () => { await moveContactCategory(id, "up"); };
  const moveDown = async () => { await moveContactCategory(id, "down"); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <form action={moveUp}>
        <button type="submit" style={{ padding: "2px 4px", background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", display: "flex" }}>
          <ChevronUp size={11} />
        </button>
      </form>
      <form action={moveDown}>
        <button type="submit" style={{ padding: "2px 4px", background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", display: "flex" }}>
          <ChevronDown size={11} />
        </button>
      </form>
    </div>
  );
}

// ── Add category row ──────────────────────────────────────────────────────────

function AddCategoryRow({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      if (parentId) formData.set("parent_id", parentId);
      const result = await createContactCategory(formData);
      if (!result.error) setOpen(false);
      return result;
    },
    {}
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", background: "none", border: "none",
          cursor: "pointer", color: "#C0BEBB", width: "100%",
          fontFamily: "var(--font-inter), sans-serif", fontSize: 12,
          borderRadius: 8,
        }}
        className="hover:text-[#9A9590] transition-colors"
      >
        <Plus size={12} />
        {parentId ? "Add sub-category" : "Add category"}
      </button>
    );
  }

  return (
    <form action={action} style={{ display: "flex", gap: 6, padding: "6px 4px", alignItems: "center" }}>
      <input
        name="name"
        autoFocus
        placeholder={parentId ? "Sub-category name" : "Category name"}
        style={{ ...inputStyle, height: 32, fontSize: 12, flex: 1 }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
      />
      <button
        type="submit"
        disabled={pending}
        style={{ height: 32, width: 32, borderRadius: 8, backgroundColor: "#FFDE28", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{ height: 32, width: 32, borderRadius: 8, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#C0BEBB" }}
      >
        <X size={13} />
      </button>
      {state.error && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#EF4444" }}>{state.error}</p>}
    </form>
  );
}

// ── Category detail panel ─────────────────────────────────────────────────────

function CategoryPanel({
  category,
  companyCount,
  onClose,
}: {
  category: ContactCategoryRow;
  companyCount: number;
  onClose: () => void;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) =>
      updateContactCategory(category.id, formData),
    {}
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: { error?: string }) => {
      const result = await deleteContactCategory(category.id);
      if (!result.error) onClose();
      return result;
    },
    {}
  );

  return (
    <div
      style={{
        width: 340, height: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 2px 20px rgba(26,26,26,0.08)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px", borderBottom: "1px solid #F0EEEB", flexShrink: 0 }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
          Edit category
        </p>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB" }}>
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <p style={{ ...labelStyle, marginBottom: 6 }}>Name</p>
            <input
              name="name"
              defaultValue={category.name}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
            />
          </div>

          {/* Icon picker */}
          <div>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Icon</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ICONS.map(({ key, Icon }) => (
                <label
                  key={key}
                  style={{
                    width: 38, height: 38,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 9, cursor: "pointer",
                    border: `1.5px solid ${category.icon === key ? "#FFDE28" : "#E4E1DC"}`,
                    backgroundColor: category.icon === key ? "#FFFBDC" : "#FAFAF9",
                  }}
                >
                  <input type="radio" name="icon" value={key} defaultChecked={category.icon === key} style={{ display: "none" }} />
                  <Icon size={16} style={{ color: category.icon === key ? "#1A1A1A" : "#9A9590" }} />
                </label>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}>Active</p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>Inactive categories are hidden from filters</p>
            </div>
            <input type="hidden" name="is_active" value={category.is_active ? "true" : "false"} />
            <button
              type="button"
              onClick={async () => { await toggleContactCategoryActive(category.id, category.is_active); }}
              style={{
                width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                backgroundColor: category.is_active ? "#FFDE28" : "#E4E1DC",
                position: "relative", flexShrink: 0,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FFFFFF",
                position: "absolute", top: 3,
                left: category.is_active ? 21 : 3,
                transition: "left 0.18s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {saveState.error && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#EF4444" }}>{saveState.error}</p>
          )}

          <button
            type="submit"
            disabled={savePending}
            style={{
              height: 38, borderRadius: 9, backgroundColor: "#FFDE28",
              border: "none", cursor: "pointer",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {savePending ? <Loader2 size={14} className="animate-spin" /> : "Save changes"}
          </button>
        </form>

        {/* Delete */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EEEB" }}>
          <form action={deleteAction}>
            <button
              type="submit"
              disabled={deletePending || companyCount > 0}
              style={{
                width: "100%", height: 36, borderRadius: 9,
                backgroundColor: "transparent",
                border: "1.5px solid #FCA5A5",
                cursor: companyCount > 0 ? "not-allowed" : "pointer",
                fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500,
                color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: companyCount > 0 ? 0.5 : 1,
              }}
            >
              {deletePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {companyCount > 0 ? `In use by ${companyCount} contact${companyCount > 1 ? "s" : ""}` : "Delete category"}
            </button>
          </form>
          {deleteState.error && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#EF4444", marginTop: 6 }}>{deleteState.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
