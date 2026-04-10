"use client";

/**
 * AddProjectModal — slide-in panel from the right.
 *
 * Rendered as a Client Component because it owns open/close state and
 * calls the addProject server action with useActionState.
 */

import { useEffect, useRef, useActionState } from "react";
import { X, Loader2 } from "lucide-react";
import { addProject, type AddProjectResult } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: AddProjectResult | null = null;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddProjectModal({ isOpen, onClose, clientId }: AddProjectModalProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: AddProjectResult | null, formData: FormData) => {
      return await addProject(clientId, formData);
    },
    initialState
  );

  // Close on successful save
  useEffect(() => {
    if (state && "success" in state && state.success) {
      formRef.current?.reset();
      onClose();
    }
  }, [state, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const errorMessage = state && "error" in state ? state.error : null;

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* ── Modal ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          width: 520,
          maxHeight: "90vh",
          backgroundColor: "#FFFFFF",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.96)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          style={{
            padding: "28px 28px 20px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#1A1A1A",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              New project
            </h2>
            <p
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#9A9590",
                marginTop: 4,
              }}
            >
              Fill in the details below to create a new project.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#9A9590",
              flexShrink: 0,
              marginLeft: 12,
            }}
            className="hover:bg-[#F0EEEB] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Form body (scrollable) ────────────────────────────── */}
        <form
          ref={formRef}
          action={formAction}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 28px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Global error */}
          {errorMessage && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#DC2626",
              }}
            >
              {errorMessage}
            </div>
          )}

          <Field label="Project name" required>
            <input
              type="text"
              name="name"
              placeholder="Kitchen Renovation"
              required
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>

          <Field label="Project code">
            <input
              type="text"
              name="code"
              placeholder="e.g. IDA-001"
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>

          <Field label="Site address">
            <input
              type="text"
              name="site_address"
              placeholder="123 Example St, Sydney NSW"
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              rows={3}
              placeholder="Brief description of the project scope…"
              style={{
                ...inputStyle,
                height: "auto",
                padding: "12px 16px",
                resize: "vertical",
                lineHeight: 1.5,
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </Field>

          <Field label="Status">
            <select
              name="status"
              defaultValue="active"
              style={{
                ...inputStyle,
                cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239A9590' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
                paddingRight: 40,
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </Field>

          {/* Spacer so footer has breathing room */}
          <div style={{ height: 8 }} />
        </form>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div
          style={{
            padding: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderTop: "1px solid #F0EEEB",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 14,
              color: "#9A9590",
              padding: "0 4px",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            style={{
              height: 48,
              paddingLeft: 24,
              paddingRight: 24,
              backgroundColor: isPending ? "#FFF0A0" : "#FFDE28",
              border: "none",
              borderRadius: 8,
              cursor: isPending ? "not-allowed" : "pointer",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "#1A1A1A",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background-color 0.15s ease",
            }}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {isPending ? "Saving…" : "Save project"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  border: "1px solid #E4E1DC",
  backgroundColor: "#FAFAF9",
  borderRadius: 6,
  padding: "0 16px",
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 14,
  color: "#1A1A1A",
  outline: "none",
  boxSizing: "border-box",
};

function focusHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#FFDE28";
}

function blurHandler(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#E4E1DC";
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 10,
          fontWeight: 600,
          color: "#1A1A1A",
          textTransform: "uppercase",
          letterSpacing: "1.2px",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}
