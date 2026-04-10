"use client";

/**
 * AddContactModal — slide-in panel for adding a person to a client.
 *
 * A contact is a person at the client company (e.g. "Jane Smith, Project Manager at Hilton").
 */

import { useEffect, useRef, useActionState } from "react";
import { X, Loader2 } from "lucide-react";
import { addContact, type AddContactResult } from "./actions";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

const initialState: AddContactResult | null = null;

export default function AddContactModal({ isOpen, onClose, clientId }: AddContactModalProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: AddContactResult | null, formData: FormData) => {
      return await addContact(clientId, formData);
    },
    initialState
  );

  useEffect(() => {
    if (state && "success" in state && state.success) {
      formRef.current?.reset();
      onClose();
    }
  }, [state, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 40, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.25s ease" }} />

      {/* Modal */}
      <div style={{ position: "fixed", top: "50%", left: "50%", width: 520, maxHeight: "90vh", backgroundColor: "#FFFFFF", zIndex: 50, display: "flex", flexDirection: "column", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease" }}>

        {/* Header */}
        <div style={{ padding: "28px 28px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, margin: 0 }}>
              Add contact
            </h2>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>
              Add a person at this client&apos;s company.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9A9590", flexShrink: 0, marginLeft: 12 }} className="hover:bg-[#F0EEEB] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} action={formAction} style={{ flex: 1, overflowY: "auto", padding: "0 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {errorMessage && (
            <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
              {errorMessage}
            </div>
          )}

          {/* Name row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="First name" required>
              <input type="text" name="first_name" placeholder="Jane" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="Last name">
              <input type="text" name="last_name" placeholder="Smith" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
          </div>

          <Field label="Role / job title">
            <input type="text" name="role" placeholder="e.g. Project Manager" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          <Field label="Email">
            <input type="email" name="email" placeholder="jane@example.com" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          <Field label="Phone">
            <input type="text" name="phone" placeholder="+44 7700 000000" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          <Field label="Notes">
            <textarea name="notes" rows={3} placeholder="Any notes about this contact…" style={{ ...inputStyle, height: "auto", padding: "12px 16px", resize: "vertical", lineHeight: 1.5 }} onFocus={focusHandler} onBlur={blurHandler} />
          </Field>

          <div style={{ height: 8 }} />
        </form>

        {/* Footer */}
        <div style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderTop: "1px solid #F0EEEB" }}>
          <button type="button" onClick={onClose} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590", padding: "0 4px" }}>
            Cancel
          </button>
          <button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={isPending} style={{ height: 48, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 8, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", gap: 8 }}>
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {isPending ? "Saving…" : "Save contact"}
          </button>
        </div>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 48, border: "1px solid #E4E1DC",
  backgroundColor: "#FAFAF9", borderRadius: 6, padding: "0 16px",
  fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A",
  outline: "none", boxSizing: "border-box",
};

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
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
