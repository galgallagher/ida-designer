"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X, Pencil, Trash2, Plus, Mail, Phone, Globe, MapPin,
  User, Tag, Loader2, Check, ChevronDown,
} from "lucide-react";
import type { ContactCategoryRow } from "@/types/database";
import {
  getContactDetail, updateContactCompany, deleteContactCompany,
  updateContactTags, createContactPerson, updateContactPerson, deleteContactPerson,
  type ContactDetailData,
} from "./actions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  companyId: string | null;
  categories: ContactCategoryRow[];
  onClose: () => void;
  onDeleted: () => void;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 10, fontWeight: 600, color: "#9A9590",
  textTransform: "uppercase", letterSpacing: "0.06em",
  display: "block", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36,
  paddingLeft: 10, paddingRight: 10,
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13, color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 8, outline: "none",
  boxSizing: "border-box",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ContactDetailPanel({ companyId, categories, onClose, onDeleted }: Props) {
  const [data, setData] = useState<ContactDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    const d = await getContactDetail(id);
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!companyId) { setData(null); return; }
    fetchData(companyId);
  }, [companyId, fetchData]);

  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  return (
    <Sheet open={!!companyId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        style={{ width: 480, padding: 0, display: "flex", flexDirection: "column" }}
        className="[&>button]:hidden"
      >
        {/* Visually hidden title for accessibility */}
        <SheetHeader className="sr-only">
          <SheetTitle>{loading ? "Loading…" : (data?.company.name ?? "Contact")}</SheetTitle>
        </SheetHeader>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid #F0EEEB", flexShrink: 0 }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
            {loading ? "Loading…" : (data?.company.name ?? "Contact")}
          </p>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#F0EEEB", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9A9590" }}>
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading || !data || !companyId ? (
            <LoadingSkeleton />
          ) : (
            <div style={{ padding: "20px 20px 32px" }}>
              {/* Company details form */}
              <CompanyForm
                data={data}
                categories={categories}
                topLevel={topLevel}
                childrenOf={childrenOf}
                onSaved={() => fetchData(companyId)}
                onDeleted={onDeleted}
              />

              {/* Tags */}
              <TagsSection
                companyId={companyId}
                tags={data.tags}
                allStudioTags={data.allStudioTags}
                onSaved={() => fetchData(companyId)}
              />

              {/* People */}
              <PeopleSection
                companyId={companyId}
                people={data.people}
                onChanged={() => fetchData(companyId)}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ padding: 20 }} className="animate-pulse">
      {[80, 60, 100, 50, 70].map((w, i) => (
        <div key={i} style={{ height: 14, width: `${w}%`, backgroundColor: "#F0EEEB", borderRadius: 4, marginBottom: 16 }} />
      ))}
    </div>
  );
}

// ── Company form ──────────────────────────────────────────────────────────────

