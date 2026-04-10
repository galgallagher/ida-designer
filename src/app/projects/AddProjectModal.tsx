"use client";

/**
 * AddProjectModal — centred pop-out for creating a project from the Projects page.
 *
 * Step 1: Project details + assign to existing client OR create new client inline.
 * If "new client" is chosen, an optional contact section appears.
 */

import { useEffect, useRef, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, UserPlus, ChevronDown } from "lucide-react";
import { createProject, type CreateProjectResult } from "./actions";

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
}

const initialState: CreateProjectResult | null = null;

export default function AddProjectModal({ isOpen, onClose, clients }: AddProjectModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [showContact, setShowContact] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (_prev: CreateProjectResult | null, formData: FormData) => {
      return await createProject(formData);
    },
    initialState
  );

  // On success navigate to the new project
  useEffect(() => {
    if (state && "success" in state && state.success) {
      onClose();
      router.push(`/projects/${state.projectId}`);
    }
  }, [state, onClose, router]);

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

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        formRef.current?.reset();
        setClientMode("existing");
        setShowContact(false);
      }, 250);
    }
  }, [isOpen]);

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 40, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", width: 560,
          maxHeight: "90vh", backgroundColor: "#FFFFFF", zIndex: 50,
          display: "flex", flexDirection: "column", borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)",
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2, margin: 0 }}>
              New project
            </h2>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>
              Fill in the details and assign to a client.
            </p>
          </div>
          <button type="button" onClick={onClose} className="hover:bg-[#F0EEEB] transition-colors" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9A9590" }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form */}
        <form ref={formRef} action={formAction} style={{ flex: 1, overflowY: "auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {errorMessage && (
            <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
              {errorMessage}
            </div>
          )}

          {/* ── Project details ── */}
          <SectionLabel>Project details</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Project name" required style={{ gridColumn: "1 / -1" }}>
              <input type="text" name="name" placeholder="e.g. Prague Flagship" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="Project code" required>
              <input type="text" name="code" placeholder="IDA-001" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue="active" style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }} onFocus={focusHandler} onBlur={blurHandler}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Site address" style={{ gridColumn: "1 / -1" }}>
              <input type="text" name="site_address" placeholder="123 Example St" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
          </div>

          {/* ── Client ── */}
          <div style={{ height: 1, backgroundColor: "#F0EEEB" }} />
          <SectionLabel>Client</SectionLabel>

          {/* Toggle */}
          <input type="hidden" name="client_mode" value={clientMode} />
          <div className="flex gap-2">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setClientMode(mode)}
                style={{
                  height: 34, paddingLeft: 14, paddingRight: 14,
                  borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500,
                  backgroundColor: clientMode === mode ? "#1A1A1A" : "#F0EEEB",
                  color: clientMode === mode ? "#FFFFFF" : "#9A9590",
                  transition: "all 0.15s ease",
                }}
              >
                {mode === "existing" ? "Existing client" : "New client"}
              </button>
            ))}
          </div>

          {/* Existing client select */}
          {clientMode === "existing" && (
            <Field label="Select client" required>
              <div style={{ position: "relative" }}>
                <select name="client_id" required style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: chevronSvg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 }} onFocus={focusHandler} onBlur={blurHandler}>
                  <option value="">— Choose a client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {/* New client fields */}
          {clientMode === "new" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Company name" required style={{ gridColumn: "1 / -1" }}>
                  <input type="text" name="new_client_name" placeholder="e.g. Hilton Hotels UK" required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </Field>
                <Field label="Address" style={{ gridColumn: "1 / -1" }}>
                  <input type="text" name="new_client_address" placeholder="123 Example St, London" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </Field>
              </div>

              {/* Optional contact */}
              {!showContact ? (
                <button
                  type="button"
                  onClick={() => setShowContact(true)}
                  className="flex items-center gap-1.5 self-start transition-opacity hover:opacity-70"
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#9A9590", padding: 0 }}
                >
                  <UserPlus size={13} /> Add a contact
                </button>
              ) : (
                <div style={{ backgroundColor: "#FAFAF9", borderRadius: 10, border: "1px solid #E4E1DC", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "1px" }}>Contact</span>
                    <button type="button" onClick={() => setShowContact(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", padding: 2 }}>
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <MiniField label="First name *">
                      <input type="text" name="contact_first_name" placeholder="Jane" style={miniInputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                    </MiniField>
                    <MiniField label="Last name">
                      <input type="text" name="contact_last_name" placeholder="Smith" style={miniInputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                    </MiniField>
                  </div>
                  <MiniField label="Role">
                    <input type="text" name="contact_role" placeholder="Project Manager" style={miniInputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                  </MiniField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <MiniField label="Email">
                      <input type="email" name="contact_email" placeholder="jane@example.com" style={miniInputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                    </MiniField>
                    <MiniField label="Phone">
                      <input type="text" name="contact_phone" placeholder="+44 7700 000000" style={miniInputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                    </MiniField>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ height: 8 }} />
        </form>

        {/* Footer */}
        <div style={{ padding: 24, borderTop: "1px solid #F0EEEB", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <button type="button" onClick={onClose} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#9A9590" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            style={{ height: 44, paddingLeft: 24, paddingRight: 24, backgroundColor: isPending ? "#FFF0A0" : "#FFDE28", border: "none", borderRadius: 8, cursor: isPending ? "not-allowed" : "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A", display: "flex", alignItems: "center", gap: 8 }}
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isPending ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
      {children}
    </p>
  );
}

function Field({ label, required, children, style }: { label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: "1.2px" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>{label}</p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, border: "1px solid #E4E1DC", backgroundColor: "#FAFAF9",
  borderRadius: 8, padding: "0 14px", fontFamily: "var(--font-inter), sans-serif",
  fontSize: 14, color: "#1A1A1A", outline: "none", boxSizing: "border-box",
};

const miniInputStyle: React.CSSProperties = {
  ...inputStyle, height: 38, fontSize: 13, backgroundColor: "#FFFFFF",
};

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239A9590' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`;

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}
function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
}
