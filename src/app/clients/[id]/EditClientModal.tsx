"use client";

/**
 * EditClientModal — slide-in panel for editing an existing client.
 * Pre-filled with the current client name and address.
 */

import { useEffect, useRef, useActionState } from "react";
import { X, Loader2 } from "lucide-react";
import { updateClient, type UpdateClientResult } from "./actions";

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  currentName: string;
  currentAddress: string | null;
}

const initialState: UpdateClientResult | null = null;

export default function EditClientModal({
  isOpen,
  onClose,
  clientId,
  currentName,
  currentAddress,
}: EditClientModalProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: UpdateClientResult | null, formData: FormData) => {
      return await updateClient(clientId, formData);
    },
    initialState
  );

  // Close on success
  useEffect(() => {
    if (state && "success" in state && state.success) onClose();
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

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 40, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", width: 480,
          maxHeight: "90vh", backgroundColor: "#FFFFFF", zIndex: 50,
          display: "flex", flexDirection: "column",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "28px 28px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, margin: 0 }}>
              Edit client
            </h2>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>
              Update the details for this client.
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

          <Field label="Company name" required>
            <input
              type="text"
              name="name"
              defaultValue={currentName}
              required
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>

          <Field label="Address">
            <input
              type="text"
              name="address"
              defaultValue={currentAddress ?? ""}
              placeholder="123 Example St, London"
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
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
            {isPending ? "Saving…" : "Save changes"}
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

function focusHandler(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement>) {
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