function CompanyForm({
  data, categories, topLevel, childrenOf, onSaved, onDeleted,
}: {
  data: ContactDetailData;
  categories: ContactCategoryRow[];
  topLevel: ContactCategoryRow[];
  childrenOf: (pid: string) => ContactCategoryRow[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { company } = data;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateContactCompany(company.id, fd);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved();
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const result = await deleteContactCompany(company.id);
    setDeleting(false);
    if (result.error) { setError(result.error); return; }
    onDeleted();
  }

  return (
    <form onSubmit={handleSave} style={{ marginBottom: 28 }}>
      <SectionTitle icon={<Pencil size={12} />}>Details</SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Name */}
        <div>
          <label style={labelStyle}>Company name *</label>
          <input name="name" defaultValue={company.name} required style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ position: "relative" }}>
            <select name="category_id" defaultValue={company.category_id ?? ""} style={{ ...inputStyle, paddingRight: 32, cursor: "pointer", appearance: "none" }}>
              <option value="">— None —</option>
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
            <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9A9590", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}><Globe size={9} style={{ display: "inline", marginRight: 4 }} />Website</label>
          <input name="website" type="url" defaultValue={company.website ?? ""} placeholder="https://" style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>

        {/* Email + Phone */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}><Mail size={9} style={{ display: "inline", marginRight: 4 }} />Email</label>
            <input name="email" type="email" defaultValue={company.email ?? ""} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
          </div>
          <div>
            <label style={labelStyle}><Phone size={9} style={{ display: "inline", marginRight: 4 }} />Phone</label>
            <input name="phone" type="tel" defaultValue={company.phone ?? ""} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
          </div>
        </div>

        {/* Address */}
        <div>
          <label style={labelStyle}><MapPin size={9} style={{ display: "inline", marginRight: 4 }} />Street address</label>
          <input name="street" defaultValue={company.street ?? ""} style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input name="city" defaultValue={company.city ?? ""} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input name="country" defaultValue={company.country ?? ""} style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            name="notes"
            defaultValue={company.notes ?? ""}
            rows={3}
            style={{ ...inputStyle, height: "auto", paddingTop: 8, paddingBottom: 8, resize: "vertical" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
          />
        </div>

        {error && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#EF4444" }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ height: 38, borderRadius: 9, backgroundColor: "#FFDE28", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Delete */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{
            width: "100%", height: 34, borderRadius: 8,
            backgroundColor: confirmDelete ? "#FEE2E2" : "transparent",
            border: `1.5px solid ${confirmDelete ? "#FCA5A5" : "#E4E1DC"}`,
            cursor: "pointer", fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12, fontWeight: 500,
            color: confirmDelete ? "#EF4444" : "#9A9590",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s ease",
          }}
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {confirmDelete ? "Click again to confirm delete" : "Delete contact"}
        </button>
      </div>
    </form>
  );
}

// ── Tags section ──────────────────────────────────────────────────────────────

