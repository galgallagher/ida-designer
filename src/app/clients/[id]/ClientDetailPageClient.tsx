"use client";

/**
 * ClientDetailPageClient — client wrapper for the Client Detail page.
 *
 * Manages open/close state for Add Project, Add Contact, Edit Client,
 * and Contact Detail modals. All data is rendered server-side and passed as props/children.
 */

import { useState, useRef, useActionState, useEffect } from "react";
import Link from "next/link";
import { Mail, Phone, UserPlus, Pencil, X, Trash2, Loader2 } from "lucide-react";
import AddProjectModal from "./AddProjectModal";
import AddContactModal from "./AddContactModal";
import EditClientModal from "./EditClientModal";
import { updateContact, deleteContact, type UpdateContactResult } from "./actions";
import type { ContactRow } from "@/types/database";

interface ClientDetailPageClientProps {
  clientId: string;
  clientName: string;
  clientAddress: string | null;
  activeCount: number;
  contacts: ContactRow[];
  children: React.ReactNode; // project grid
}

export default function ClientDetailPageClient({
  clientId,
  clientName,
  clientAddress,
  activeCount,
  contacts,
  children,
}: ClientDetailPageClientProps) {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);

  return (
    <>
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6" style={{ fontSize: 13, fontFamily: "var(--font-inter), sans-serif", color: "#9A9590" }}>
        <Link href="/clients" style={{ color: "#9A9590", textDecoration: "none" }} className="hover:text-[#1A1A1A] transition-colors">
          Clients
        </Link>
        <span>/</span>
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{clientName}</span>
      </div>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {clientName}
            </h1>
            <button
              type="button"
              onClick={() => setIsEditClientOpen(true)}
              title="Edit client"
              className="transition-opacity hover:opacity-60"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4, display: "flex", alignItems: "center" }}
            >
              <Pencil size={14} />
            </button>
          </div>
          {clientAddress && (
            <p style={{ fontSize: 13, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
              {clientAddress}
            </p>
          )}
          <p style={{ fontSize: 13, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", marginTop: 2 }}>
            {activeCount} active {activeCount === 1 ? "project" : "projects"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsProjectModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFDE28", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif" }}
        >
          + New project
        </button>
      </div>

      {/* ── Contacts section ────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Contacts · {contacts.length}
          </h2>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#9A9590", padding: 0 }}
          >
            <UserPlus size={13} />
            Add contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <div
            className="flex items-center justify-center py-6 cursor-pointer"
            style={{ borderRadius: 12, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
            onClick={() => setIsContactModalOpen(true)}
          >
            <p style={{ fontSize: 13, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif" }}>
              No contacts yet — add someone to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <ContactTile
                key={contact.id}
                contact={contact}
                onClick={() => setSelectedContact(contact)}
              />
            ))}
            {/* Add contact tile */}
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="flex flex-col items-center justify-center gap-1 transition-opacity hover:opacity-70"
              style={{
                width: 100,
                height: 88,
                borderRadius: 12,
                border: "1.5px dashed #E4E1DC",
                backgroundColor: "transparent",
                cursor: "pointer",
                color: "#C0BEBB",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              <UserPlus size={16} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>Add</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Projects section ────────────────────────────────────── */}
      <div>
        <h2 className="mb-3" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Projects
        </h2>
        {children}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <AddProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} clientId={clientId} />
      <AddContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} clientId={clientId} />
      <EditClientModal isOpen={isEditClientOpen} onClose={() => setIsEditClientOpen(false)} clientId={clientId} currentName={clientName} currentAddress={clientAddress} />
      <ContactDetailModal contact={selectedContact} clientId={clientId} onClose={() => setSelectedContact(null)} />
    </>
  );
}

// ── ContactTile ────────────────────────────────────────────────────────────────

