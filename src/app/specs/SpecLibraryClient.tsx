"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, LayoutGrid, LayoutList, Plus, ChevronRight, ExternalLink,
  Layers, Lightbulb, Scissors, Grid3x3, Hammer, Paintbrush,
  Droplets, Key, Armchair, Square, Store,
} from "lucide-react";
import type { LibraryCategoryRow } from "@/types/database";
import { getCategoryLabel } from "@/lib/categories";
import SpecDetailModal from "./SpecDetailModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedSpec {
  id: string;
  name: string;
  code: string | null;
  variant_group_id: string | null;
  variantCount: number; // how many specs share this variant_group_id (including self)
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  categoryName: string | null;
  template_id: string;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  tags: string[];
  suppliers: { id: string; name: string; website: string | null }[];
  created_at: string;
}

interface SpecLibraryClientProps {
  specs: EnrichedSpec[];
  categories: LibraryCategoryRow[];
  allSuppliers: { id: string; name: string; website: string | null }[];
}

type ViewMode = "grid" | "list" | "grouped";

const iconMap: Record<string, React.ElementType> = {
  layers: Layers, lightbulb: Lightbulb, scissors: Scissors,
  grid: Grid3x3, hammer: Hammer, paintbrush: Paintbrush,
  droplets: Droplets, key: Key, armchair: Armchair, square: Square,
};

const PREFS_KEY = "spec_library_prefs";

// ── Component ─────────────────────────────────────────────────────────────────

// Supplier type used in drill-down
type DrillSupplier = { id: string; name: string; website: string | null };
type DrillCategory = { id: string; name: string };

