"use client";

/**
 * IdaWidget — persistent AI assistant chat bubble
 *
 * Floats bottom-right on every authenticated page.
 * Expands into a chat panel on click.
 * Uses Vercel AI SDK useChat hook for streaming responses.
 * Sends current pathname as context with every message.
 */

import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat, type Message } from "ai/react";
import { Send, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlreadyExistsResult {
  already_exists: true;
  spec_id: string;
  spec_name: string;
  spec_url: string;
}

interface SpecResult {
  name?: string;
  brand?: string | null;
  description?: string | null;
  collection?: string | null;
  category_suggestion?: string;
  cost_from?: number | null;
  cost_to?: number | null;
  cost_unit?: string | null;
  tags?: string[];
  fields?: { label: string; value: string }[];
  field_values?: { field_id: string; label: string; value: string }[];
  supplier_id?: string | null;
  images?: { url: string; alt: string }[];
  source_url?: string;
  error?: string;
}

// ── Already in library card ───────────────────────────────────────────────────

function AlreadyInLibraryCard({ result }: { result: AlreadyExistsResult }) {
  return (
    <div
      style={{
        backgroundColor: "#F0EEEB",
        borderRadius: 10,
        padding: "10px 12px",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>
          {result.spec_name}
        </p>
        <p style={{ fontSize: 11, color: "#9A9590" }}>Already in your library</p>
      </div>
      <a
        href={result.spec_url}
        style={{
          flexShrink: 0,
          height: 30,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: "#1A1A1A",
          borderRadius: 7,
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "#FFDE28",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
        }}
      >
        View →
      </a>
    </div>
  );
}

// ── Image picker ──────────────────────────────────────────────────────────────

function ImagePicker({
  images,
  selected,
  onSelect,
}: {
  images: { url: string; alt: string }[];
  selected: string | null;
  onSelect: (url: string) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginBottom: 6 }}>
        Pick a product image:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {images.slice(0, 6).map((img) => (
          <button
            key={img.url}
            type="button"
            onClick={() => onSelect(img.url)}
            title={img.alt}
            style={{
              padding: 0, border: "none", cursor: "pointer", borderRadius: 8, overflow: "hidden",
              outline: selected === img.url ? "2.5px solid #FFDE28" : "2px solid transparent",
              transition: "outline 0.1s ease",
              aspectRatio: "1 / 1",
              backgroundColor: "#F0EEEB",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt || "Product image"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Spec result card ──────────────────────────────────────────────────────────

function SpecResultCard({
  result,
  onSave,
}: {
  result: SpecResult;
  onSave: (imageUrl: string | null) => void;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    result.images?.[0]?.url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/ida/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          description: result.description ?? null,
          category_id: (result as SpecResult & { category_id?: string | null }).category_id ?? null,
          image_url: selectedImage,
          cost_from: result.cost_from ?? null,
          cost_to: result.cost_to ?? null,
          cost_unit: result.cost_unit ?? null,
          tags: result.tags ?? [],
          source_url: result.source_url ?? null,
          field_values: result.field_values ?? [],
          supplier_id: result.supplier_id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      onSave(selectedImage);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (result.error) return null;

  return (
    <div
      style={{
        backgroundColor: "#FAFAF9",
        border: "1px solid #E4E1DC",
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      {/* Name + brand */}
      <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>
        {result.name}
      </p>
      {result.brand && (
        <p style={{ fontSize: 11, color: "#9A9590", marginBottom: 6 }}>{result.brand}</p>
      )}

      {/* Category + collection */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {result.category_suggestion && (
          <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#FFDE28", color: "#1A1A1A", borderRadius: 4, padding: "2px 7px" }}>
            {result.category_suggestion}
          </span>
        )}
        {result.collection && (
          <span style={{ fontSize: 10, backgroundColor: "#F0EEEB", color: "#9A9590", borderRadius: 4, padding: "2px 7px" }}>
            {result.collection}
          </span>
        )}
      </div>

      {/* Cost */}
      {(result.cost_from || result.cost_to) && (
        <p style={{ fontSize: 12, color: "#1A1A1A", marginBottom: 6 }}>
          {result.cost_from && result.cost_to
            ? `£${result.cost_from} – £${result.cost_to}`
            : result.cost_from
              ? `from £${result.cost_from}`
              : `up to £${result.cost_to}`}
          {result.cost_unit && <span style={{ color: "#9A9590" }}> {result.cost_unit}</span>}
        </p>
      )}

      {/* Key fields */}
      {(result.fields ?? []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
          {result.fields!.slice(0, 4).map((f) => (
            <div key={f.label} style={{ display: "flex", gap: 6, fontSize: 11 }}>
              <span style={{ color: "#9A9590", minWidth: 80, flexShrink: 0 }}>{f.label}</span>
              <span style={{ color: "#1A1A1A" }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Image picker */}
      {(result.images ?? []).length > 0 && (
        <ImagePicker
          images={result.images!}
          selected={selectedImage}
          onSelect={setSelectedImage}
        />
      )}

      {saveError && (
        <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{saveError}</p>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        style={{
          marginTop: 10, width: "100%", height: 34,
          backgroundColor: saved ? "#F0EEEB" : "#FFDE28",
          border: "none", borderRadius: 8,
          fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600,
          color: saved ? "#9A9590" : "#1A1A1A",
          cursor: saving || saved ? "default" : "pointer",
          transition: "background-color 0.2s ease",
        }}
      >
        {saving ? "Saving…" : saved ? "✓ Added to library" : "Add to library"}
      </button>
    </div>
  );
}

// ── Simple markdown renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Strip image markdown entirely — images are shown in the card
  const cleaned = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();

  // Split into lines, render bold (**text**) inline
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "");

  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={j}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );
    return (
      <span key={i} style={{ display: "block", marginBottom: i < lines.length - 1 ? 4 : 0 }}>
        {rendered}
      </span>
    );
  });
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  toolInvocations,
  onSaveSpec,
}: {
  role: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInvocations?: any[];
  onSaveSpec: (result: SpecResult, imageUrl: string | null) => void;
}) {
  const isUser = role === "user";

  // Find spec result from tool invocations
  const specResult = toolInvocations?.find(
    (inv) => inv.toolName === "scrapeSpec" && inv.state === "result"
  );
  const specError = specResult?.result?.error;
  const alreadyExists = specResult?.result?.already_exists ? specResult.result as AlreadyExistsResult : null;
  const hasSpec = specResult && !specError && !alreadyExists;

  // Don't render an empty bubble (tool-only messages with no text)
  const cleanedContent = content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
  if (!cleanedContent && !hasSpec && !specError && !alreadyExists) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          backgroundColor: isUser ? "#1A1A1A" : "#FFFFFF",
          color: isUser ? "#FFFFFF" : "#1A1A1A",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          padding: cleanedContent || specError ? "9px 12px" : 0,
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          boxShadow: isUser ? "none" : "0 1px 4px rgba(26,26,26,0.06)",
          border: isUser ? "none" : (cleanedContent || specError ? "1px solid #F0EEEB" : "none"),
        }}
      >
        {cleanedContent && (isUser ? cleanedContent : renderMarkdown(cleanedContent))}

        {specError && (
          <p style={{ color: "#EF4444", fontSize: 12, marginTop: cleanedContent ? 6 : 0 }}>
            {specError}
          </p>
        )}

        {alreadyExists && (
          <AlreadyInLibraryCard result={alreadyExists} />
        )}

        {hasSpec && (
          <SpecResultCard
            result={specResult.result as SpecResult}
            onSave={(imageUrl) => onSaveSpec(specResult.result as SpecResult, imageUrl)}
          />
        )}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

const INITIAL_MESSAGE = {
  id: "welcome",
  role: "assistant" as const,
  content: "Hi — I'm Ida, your design assistant. Paste a product URL and I'll pull the spec details for you, or ask me anything about your studio.",
};

export default function IdaWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ida",
    body: { context: { pathname } },
    initialMessages: [INITIAL_MESSAGE],
    onError: (err) => {
      console.error("Ida error:", err);
      setApiError(err.message ?? "Something went wrong. Check the terminal for details.");
    },
    onResponse: () => setApiError(null),
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // No-op — saving is handled directly inside SpecResultCard via /api/ida/save
  function handleSaveSpec(_result: SpecResult, _imageUrl: string | null) { }

  return (
    <>
      {/* ── Expanded chat panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            right: 20,
            width: 380,
            height: 520,
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            boxShadow: "0 12px 48px rgba(26,26,26,0.18)",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
            overflow: "hidden",
            border: "1px solid #F0EEEB",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px 12px",
              borderBottom: "1px solid #F0EEEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              backgroundColor: "#FFFFFF",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32, height: 32,
                  backgroundColor: "#1A1A1A",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#FFDE28", lineHeight: 1 }}>
                  i
                </span>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 15, fontWeight: 700, color: "#1A1A1A", lineHeight: 1 }}>
                  Ida
                </p>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590", marginTop: 2 }}>
                  Design Assistant
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 4, borderRadius: 6 }}
              className="hover:bg-[#F0EEEB] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 14px 6px",
            }}
          >
            {messages.map((m: Message) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                toolInvocations={m.toolInvocations}
                onSaveSpec={handleSaveSpec}
              />
            ))}

            {/* Thinking dots */}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #F0EEEB",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 7, height: 7,
                        borderRadius: "50%",
                        backgroundColor: "#C0BEBB",
                        display: "inline-block",
                        animation: "ida-bounce 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* API error */}
            {apiError && (
              <div style={{ marginBottom: 8, padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626" }}>
                {apiError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: "10px 12px 12px",
              borderTop: "1px solid #F0EEEB",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Paste a URL or ask anything…"
              disabled={isLoading}
              style={{
                flex: 1,
                height: 36,
                paddingLeft: 12,
                paddingRight: 12,
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#1A1A1A",
                backgroundColor: "#FAFAF9",
                border: "1.5px solid #E4E1DC",
                borderRadius: 10,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                width: 36, height: 36,
                backgroundColor: input.trim() ? "#FFDE28" : "#F0EEEB",
                border: "none", borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() ? "pointer" : "default",
                flexShrink: 0,
                transition: "background-color 0.15s ease",
              }}
            >
              <Send size={14} style={{ color: input.trim() ? "#1A1A1A" : "#C0BEBB" }} />
            </button>
          </form>
        </div>
      )}

      {/* ── Bubble button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close Ida" : "Open Ida — Design Assistant"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          backgroundColor: "#1A1A1A",
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(26,26,26,0.24)",
          zIndex: 101,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        className="hover:scale-105 hover:shadow-xl"
      >
        {open ? (
          <X size={18} style={{ color: "#FFDE28" }} />
        ) : (
          <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 600, color: "#FFDE28", lineHeight: 1, userSelect: "none" }}>
            i
          </span>
        )}
      </button>
    </>
  );
}