function TagsSection({
  companyId, tags, allStudioTags, onSaved,
}: {
  companyId: string; tags: string[]; allStudioTags: string[]; onSaved: () => void;
}) {
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = allStudioTags.filter(
    (t) => !localTags.includes(t) && t.toLowerCase().includes(input.toLowerCase()) && input.length > 0
  );

  async function addTag(tag: string) {
    const clean = tag.trim().toLowerCase();
    if (!clean || localTags.includes(clean)) return;
    const next = [...localTags, clean];
    setLocalTags(next);
    setInput("");
    setSaving(true);
    await updateContactTags(companyId, next);
    setSaving(false);
    onSaved();
  }

  async function removeTag(tag: string) {
    const next = localTags.filter((t) => t !== tag);
    setLocalTags(next);
    setSaving(true);
    await updateContactTags(companyId, next);
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ marginBottom: 28, paddingTop: 20, borderTop: "1px solid #F0EEEB" }}>
      <SectionTitle icon={<Tag size={12} />}>Tags {saving && <Loader2 size={10} className="animate-spin" style={{ display: "inline", marginLeft: 4 }} />}</SectionTitle>

      {/* Pills */}
      {localTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {localTags.map((tag) => (
            <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5, backgroundColor: "#F0EEEB", borderRadius: 20, padding: "3px 10px", fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A" }}>
              {tag}
              <button type="button" onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 0, display: "flex", lineHeight: 1 }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ position: "relative" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }}
          placeholder="Add tag…"
          style={{ ...inputStyle, height: 34, fontSize: 12 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
        />
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#FFFFFF", border: "1px solid #E4E1DC", borderRadius: 8, boxShadow: "0 4px 12px rgba(26,26,26,0.1)", zIndex: 10, marginTop: 2 }}>
            {suggestions.slice(0, 6).map((s) => (
              <button key={s} type="button" onMouseDown={() => addTag(s)} style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A" }}
                className="hover:bg-[#F0EEEB]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 5 }}>Press Enter to add · Tags are shared across specs and contacts</p>
    </div>
  );
}

// ── People section ────────────────────────────────────────────────────────────

function PeopleSection({
  companyId, people, onChanged,
}: {
  companyId: string;
  people: ContactDetailData["people"];
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ paddingTop: 20, borderTop: "1px solid #F0EEEB" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionTitle icon={<User size={12} />}>People</SectionTitle>
        <button type="button" onClick={() => setAddOpen(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          <Plus size={12} /> Add person
        </button>
      </div>

      {people.length === 0 && !addOpen && (
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB", fontStyle: "italic" }}>No people added yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {people.map((person) =>
          editingId === person.id ? (
            <PersonEditForm
              key={person.id}
              person={person}
              onCancel={() => setEditingId(null)}
              onSaved={() => { setEditingId(null); onChanged(); }}
            />
          ) : (
            <PersonRow
              key={person.id}
              person={person}
              onEdit={() => setEditingId(person.id)}
              onDeleted={onChanged}
            />
          )
        )}

        {addOpen && (
          <AddPersonForm
            companyId={companyId}
            onCancel={() => setAddOpen(false)}
            onAdded={() => { setAddOpen(false); onChanged(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Person row ────────────────────────────────────────────────────────────────

function PersonRow({
  person, onEdit, onDeleted,
}: {
  person: ContactDetailData["people"][number];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteContactPerson(person.id);
    onDeleted();
  }

  return (
    <div style={{ padding: "10px 14px", backgroundColor: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EEEB" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{person.name}</p>
          {person.role && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>{person.role}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
            {person.email && <a href={`mailto:${person.email}`} style={{ color: "#9A9590", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }} className="hover:underline"><Mail size={10} />{person.email}</a>}
            {person.phone && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Phone size={10} />{person.phone}</span>}
          </div>
          {person.notes && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#B0AEA9", marginTop: 6 }}>{person.notes}</p>}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={onEdit} style={{ padding: "4px 8px", background: "none", border: "1px solid #E4E1DC", borderRadius: 6, cursor: "pointer", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 11 }}>
            Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: "4px 6px", background: "none", border: "1px solid #FCA5A5", borderRadius: 6, cursor: "pointer", color: "#EF4444" }}>
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add/edit person forms ─────────────────────────────────────────────────────

function AddPersonForm({ companyId, onCancel, onAdded }: { companyId: string; onCancel: () => void; onAdded: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("company_id", companyId);
    const result = await createContactPerson(fd);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onAdded();
  }

  return <PersonForm onSubmit={handleSubmit} onCancel={onCancel} saving={saving} error={error} label="Add person" />;
}

function PersonEditForm({ person, onCancel, onSaved }: { person: ContactDetailData["people"][number]; onCancel: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateContactPerson(person.id, fd);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved();
  }

  return <PersonForm defaultValues={person} onSubmit={handleSubmit} onCancel={onCancel} saving={saving} error={error} label="Save" />;
}

function PersonForm({
  defaultValues, onSubmit, onCancel, saving, error, label,
}: {
  defaultValues?: { name: string; role: string | null; email: string | null; phone: string | null; notes: string | null };
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  label: string;
}) {
  return (
    <form onSubmit={onSubmit} style={{ padding: "12px 14px", backgroundColor: "#F8F7F5", borderRadius: 10, border: "1.5px solid #FFDE28", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 3 }}>Name *</label>
          <input name="name" required defaultValue={defaultValues?.name ?? ""} autoFocus style={{ ...inputStyle, height: 32, fontSize: 12 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 3 }}>Role</label>
          <input name="role" defaultValue={defaultValues?.role ?? ""} style={{ ...inputStyle, height: 32, fontSize: 12 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 3 }}>Email</label>
          <input name="email" type="email" defaultValue={defaultValues?.email ?? ""} style={{ ...inputStyle, height: 32, fontSize: 12 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 3 }}>Phone</label>
          <input name="phone" type="tel" defaultValue={defaultValues?.phone ?? ""} style={{ ...inputStyle, height: 32, fontSize: 12 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
        </div>
      </div>
      <div>
        <label style={{ ...labelStyle, marginBottom: 3 }}>Notes</label>
        <input name="notes" defaultValue={defaultValues?.notes ?? ""} style={{ ...inputStyle, height: 32, fontSize: 12 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")} />
      </div>
      {error && <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#EF4444" }}>{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: 32, borderRadius: 7, backgroundColor: "#F0EEEB", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#6B7280" }}>Cancel</button>
        <button type="submit" disabled={saving} style={{ flex: 2, height: 32, borderRadius: 7, backgroundColor: "#FFDE28", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {label}
        </button>
      </div>
    </form>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
      <span style={{ color: "#9A9590" }}>{icon}</span>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</p>
    </div>
  );
}