export default function SpecLibraryClient({ specs, categories, allSuppliers }: SpecLibraryClientProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [openSpecId, setOpenSpecId] = useState<string | null>(null);
  // All top-level cats collapsed by default
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  // Supplier view drill-down
  const [drillSupplier, setDrillSupplier] = useState<DrillSupplier | null>(null);
  const [drillCategory, setDrillCategory] = useState<DrillCategory | null>(null);

  const searchParams = useSearchParams();

  // Helper: apply a { q, cat } filter pair to component state
  function applyIdaFilters(q: string | null, cat: string | null) {
    setSearch(q ?? "");
    setSelectedCategory(null);
    if (cat) {
      const catLower = cat.toLowerCase();
      const match =
        categories.find((c) => c.name.toLowerCase() === catLower) ??
        categories.find((c) => c.name.toLowerCase().includes(catLower));
      if (match) {
        setSelectedCategory(match.id);
        setExpandedCats((prev) => new Set([...prev, match.id, ...(match.parent_id ? [match.parent_id] : [])]));
      }
    }
  }

  // On mount: apply filters from URL params (when navigating from another page)
  useEffect(() => {
    const q = searchParams.get("q");
    const cat = searchParams.get("cat");
    if (q || cat) applyIdaFilters(q, cat);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When already on the specs page: listen for Ida's custom event
  useEffect(() => {
    function onIdaFilter(e: Event) {
      const { q, cat } = (e as CustomEvent<{ q: string | null; cat: string | null }>).detail;
      applyIdaFilters(q, cat);
    }
    window.addEventListener("ida:filter-specs", onIdaFilter);
    return () => window.removeEventListener("ida:filter-specs", onIdaFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Load view pref from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) { const p = JSON.parse(raw); if (p.view) setView(p.view); }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filtered = useMemo(() => {
    let result = specs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          s.suppliers.some((sup) => sup.name.toLowerCase().includes(q))
      );
    }
    if (selectedCategory) {
      const childIds = new Set(childCats(selectedCategory).map((c) => c.id));
      result = result.filter(
        (s) => s.category_id === selectedCategory || (s.category_id && childIds.has(s.category_id))
      );
    }
    if (selectedSupplier) {
      result = result.filter((s) => s.suppliers.some((sup) => sup.name === selectedSupplier));
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs, search, selectedCategory, selectedSupplier]);

  function toggleView(v: ViewMode) {
    setView(v);
    if (v !== "grouped") { setDrillSupplier(null); setDrillCategory(null); }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ view: v })); } catch { /* ignore */ }
  }

  const activeFilterCount = [selectedCategory, selectedSupplier].filter(Boolean).length;

  // Breadcrumb for the selected category filter
  const selectedCat = selectedCategory ? categories.find((c) => c.id === selectedCategory) : null;
  const selectedCatParent = selectedCat?.parent_id ? categories.find((c) => c.id === selectedCat.parent_id) : null;

  // In supplier view, hide the sidebar entirely
  const showSidebar = view !== "grouped";

  return (
    <>
    <div className="flex gap-6" style={{ alignItems: "flex-start" }}>

      {/* ── Left sidebar: categories — hidden in supplier view ────── */}
      {showSidebar && <aside
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
      </aside>}

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* ── Sticky header ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "#EDEDED",
            paddingBottom: 14,
            paddingTop: 4,
          }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* Breadcrumb — supplier drill-down takes priority */}
              {view === "grouped" && drillSupplier ? (
                <>
                  <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", marginBottom: 3 }}>
                    <button
                      type="button"
                      onClick={() => { setDrillSupplier(null); setDrillCategory(null); }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", fontSize: 11 }}
                      className="hover:text-[#9A9590] transition-colors"
                    >
                      Suppliers
                    </button>
                    {drillCategory && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => setDrillCategory(null)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", fontSize: 11 }}
                          className="hover:text-[#9A9590] transition-colors"
                        >
                          {drillSupplier.name}
                        </button>
                      </>
                    )}
                  </div>
                  <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    {drillCategory ? drillCategory.name : drillSupplier.name}
                  </h1>
                </>
              ) : selectedCat ? (
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
                  {view === "grouped" ? "Suppliers" : "Spec Library"}
                </h1>
              )}
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 2 }}>
                {filtered.length} {filtered.length === 1 ? "item" : "items"}
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
                onClick={() => { setSelectedCategory(null); setSelectedSupplier(null); }}
                style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", background: "none", border: "none", cursor: "pointer" }}
                className="hover:text-[#1A1A1A] transition-colors"
              >
                Clear filters
              </button>
            )}

            <div className="flex-1" />

            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-1 bg-white rounded-lg" style={{ boxShadow: "0 1px 4px rgba(26,26,26,0.06)" }}>
              {([["grid", LayoutGrid], ["list", LayoutList], ["grouped", Store]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  title={mode === "grouped" ? "Group by supplier" : mode === "grid" ? "Grid view" : "List view"}
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
          ) : view === "list" ? (
            <div className="space-y-2">
              {filtered.map((spec) => <SpecRowItem key={spec.id} spec={spec} onOpen={setOpenSpecId} categories={categories} />)}
            </div>
          ) : !drillSupplier ? (
            /* ── Supplier cards ── */
            <SupplierCardsView specs={filtered} onSelectSupplier={setDrillSupplier} />
          ) : !drillCategory ? (
            /* ── Categories for this supplier ── */
            <SupplierCategoryView
              specs={filtered.filter((s) => s.suppliers.some((sup) => sup.id === drillSupplier.id))}
              categories={categories}
              supplier={drillSupplier}
              onSelectCategory={setDrillCategory}
              onOpenSpec={setOpenSpecId}
            />
          ) : (
            /* ── Specs for this supplier + category ── */
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filtered
                .filter((s) => {
                  if (!s.suppliers.some((sup) => sup.id === drillSupplier.id)) return false;
                  if (drillCategory.id === "__uncategorised__") return !s.category_id;
                  return s.category_id === drillCategory.id;
                })
                .map((spec) => <SpecCard key={spec.id} spec={spec} onOpen={setOpenSpecId} categories={categories} />)}
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

function SpecCard({ spec, onOpen, categories }: { spec: EnrichedSpec; onOpen: (id: string) => void; categories: LibraryCategoryRow[] }) {
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
          {spec.code && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", letterSpacing: "0.02em" }}>
              {spec.code}
            </p>
          )}
          {(spec.cost_from || spec.cost_to) && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}>
              {spec.cost_from && spec.cost_to ? `£${spec.cost_from} – £${spec.cost_to}` : spec.cost_from ? `from £${spec.cost_from}` : `up to £${spec.cost_to}`}
              {spec.cost_unit && ` ${spec.cost_unit}`}
            </p>
          )}
          {spec.variantCount > 1 && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, color: "#7C3AED", fontWeight: 600 }}>
              {spec.variantCount} colorways
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Supplier logo helper ──────────────────────────────────────────────────────

function getLogoUrl(website: string | null): string | null {
  if (!website) return null;
  try {
    const domain = new URL(
      website.startsWith("http") ? website : `https://${website}`
    ).hostname.replace(/^www\./, "");
    return `https://logo.clearbit.com/${domain}`;
  } catch {
    return null;
  }
}

// ── SupplierCardsView — level 1 ───────────────────────────────────────────────

