"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, LayoutGrid, LayoutList, Plus, Tag, ChevronRight,
  Layers, Lightbulb, Scissors, Grid3x3, Hammer, Paintbrush,
  Droplets, Key, Armchair, Square,
} from "lucide-react";
import type { SpecCategoryRow } from "@/types/database";
import { getCategoryLabel } from "@/lib/categories";
import SpecDetailModal from "./SpecDetailModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedSpec {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  categoryName: string | null;
  template_id: string;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  tags: string[];
  supplierNames: string[];
  created_at: string;
}

interface SpecLibraryClientProps {
  specs: EnrichedSpec[];
  categories: SpecCategoryRow[];
  allSuppliers: { id: string; name: string }[];
}

type ViewMode = "grid" | "list";

const iconMap: Record<string, React.ElementType> = {
  layers: Layers, lightbulb: Lightbulb, scissors: Scissors,
  grid: Grid3x3, hammer: Hammer, paintbrush: Paintbrush,
  droplets: Droplets, key: Key, armchair: Armchair, square: Square,
};

const PREFS_KEY = "spec_library_prefs";

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpecLibraryClient({ specs, categories, allSuppliers }: SpecLibraryClientProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [openSpecId, setOpenSpecId] = useState<string | null>(null);
  // All top-level cats collapsed by default
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Load view pref
  useState(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) { const p = JSON.parse(raw); if (p.view) setView(p.view); }
    } catch { /* ignore */ }
  });

  const topLevelCats = categories.filter((c) => !c.parent_id);
  const childCats = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  function toggleExpand(catId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function selectCategory(catId: string | null) {
    setSelectedCategory((prev) => (prev === catId ? null : catId));
    // Auto-expand parent when selecting a top-level cat
    if (catId) {
      setExpandedCats((prev) => {
        const next = new Set(prev);
        next.add(catId);
        return next;
      });
    }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    specs.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [specs]);

  const filtered = useMemo(() => {
    let result = specs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          s.supplierNames.some((n) => n.toLowerCase().includes(q))
      );
    }
    if (selectedCategory) {
      const childIds = new Set(childCats(selectedCategory).map((c) => c.id));
      result = result.filter(
        (s) => s.category_id === selectedCategory || (s.category_id && childIds.has(s.category_id))
      );
    }
    if (selectedSupplier) {
      result = result.filter((s) => s.supplierNames.includes(selectedSupplier));
    }
    if (selectedTag) {
      result = result.filter((s) => s.tags.includes(selectedTag));
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs, search, selectedCategory, selectedSupplier, selectedTag]);

  function toggleView(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ view: v })); } catch { /* ignore */ }
  }

  const activeFilterCount = [selectedCategory, selectedSupplier, selectedTag].filter(Boolean).length;

  // Breadcrumb for the selected category filter
  const selectedCat = selectedCategory ? categories.find((c) => c.id === selectedCategory) : null;
  const selectedCatParent = selectedCat?.parent_id ? categories.find((c) => c.id === selectedCat.parent_id) : null;

  return (
    <>
    <div className="flex gap-6" style={{ alignItems: "flex-start" }}>

      {/* ── Left sidebar: categories ─────────────────────────────── */}
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          maxHeight: "100vh",
          overflowY: "auto",
          paddingBottom: 24,
        }}
      >
        {/* Categories */}
        <div className="mb-4">
          <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Categories
          </h2>

          {/* All items */}
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-left mb-0.5 ${!selectedCategory ? "bg-white" : "hover:bg-black/[0.04]"}`}
            style={{
              boxShadow: !selectedCategory ? "0 1px 4px rgba(26,26,26,0.06)" : "none",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 13,
              fontWeight: !selectedCategory ? 600 : 400,
              color: !selectedCategory ? "#1A1A1A" : "#9A9590",
              border: "none", cursor: "pointer",
            }}
          >
            <span>All items</span>
            <span style={{ fontSize: 11, color: "#C0BEBB" }}>{specs.length}</span>
          </button>

          {/* Category tree */}
          {topLevelCats.map((cat) => {
            const Icon = cat.icon ? (iconMap[cat.icon] ?? Layers) : Layers;
            const children = childCats(cat.id);
            const isActive = selectedCategory === cat.id;
            const isExpanded = expandedCats.has(cat.id);
            const childCount = specs.filter((s) =>
              s.category_id === cat.id || children.some((c) => c.id === s.category_id)
            ).length;

            return (
              <div key={cat.id}>
                {/* Parent row */}
                <div className="flex items-center gap-1 mb-0.5">
                  <button
                    type="button"
                    onClick={() => selectCategory(cat.id)}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${isActive ? "bg-white" : "hover:bg-black/[0.04]"}`}
                    style={{
                      boxShadow: isActive ? "0 1px 4px rgba(26,26,26,0.06)" : "none",
                      fontFamily: "var(--font-inter), sans-serif", fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#1A1A1A" : "#9A9590",
                      border: "none", cursor: "pointer",
                      minWidth: 0,
                    }}
                  >
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span className="flex-1 truncate text-left">{cat.name}</span>
                    {childCount > 0 && (
                      <span style={{ fontSize: 11, color: "#C0BEBB", flexShrink: 0 }}>{childCount}</span>
                    )}
                  </button>

                  {/* Chevron to expand/collapse children */}
                  {children.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(cat.id, e)}
                      title={isExpanded ? "Collapse" : "Expand"}
                      style={{
                        flexShrink: 0,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 3px",
                        color: "#C0BEBB",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <ChevronRight
                        size={12}
                        style={{
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.18s ease",
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Sub-categories — only when expanded */}
                {isExpanded && children.length > 0 && (
                  <div className="ml-4 mb-1">
                    {children.map((child) => {
                      const isChildActive = selectedCategory === child.id;
                      const count = specs.filter((s) => s.category_id === child.id).length;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedCategory(isChildActive ? null : child.id)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors text-left ${isChildActive ? "bg-white/70" : "hover:bg-black/[0.04]"}`}
                          style={{
                            fontFamily: "var(--font-inter), sans-serif", fontSize: 12,
                            fontWeight: isChildActive ? 600 : 400,
                            color: isChildActive ? "#1A1A1A" : "#9A9590",
                            border: "none", cursor: "pointer",
                          }}
                        >
                          <span className="truncate">{child.name}</span>
                          {count > 0 && <span style={{ fontSize: 10, color: "#C0BEBB" }}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="mt-4">
            <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className="flex items-center gap-1 px-2 py-1 transition-all"
                  style={{
                    borderRadius: 6,
                    fontFamily: "var(--font-inter), sans-serif", fontSize: 11,
                    border: "none", cursor: "pointer",
                    backgroundColor: selectedTag === tag ? "#1A1A1A" : "#F0EEEB",
                    color: selectedTag === tag ? "#FFFFFF" : "#9A9590",
                  }}
                >
                  <Tag size={9} />{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suppliers filter */}
        {allSuppliers.length > 0 && (
          <div className="mt-4">
            <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Suppliers
            </h2>
            {allSuppliers.map((sup) => (
              <button
                key={sup.id}
                type="button"
                onClick={() => setSelectedSupplier(selectedSupplier === sup.name ? null : sup.name)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-left mb-0.5 ${selectedSupplier === sup.name ? "bg-white" : "hover:bg-black/[0.04]"}`}
                style={{
                  boxShadow: selectedSupplier === sup.name ? "0 1px 4px rgba(26,26,26,0.06)" : "none",
                  fontFamily: "var(--font-inter), sans-serif", fontSize: 12,
                  fontWeight: selectedSupplier === sup.name ? 600 : 400,
                  color: selectedSupplier === sup.name ? "#1A1A1A" : "#9A9590",
                  border: "none", cursor: "pointer",
                }}
              >
                <span className="truncate">{sup.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* ── Sticky header ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "#EDEDED",
            // Bleed into AppShell padding so background covers edge-to-edge
            marginLeft: -28,
            marginRight: -28,
            paddingLeft: 28,
            paddingRight: 28,
            marginTop: -28,
            paddingTop: 28,
            paddingBottom: 14,
          }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* Breadcrumb when category is selected */}
              {selectedCat ? (
                <>
                  <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", marginBottom: 3 }}>
                    <span>Spec Library</span>
                    {selectedCatParent && (
                      <>
                        <span>·</span>
                        <span>{selectedCatParent.name}</span>
                      </>
                    )}
                  </div>
                  <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    {selectedCat.name}
                  </h1>
                </>
              ) : (
                <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                  Spec Library
                </h1>
              )}
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 2 }}>
                {filtered.length} {filtered.length === 1 ? "item" : "items"}
                {selectedTag && <span> · tagged &ldquo;{selectedTag}&rdquo;</span>}
              </p>
            </div>
            <Link
              href="/specs/new"
              className="flex items-center gap-2 px-4 py-2.5 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFDE28", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}
            >
              <Plus size={15} />
              Add to library
            </Link>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1" style={{ maxWidth: 340 }}>
              <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#C0BEBB", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search by name, tag, supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: 36, paddingLeft: 30, paddingRight: 12, border: "1px solid #E4E1DC", borderRadius: 8, backgroundColor: "#FFFFFF", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", outline: "none", width: "100%" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedCategory(null); setSelectedSupplier(null); setSelectedTag(null); }}
                style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", background: "none", border: "none", cursor: "pointer" }}
                className="hover:text-[#1A1A1A] transition-colors"
              >
                Clear filters
              </button>
            )}

            <div className="flex-1" />

            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-1 bg-white rounded-lg" style={{ boxShadow: "0 1px 4px rgba(26,26,26,0.06)" }}>
              {([["grid", LayoutGrid], ["list", LayoutList]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleView(mode)}
                  style={{ width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "none", cursor: "pointer", backgroundColor: view === mode ? "#F0EEEB" : "transparent", color: view === mode ? "#1A1A1A" : "#C0BEBB", transition: "all 0.15s ease" }}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Grid / List ── */}
        <div style={{ paddingTop: 8 }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-24" style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}>
              <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB" }}>
                <Layers size={20} style={{ color: "#C0BEBB" }} />
              </div>
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 17, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
                {search || activeFilterCount > 0 ? "No items match" : "Library is empty"}
              </p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 20 }}>
                {search || activeFilterCount > 0
                  ? "Try adjusting your search or filters."
                  : "Add your first spec to start building the studio library."}
              </p>
              {!search && !activeFilterCount && (
                <Link href="/specs/new" className="flex items-center gap-2 px-4 py-2 transition-opacity hover:opacity-80" style={{ backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}>
                  <Plus size={14} /> Add to library
                </Link>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filtered.map((spec) => <SpecCard key={spec.id} spec={spec} onOpen={setOpenSpecId} categories={categories} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((spec) => <SpecRowItem key={spec.id} spec={spec} onOpen={setOpenSpecId} categories={categories} />)}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Spec detail modal */}
    <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />
    </>
  );
}

// ── SpecCard (grid) ────────────────────────────────────────────────────────────

function SpecCard({ spec, onOpen, categories }: { spec: EnrichedSpec; onOpen: (id: string) => void; categories: SpecCategoryRow[] }) {
  const catLabel = getCategoryLabel(spec.category_id, categories);
  return (
    <button
      type="button"
      onClick={() => onOpen(spec.id)}
      className="text-left w-full"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div className="bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-md" style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}>
        {/* Square image area */}
        <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#F0EEEB", backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
            {!spec.image_url && <Layers size={20} style={{ color: "#D4D2CF" }} />}
          </div>
        </div>
        {/* Text */}
        <div className="p-2.5 flex flex-col gap-1">
          {catLabel && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {catLabel}
            </p>
          )}
          <p className="font-semibold" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {spec.name}
          </p>
          {(spec.cost_from || spec.cost_to) && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}>
              {spec.cost_from && spec.cost_to ? `£${spec.cost_from} – £${spec.cost_to}` : spec.cost_from ? `from £${spec.cost_from}` : `up to £${spec.cost_to}`}
              {spec.cost_unit && ` ${spec.cost_unit}`}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── SpecRowItem (list) — renamed to avoid clash with HTML SpecRow ─────────────

function SpecRowItem({ spec, onOpen, categories }: { spec: EnrichedSpec; onOpen: (id: string) => void; categories: SpecCategoryRow[] }) {
  const catLabel = getCategoryLabel(spec.category_id, categories);
  return (
    <button
      type="button"
      onClick={() => onOpen(spec.id)}
      className="w-full text-left"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div className="flex items-center gap-4 px-4 py-3 bg-white transition-shadow hover:shadow-md" style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
        <div className="flex-shrink-0 rounded-lg flex items-center justify-center" style={{ width: 44, height: 44, backgroundColor: "#F0EEEB", backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          {!spec.image_url && <Layers size={16} style={{ color: "#D4D2CF" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}>
            {spec.name}
          </p>
          {catLabel && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
              {catLabel}
            </p>
          )}
        </div>
        <div className="hidden sm:flex flex-wrap gap-1">
          {spec.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5" style={{ backgroundColor: "#F0EEEB", borderRadius: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
              {tag}
            </span>
          ))}
        </div>
        {spec.supplierNames.length > 0 && (
          <span className="hidden md:block flex-shrink-0" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", whiteSpace: "nowrap" }}>
            {spec.supplierNames[0]}
          </span>
        )}
        {(spec.cost_from || spec.cost_to) && (
          <span className="flex-shrink-0" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", whiteSpace: "nowrap" }}>
            {spec.cost_from && spec.cost_to ? `£${spec.cost_from}–£${spec.cost_to}` : spec.cost_from ? `from £${spec.cost_from}` : `to £${spec.cost_to}`}
          </span>
        )}
        <ChevronRight size={14} style={{ color: "#C0BEBB", flexShrink: 0 }} />
      </div>
    </button>
  );
}