function ContactTile({ contact, onClick }: { contact: ContactRow; onClick: () => void }) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 bg-white transition-shadow hover:shadow-md"
      style={{
        width: 100,
        height: 88,
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        padding: "12px 8px",
        boxShadow: "0 1px 6px rgba(26,26,26,0.06)",
        textAlign: "center",
      }}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-semibold"
        style={{ width: 32, height: 32, backgroundColor: "#F0EEEB", color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif" }}
      >
        {initials}
      </div>
      {/* Name */}
      <div style={{ width: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fullName}
        </p>
        {contact.role && (
          <p style={{ fontSize: 10, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contact.role}
          </p>
        )}
      </div>
    </button>
  );
}

// ── ContactDetailModal ────────────────────────────────────────────────────────

function ContactDetailModal({
  contact,
  clientId,
  onClose,
}: {
  contact: ContactRow | null;
  clientId: string;
  onClose: () => void;
}) {
  const isOpen = contact !== null;
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const fullName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
  const initials = contact
    ? [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase()
    : "";

  // Reset to view mode when contact changes or modal closes
  useEffect(() => {
    if (!isOpen) setTimeout(() => setMode("view"), 300);
  }, [isOpen]);

  const [editState, editAction, isEditPending] = useActionState(
    async (_prev: UpdateContactResult | null, formData: FormData) => {
      if (!contact) return { error: "No contact selected." };
      const result = await updateContact(contact.id, clientId, formData);
      if ("success" in result && result.success) {
        setMode("view");
      }
      return result;
    },
    null
  );

  async function handleDelete() {
    if (!contact) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteContact(contact.id, clientId);
    setIsDeleting(false);
    if ("error" in result) {
      setDeleteError(result.error);
    } else {
      onClose();
    }
  }

  const editError = editState && "error" in editState ? editState.error : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", width: 480,
          maxHeight: "90vh", backgroundColor: "#FFFFFF",
          zIndex: 50,
          display: "flex", flexDirection: "column",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: "24px 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0 font-semibold"
              style={{ width: 44, height: 44, backgroundColor: "#F0EEEB", color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif", fontSize: 15 }}
            >
              {initials}
            </div>
            <div>
              <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, margin: 0 }}>
                {fullName}
              </h2>
              {contact?.role && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 1 }}>
                  {contact.role}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {mode === "view" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  title="Edit contact"
                  className="hover:bg-[#F0EEEB] transition-colors"
                  style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9A9590" }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMode("confirm-delete")}
                  title="Delete contact"
                  className="hover:bg-[#FEF2F2] transition-colors"
                  style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#C0BEBB" }}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={mode === "view" ? onClose : () => setMode("view")}
              className="hover:bg-[#F0EEEB] transition-colors"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9A9590", marginLeft: 4 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: "#F0EEEB", flexShrink: 0 }} />

        {/* ── View mode ── */}
        {mode === "view" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {contact?.email && (
                <DetailRow icon={<Mail size={15} />} label="Email">
                  <a href={`mailto:${contact.email}`} style={{ color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, textDecoration: "none" }} className="hover:underline">
                    {contact.email}
                  </a>
                </DetailRow>
              )}
              {contact?.phone && (
                <DetailRow icon={<Phone size={15} />} label="Phone">
                  <a href={`tel:${contact.phone}`} style={{ color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, textDecoration: "none" }} className="hover:underline">
                    {contact.phone}
                  </a>
                </DetailRow>
              )}
              {contact?.notes && (
                <div>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notes</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A", lineHeight: 1.6 }}>{contact.notes}</p>
                </div>
              )}
              {contact && !contact.email && !contact.phone && !contact.notes && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB" }}>No additional details for this contact.</p>
              )}
            </div>
            {contact && (contact.email || contact.phone) && (
              <div style={{ padding: 24, borderTop: "1px solid #F0EEEB", display: "flex", gap: 10, flexShrink: 0 }}>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 flex-1 justify-center transition-opacity hover:opacity-80" style={{ height: 44, backgroundColor: "#F0EEEB", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}>
                    <Mail size={15} /> Email
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 flex-1 justify-center transition-opacity hover:opacity-80" style={{ height: 44, backgroundColor: "#F0EEEB", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}>
                    <Phone size={15} /> Call
                  </a>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Edit mode ── */}
        {mode === "edit" && contact && (
          <>
            <form ref={formRef} action={editAction} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {editError && (
                <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
                  {editError}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <CField label="First name" required>
                  <input type="text" name="first_name" defaultValue={contact.first_name} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </CField>
                <CField label="Last name">
                  <input type="text" name="last_name" defaultValue={contact.last_name ?? ""} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </CField>
              </div>
              <CField label="Role / job title">
                <input type="text" name="role" defaultValue={contact.role ?? ""} placeholder="e.g. Project Manager" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </CField>
              <CField label="Email">
                <input type="email" name="email" defaultValue={contact.email ?? ""} placeholder="jane@example.com" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </CField>
              <CField label="Phone">
                <input type="text" name="phone" defaultValue={contact.phone ?? ""} placeholder="+44 7700 000000" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              </CField>
              <CField label="Notes">
                <textarea name="notes" rows={3} defaultValue={contact.notes ?? ""} placeholder="Any notes…" style={{ ...inputStyle, height: "auto", padding: "12px 16px", resize: "vertical", lineHeight: 1.5 }} onFocus={focusHandler} onBlur={blurHandler} />
              </CField>
            </form>
            <div style={{ padding: 24, borderTop: "1px solid #F0EEEB", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <button type="button" onClick={() => setMode("view")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590" }}>
                Cancel
              </button>
              <button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={isEditPending} style={{ height: 44, paddingLeft: 24, paddingRight: 24, backgroundColor: isEditPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 8, cursor: isEditPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", gap: 8 }}>
                {isEditPending && <Loader2 size={15} className="animate-spin" />}
                {isEditPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}

        {/* ── Confirm delete mode ── */}
        {mode === "confirm-delete" && (
          <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A", lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{fullName}</strong>? This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>{deleteError}</p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setMode("view")} style={{ flex: 1, height: 44, backgroundColor: "#F0EEEB", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={isDeleting} style={{ flex: 1, height: 44, backgroundColor: isDeleting ? "#FCA5A5" : "#EF4444", border: "none", borderRadius: 10, cursor: isDeleting ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {isDeleting && <Loader2 size={15} className="animate-spin" />}
                {isDeleting ? "Deleting…" : "Delete contact"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── DetailRow ─────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div style={{ color: "#9A9590", marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

// ── CField ────────────────────────────────────────────────────────────────────

function CField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: "1.2px" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, border: "1px solid #E4E1DC",
  backgroundColor: "#FAFAF9", borderRadius: 6, padding: "0 14px",
  fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A",
  outline: "none", boxSizing: "border-box",
};

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
}