function SupplierCardsView({
  specs,
  onSelectSupplier,
}: {
  specs: EnrichedSpec[];
  onSelectSupplier: (sup: DrillSupplier) => void;
}) {
  // Build unique supplier entries from specs
  const supplierMap = new Map<string, DrillSupplier & { specCount: number; previewImages: string[] }>();

  for (const spec of specs) {
    for (const sup of spec.suppliers) {
      if (!supplierMap.has(sup.id)) {
        supplierMap.set(sup.id, { id: sup.id, name: sup.name, website: sup.website, specCount: 0, previewImages: [] });
      }
      const entry = supplierMap.get(sup.id)!;
      entry.specCount++;
      if (spec.image_url && entry.previewImages.length < 4) entry.previewImages.push(spec.image_url);
    }
  }

  // Specs with no supplier
  const noSupplierCount = specs.filter((s) => s.suppliers.length === 0).length;

  const suppliers = [...supplierMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (suppliers.length === 0 && noSupplierCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24" style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}>
        <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 17, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>No suppliers yet</p>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>Add specs via Ida and suppliers will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {suppliers.map((sup) => (
        <SupplierCard key={sup.id} supplier={sup} onClick={() => onSelectSupplier(sup)} />
      ))}
    </div>
  );
}

function SupplierCard({
  supplier,
  onClick,
}: {
  supplier: DrillSupplier & { specCount: number; previewImages: string[] };
  onClick: () => void;
}) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getLogoUrl(supplier.website);

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full transition-shadow hover:shadow-md"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div className="bg-white flex flex-col overflow-hidden" style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}>
        {/* Logo / hero area */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ height: 120, backgroundColor: "#F7F6F4" }}
        >
          {logoUrl && !logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={supplier.name}
              onError={() => setLogoError(true)}
              style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 64, height: 64, backgroundColor: "#EDEDED" }}
            >
              <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#9A9590" }}>
                {supplier.name[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {/* Text */}
        <div className="p-3">
          <p className="font-semibold truncate" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}>
            {supplier.name}
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 2 }}>
            {supplier.specCount} {supplier.specCount === 1 ? "item" : "items"}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── SupplierCategoryView — level 2 ────────────────────────────────────────────

function SupplierCategoryView({
  specs,
  categories,
  supplier,
  onSelectCategory,
  onOpenSpec,
}: {
  specs: EnrichedSpec[];
  categories: LibraryCategoryRow[];
  supplier: DrillSupplier;
  onSelectCategory: (cat: DrillCategory) => void;
  onOpenSpec: (id: string) => void;
}) {
  // Group specs by category
  const catMap = new Map<string, { id: string; name: string; specs: EnrichedSpec[] }>();
  const uncategorised: EnrichedSpec[] = [];

  for (const spec of specs) {
    if (!spec.category_id || !spec.categoryName) {
      uncategorised.push(spec);
    } else {
      if (!catMap.has(spec.category_id)) {
        catMap.set(spec.category_id, { id: spec.category_id, name: spec.categoryName, specs: [] });
      }
      catMap.get(spec.category_id)!.specs.push(spec);
    }
  }

  const catGroups = [...catMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // If only one category, skip the category level and show specs directly
  if (catGroups.length === 1 && uncategorised.length === 0) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {catGroups[0].specs.map((spec) => (
          <SpecCard key={spec.id} spec={spec} onOpen={onOpenSpec} categories={categories} />
        ))}
      </div>
    );
  }

  const logoUrl = getLogoUrl(supplier.website);
  const [logoError, setLogoError] = useState(false);

  return (
    <div>
      {/* Supplier header with website button */}
      <div className="flex items-center gap-4 mb-6 pb-4" style={{ borderBottom: "1px solid #E4E1DC" }}>
        {logoUrl && !logoError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={supplier.name}
            onError={() => setLogoError(true)}
            style={{ height: 32, maxWidth: 80, objectFit: "contain", opacity: 0.8 }}
          />
        )}
        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70 ml-auto"
            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E4E1DC", backgroundColor: "#FFFFFF", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#1A1A1A", textDecoration: "none" }}
          >
            Visit website <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {catGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectCategory({ id: group.id, name: group.name })}
            className="text-left transition-shadow hover:shadow-md"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div className="bg-white overflow-hidden" style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}>
              {/* Mini image grid */}
              <div className="grid grid-cols-2 gap-0.5" style={{ backgroundColor: "#F0EEEB", aspectRatio: "2/1" }}>
                {group.specs.slice(0, 4).map((spec, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: "#F0EEEB",
                      backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      aspectRatio: "1/1",
                    }}
                  />
                ))}
              </div>
              <div className="p-3">
                <p className="font-semibold" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}>
                  {group.name}
                </p>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
                  {group.specs.length} {group.specs.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
          </button>
        ))}
        {uncategorised.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectCategory({ id: "__uncategorised__", name: "Uncategorised" })}
            className="text-left transition-shadow hover:shadow-md"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div className="bg-white overflow-hidden" style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}>
              <div className="flex items-center justify-center" style={{ backgroundColor: "#F0EEEB", aspectRatio: "2/1" }}>
                <Layers size={24} style={{ color: "#C0BEBB" }} />
              </div>
              <div className="p-3">
                <p className="font-semibold" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}>Uncategorised</p>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>{uncategorised.length} items</p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

// ── SpecRowItem (list) — local row component for the library list view ───────────────

function SpecRowItem({ spec, onOpen, categories }: { spec: EnrichedSpec; onOpen: (id: string) => void; categories: LibraryCategoryRow[] }) {
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
        {spec.suppliers.length > 0 && (
          <span className="hidden md:block flex-shrink-0" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", whiteSpace: "nowrap" }}>
            {spec.suppliers[0].name}
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
