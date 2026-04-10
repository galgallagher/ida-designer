"use client";

/**
 * AddClientModal — slide-in panel for creating a new client.
 *
 * Supports adding contacts inline — they're serialised to a hidden JSON field
 * before submit and created server-side in the same request.
 */

import { useEffect, useRef, useActionState, useState } from "react";
import { X, Loader2, UserPlus, Trash2 } from "lucide-react";
import { addClient, type AddClientResult, type InlineContact } from "./actions";

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyContact = (): InlineContact => ({
  first_name: "", last_name: "", role: "", email: "", phone: "",
});

const initialState: AddClientResult | null = null;

export default function AddClientModal({ isOpen, onClose }: AddClientModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const contactsJsonRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<InlineContact[]>([]);

  const [state, formAction, isPending] = useActionState(
    async (_prev: AddClientResult | null, formData: FormData) => {
      return await addClient(formData);
    },
    initialState
  );

  // Close + reset on success
  useEffect(() => {
    if (state && "success" in state && state.success) {
      formRef.current?.reset();
      setContacts([]);
      onClose();
    }
  }, [state, onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Serialise contacts into hidden input right before the form submits
  function handleSubmit() {
    if (contactsJsonRef.current) {
      contactsJsonRef.current.value = JSON.stringify(contacts);
    }
    formRef.current?.requestSubmit();
  }

  function updateContact(index: number, field: keyof InlineContact, value: string) {
    setContacts((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 40, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.25s ease" }} />

      {/* Modal */}
      <div style={{ position: "fixed", top: "50%", left: "50%", width: 560, maxHeight: "90vh", backgroundColor: "#FFFFFF", zIndex: 50, display: "flex", flexDirection: "column", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease" }}>

        {/* Header */}
        <div style={{ padding: "28px 28px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, margin: 0 }}>Add client</h2>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>Create a client and optionally add contacts.</p>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9A9590", flexShrink: 0, marginLeft: 12 }} className="hover:bg-[#F0EEEB] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form ref={formRef} action={formAction} style={{ flex: 1, overflowY: "auto", padding: "0 28px 0", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Hidden contacts JSON field */}
          <input type="hidden" name="contacts_json" ref={contactsJsonRef} />

          {errorMessage && (
            <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
              {errorMessage}
            </div>
          )}

          {/* ── Client fields ──────────────────────────────────────── */}
          <Field label="Company name" required>
            <input type="text" name="name" placeholder="e.g. Hilton Hotels UK" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          <Field label="Address">
            <input type="text" name="address" placeholder="123 Example St, London" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          {/* ── Contacts section ───────────────────────────────────── */}
          <div>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "1.2px" }}>
                Contacts
              </span>
              <button
                type="button"
                onClick={() => setContacts((prev) => [...prev, emptyContact()])}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#9A9590", padding: 0 }}
                className="hover:text-[#1A1A1A] transition-colors"
              >
                <UserPlus size={13} />
                Add contact
              </button>
            </div>

            {/* Contact entries */}
            {contacts.length === 0 ? (
              <div
                onClick={() => setContacts([emptyContact()])}
                style={{ borderRadius: 10, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                className="hover:border-[#FFDE28] transition-colors"
              >
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#C0BEBB" }}>
                  + Add a contact to this client
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {contacts.map((contact, i) => (
                  <ContactEntry
                    key={i}
                    contact={contact}
                    index={i}
                    onChange={updateContact}
                    onRemove={removeContact}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setContacts((prev) => [...prev, emptyContact()])}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", padding: "4px 0", alignSelf: "flex-start" }}
                  className="hover:text-[#1A1A1A] transition-colors"
                >
                  <UserPlus size={13} />
                  Add another contact
                </button>
              </div>
            )}
          </div>

          <div style={{ height: 8 }} />
        </form>

        {/* Footer */}
        <div style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderTop: "1px solid #F0EEEB" }}>
          <button type="button" onClick={onClose} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", padding: "0 4px" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending} style={{ height: 48, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 8, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", gap: 8 }}>
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {isPending ? "Saving…" : "Save client"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── ContactEntry ───────────────────────────────────────────────────────────────

function ContactEntry({
  contact, index, onChange, onRemove,
}: {
  contact: InlineContact;
  index: number;
  onChange: (i: number, field: keyof InlineContact, value: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div style={{ backgroundColor: "#FAFAF9", borderRadius: 10, border: "1px solid #E4E1DC", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Name row + remove */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <MiniLabel>First name *</MiniLabel>
          <input
            type="text"
            value={contact.first_name}
            onChange={(e) => onChange(index, "first_name", e.target.value)}
            placeholder="Jane"
            style={miniInputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>
        <div style={{ flex: 1 }}>
          <MiniLabel>Last name</MiniLabel>
          <input
            type="text"
            value={contact.last_name}
            onChange={(e) => onChange(index, "last_name", e.target.value)}
            placeholder="Smith"
            style={miniInputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{ marginTop: 20, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 4 }}
          className="hover:text-[#DC2626] transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Role */}
      <div>
        <MiniLabel>Role</MiniLabel>
        <input
          type="text"
          value={contact.role}
          onChange={(e) => onChange(index, "role", e.target.value)}
          placeholder="e.g. Project Manager"
          style={miniInputStyle}
          onFocus={focusHandler}
          onBlur={blurHandler}
        />
      </div>

      {/* Email + Phone */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <MiniLabel>Email</MiniLabel>
          <input
            type="email"
            value={contact.email}
            onChange={(e) => onChange(index, "email", e.target.value)}
            placeholder="jane@example.com"
            style={miniInputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>
        <div style={{ flex: 1 }}>
          <MiniLabel>Phone</MiniLabel>
          <input
            type="text"
            value={contact.phone}
            onChange={(e) => onChange(index, "phone", e.target.value)}
            placeholder="+44 7700 000000"
            style={miniInputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", height: 48, border: "1px solid #E4E1DC",
  backgroundColor: "#FAFAF9", borderRadius: 6, padding: "0 16px",
  fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A",
  outline: "none", boxSizing: "border-box",
};

const miniInputStyle: React.CSSProperties = {
  ...inputStyle, height: 38, fontSize: 13, backgroundColor: "#FFFFFF",
};

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
      {children}
    </p>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: "1.2px" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
