"use client";

import { useState, useMemo } from "react";
import {
  Search, Plus, ChevronRight, Tag, BookUser,
  Users, Package, Hammer, Briefcase, Building, Palette, Camera, Zap, Layers,
  Mail, Phone, Globe, MapPin,
} from "lucide-react";
import type { ContactCategoryRow } from "@/types/database";
import { createContactCompany } from "./actions";
import ContactDetailPanel from "./ContactDetailPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedCompany {
  id: string;
  name: string;
  category_id: string | null;
  categoryName: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  peopleCount: number;
  created_at: string;
}

interface Props {
  companies: EnrichedCompany[];
  categories: ContactCategoryRow[];
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  users: Users, package: Package, hammer: Hammer,
  briefcase: Briefcase, building: Building, palette: Palette,
  camera: Camera, zap: Zap, layers: Layers,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactsClient({ companies, categories }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [companies]);

  const filtered = useMemo(() => {
    let result = companies;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.city ?? "").toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedCategoryId) {
      const childIds = new Set(childrenOf(selectedCategoryId).map((c) => c.id));
      result = result.filter(
        (c) => c.category_id === selectedCategoryId || (c.category_id && childIds.has(c.category_id))
      );
    }
    if (selectedTag) {
      result = result.filter((c) => c.tags.includes(selectedTag));
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, search, selectedCategoryId, selectedTag]);

  const countForCategory = (catId: string) => {
    const childIds = new Set(childrenOf(catId).map((c) => c.id));
    return companies.filter(
      (c) => c.category_id === catId || (c.category_id && childIds.has(c.category_id))
    ).length;
  };

  return (
    <>
      <div className="flex gap-6" style={{ alignItems: "flex-start" }}>

        {/* ── Left sidebar ── */}
        <aside style={{ width: 200, flexShrink: 0, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto", paddingBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Categories
          </h2>

          {/* All */}
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-left mb-0.5 ${!selectedCategoryId ? "bg-white" : "hover:bg-black/[0.04]"}`}
            style={{ boxShadow: !selectedCategoryId ? "0 1px 4px rgba(26,26,26,0.06)" : "none", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: !selectedCategoryId ? 600 : 400, color: !selectedCategoryId ? "#1A1A1A" : "#9A9590", border: "none", cursor: "pointer" }}
          >
            <span>All contacts</span>
            <span style={{ fontSize: 11, color: "#C0BEBB" }}>{companies.length}</span>
          </button>

          {/* Tree */}
          {topLevel.map((cat) => {
            const Icon = cat.icon ? (iconMap[cat.icon] ?? BookUser) : BookUser;
            const children = childrenOf(cat.id);
            const isActive = selectedCategoryId === cat.id;
            const isExpanded = expandedCats.has(cat.id);
            const count = countForCategory(cat.id);

            return (
              <div key={cat.id}>
                <div className="flex items-center gap-1 mb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(isActive ? null : cat.id)}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${isActive ? "bg-white" : "hover:bg-black/[0.04]"}`}
                    style={{ boxShadow: isActive ? "0 1px 4px rgba(26,26,26,0.06)" : "none", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "#1A1A1A" : "#9A9590", border: "none", cursor: "pointer", minWidth: 0 }}
                  >
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span className="flex-1 truncate">{cat.name}</span>
                    {count > 0 && <span style={{ fontSize: 11, color: "#C0BEBB", flexShrink: 0 }}>{count}</span>}
                  </button>
                  {children.length > 0 && (
                    <button type="button" onClick={(e) => toggleExpand(cat.id, e)} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "4px 3px", color: "#C0BEBB", display: "flex", alignItems: "center" }}>
                      <ChevronRight size={12} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }} />
                    </button>
                  )}
                </div>

                {isExpanded && children.length > 0 && (
                  <div className="ml-4 mb-1">
                    {children.map((child) => {
                      const isChildActive = selectedCategoryId === child.id;
                      const count = companies.filter((c) => c.category_id === child.id).length;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(isChildActive ? null : child.id)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors text-left ${isChildActive ? "bg-white/70" : "hover:bg-black/[0.04]"}`}
                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: isChildActive ? 600 : 400, color: isChildActive ? "#1A1A1A" : "#9A9590", border: "none", cursor: "pointer" }}
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

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="mt-5">
              <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className="flex items-center gap-1 px-2 py-1 transition-all"
                    style={{ borderRadius: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, border: "none", cursor: "pointer", backgroundColor: selectedTag === tag ? "#1A1A1A" : "#F0EEEB", color: selectedTag === tag ? "#FFFFFF" : "#9A9590" }}
                  >
                    <Tag size={9} />{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 min-w-0">
          {/* Sticky header */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#EDEDED", marginLeft: -28, marginRight: -28, paddingLeft: 28, paddingRight: 28, marginTop: -28, paddingTop: 28, paddingBottom: 14 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em" }}>Contacts</h1>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 2 }}>
                  {filtered.length} {filtered.length === 1 ? "company" : "companies"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#FFDE28", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
              >
                <Plus size={15} /> Add contact
              </button>
            </div>

            <div className="relative" style={{ maxWidth: 340 }}>
              <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#C0BEBB", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search by name, email, tag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: 36, paddingLeft: 30, paddingRight: 12, border: "1px solid #E4E1DC", borderRadius: 8, backgroundColor: "#FFFFFF", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", outline: "none", width: "100%" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ paddingTop: 8 }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24" style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}>
                <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB" }}>
                  <BookUser size={20} style={{ color: "#C0BEBB" }} />
                </div>
                <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 17, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
                  {search || selectedCategoryId || selectedTag ? "No contacts match" : "No contacts yet"}
                </p>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 20 }}>
                  {search || selectedCategoryId || selectedTag
                    ? "Try adjusting your search or filters."
                    : "Add your first company to start building the studio directory."}
                </p>
                {!search && !selectedCategoryId && !selectedTag && (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
                  >
                    <Plus size={14} /> Add contact
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filtered.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    isSelected={selectedCompanyId === company.id}
                    onSelect={() => setSelectedCompanyId(selectedCompanyId === company.id ? null : company.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <ContactDetailPanel
        companyId={selectedCompanyId}
        categories={categories}
        onClose={() => setSelectedCompanyId(null)}
        onDeleted={() => setSelectedCompanyId(null)}
      />

      {/* Add company modal */}
      {addOpen && (
        <AddCompanyModal
          categories={categories}
          defaultCategoryId={selectedCategoryId}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => { setAddOpen(false); setSelectedCompanyId(id); }}
        />
      )}
    </>
  );
}

// ── Company row ───────────────────────────────────────────────────────────────

function CompanyRow({ company, isSelected, onSelect }: { company: EnrichedCompany; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left transition-shadow hover:shadow-md"
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
        backgroundColor: isSelected ? "#FFFFFF" : "#FFFFFF",
        borderRadius: 12, border: "none", cursor: "pointer",
        boxShadow: isSelected ? "0 2px 12px rgba(26,26,26,0.1)" : "0 1px 6px rgba(26,26,26,0.06)",
        outline: isSelected ? "2px solid #FFDE28" : "none",
        outlineOffset: -2,
      }}
    >
      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#F0EEEB", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 700, color: "#9A9590" }}>
          {company.name[0]?.toUpperCase() ?? "?"}
        </span>
      </div>

      {/* Name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>
          {company.name}
        </p>
        <div className="flex items-center gap-3" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
          {company.categoryName && <span>{company.categoryName}</span>}
          {company.city && (
            <span className="flex items-center gap-1">
              <MapPin size={9} />{company.city}{company.country ? `, ${company.country}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      {company.tags.length > 0 && (
        <div className="hidden md:flex flex-wrap gap-1">
          {company.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{ backgroundColor: "#F0EEEB", borderRadius: 6, padding: "2px 8px", fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Contact icons */}
      <div className="hidden sm:flex items-center gap-2" style={{ color: "#C0BEBB", flexShrink: 0 }}>
        {company.email && <Mail size={13} />}
        {company.phone && <Phone size={13} />}
        {company.website && <Globe size={13} />}
        {company.peopleCount > 0 && (
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11 }}>
            {company.peopleCount} {company.peopleCount === 1 ? "person" : "people"}
          </span>
        )}
      </div>

      <ChevronRight size={14} style={{ color: "#C0BEBB", flexShrink: 0 }} />
    </button>
  );
}

// ── Add company modal ─────────────────────────────────────────────────────────

function AddCompanyModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: {
  categories: ContactCategoryRow[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createContactCompany(fd);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    if (result.id) onCreated(result.id);
  }

  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 38, paddingLeft: 12, paddingRight: 12,
    fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A",
    backgroundColor: "#FAFAF9", border: "1.5px solid #E4E1DC", borderRadius: 9,
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600,
    color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 5,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(26,26,26,0.4)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 51, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#FFFFFF", borderRadius: 18, boxShadow: "0 24px 80px rgba(26,26,26,0.22)", pointerEvents: "auto", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F0EEEB" }}>
            <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>Add contact</p>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Company name *</label>
              <input name="name" required autoFocus style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select name="category_id" defaultValue={defaultCategoryId ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Select —</option>
                {topLevel.map((cat) => {
                  const children = childrenOf(cat.id);
                  return children.length > 0 ? (
                    <optgroup key={cat.id} label={cat.name}>
                      <option value={cat.id}>{cat.name} (general)</option>
                      {children.map((child) => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Email</label>
                <input name="email" type="email" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input name="phone" type="tel" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Website</label>
              <input name="website" type="url" placeholder="https://" style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>City</label>
                <input name="city" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input name="country" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
              </div>
            </div>

            {error && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#EF4444" }}>{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 9, backgroundColor: "#F0EEEB", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#6B7280" }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ flex: 2, height: 40, borderRadius: 9, backgroundColor: "#FFDE28", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
                {saving ? "Creating…" : "Create contact"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
