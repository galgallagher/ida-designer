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
import { usePathname, useRouter } from "next/navigation";
import { useChat, type Message } from "ai/react";
import { Send, X, SquarePen } from "lucide-react";
import SpecDetailModal from "@/app/specs/SpecDetailModal";

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
  category_id?: string | null;
  cost_from?: number | null;
  cost_to?: number | null;
  cost_unit?: string | null;
  tags?: string[];
  fields?: { label: string; value: string }[];
  field_values?: { field_id: string; value: string }[];
  supplier_id?: string | null;
  images?: { url: string; alt: string }[];
  source_url?: string;
  error?: string;
}

function isSpecResult(val: unknown): val is SpecResult {
  return (
    typeof val === "object" &&
    val !== null &&
    "name" in val &&
    !("already_exists" in val) &&
    !("results" in val)
  );
}

interface SearchSpecResult {
  id: string;
  name: string;
  category: string | null;
  cost: string | null;
  matched_tags: string[];
  image_url: string | null;
}

interface SearchSpecsResult {
  results: SearchSpecResult[];
  total_found: number;
  message?: string;
  error?: string;
}

// ── Already in library card ───────────────────────────────────────────────────

function AlreadyInLibraryCard({
  result,
  onOpenSpec,
}: {
  result: AlreadyExistsResult;
  onOpenSpec: (id: string) => void;
}) {
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
      <button
        type="button"
        onClick={() => onOpenSpec(result.spec_id)}
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
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
        }}
      >
        View →
      </button>
    </div>
  );
}

// ── Search result cards ───────────────────────────────────────────────────────

function SearchResultCard({
  spec,
  onOpenSpec,
}: {
  spec: SearchSpecResult;
  onOpenSpec: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenSpec(spec.id)}
      style={{
        width: "100%",
        background: "none",
        border: "1px solid #E4E1DC",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        fontFamily: "var(--font-inter), sans-serif",
        marginBottom: 6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#FFDE28";
        e.currentTarget.style.backgroundColor = "#FAFAF9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E4E1DC";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          flexShrink: 0,
          backgroundColor: "#F0EEEB",
          backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {spec.name}
        </p>
        {spec.category && (
          <p style={{ fontSize: 11, color: "#9A9590", marginBottom: spec.cost ? 1 : 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {spec.category}
          </p>
        )}
        {spec.cost && (
          <p style={{ fontSize: 11, color: "#1A1A1A" }}>{spec.cost}</p>
        )}
      </div>
      {/* Arrow */}
      <span style={{ fontSize: 14, color: "#C0BEBB", flexShrink: 0 }}>›</span>
    </button>
  );
}

function SearchResultsList({
  searchResult,
  onOpenSpec,
  onNavigateToLibrary,
}: {
  searchResult: SearchSpecsResult;
  onOpenSpec: (id: string) => void;
  onNavigateToLibrary: () => void;
}) {
  if (searchResult.error) return null;
  if (!searchResult.results || searchResult.results.length === 0) return null;

  // Show up to 3 inline, with a "show all" button if there are more
  const INLINE_LIMIT = 3;
  const shown = searchResult.results.slice(0, INLINE_LIMIT);
  const remaining = searchResult.total_found - shown.length;

  return (
    <div style={{ marginTop: 8 }}>
      {shown.map((spec) => (
        <SearchResultCard key={spec.id} spec={spec} onOpenSpec={onOpenSpec} />
      ))}
      <button
        type="button"
        onClick={onNavigateToLibrary}
        style={{
          width: "100%", marginTop: 4, height: 32,
          backgroundColor: "transparent",
          border: "1px solid #E4E1DC",
          borderRadius: 8, cursor: "pointer",
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 11, fontWeight: 600, color: "#9A9590",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FFDE28"; e.currentTarget.style.color = "#1A1A1A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1DC"; e.currentTarget.style.color = "#9A9590"; }}
      >
        {remaining > 0 ? `Show all ${searchResult.total_found} in library →` : "Open in library →"}
      </button>
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
  const [visibleUrls, setVisibleUrls] = useState<Set<string>>(new Set(images.map((i) => i.url)));

  if (images.length === 0) return null;

  const visible = images.filter((i) => visibleUrls.has(i.url));
  if (visible.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginBottom: 6 }}>
        Pick a product image:
      </p>
      {/* Horizontal scroll strip */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
          // hide scrollbar on webkit but keep it functional
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar"
      >
        {images.map((img) => (
          <button
            key={img.url}
            type="button"
            onClick={() => onSelect(img.url)}
            title={img.alt}
            style={{
              flexShrink: 0,
              width: 88,
              height: 88,
              padding: 0,
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              overflow: "hidden",
              outline: selected === img.url ? "2.5px solid #FFDE28" : "2px solid transparent",
              outlineOffset: 1,
              transition: "outline 0.1s ease",
              backgroundColor: "#F0EEEB",
              scrollSnapAlign: "start",
              // hide completely if image failed to load
              display: visibleUrls.has(img.url) ? "block" : "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt || "Product image"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={() => {
                setVisibleUrls((prev) => {
                  const next = new Set(prev);
                  next.delete(img.url);
                  // If the currently selected image broke, auto-select the first remaining one
                  if (selected === img.url) {
                    const firstGood = images.find((i) => next.has(i.url));
                    if (firstGood) onSelect(firstGood.url);
                  }
                  return next;
                });
              }}
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
  onOpenSpec,
  onSaved,
}: {
  result: SpecResult;
  onOpenSpec: (id: string) => void;
  onSaved?: () => void;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    result.images?.[0]?.url ?? null
  );
  const [manualUrl, setManualUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // When the user types a URL, immediately use it as the selected image
  function handleManualUrl(val: string) {
    setManualUrl(val);
    const trimmed = val.trim();
    if (trimmed) {
      setSelectedImage(trimmed);
    } else {
      // revert to first scraped image if they clear the input
      setSelectedImage(result.images?.[0]?.url ?? null);
    }
  }

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
          category_id: result.category_id ?? null,
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
      setSavedId(data.id as string);
      onSaved?.();
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
          selected={manualUrl.trim() ? null : selectedImage}
          onSelect={(url) => { setSelectedImage(url); setManualUrl(""); }}
        />
      )}

      {/* Manual image URL */}
      <div style={{ marginTop: 10 }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginBottom: 4 }}>
          {(result.images ?? []).length > 0 ? "Or paste an image URL:" : "Paste an image URL:"}
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => handleManualUrl(e.target.value)}
            placeholder="https://…"
            style={{
              flex: 1,
              height: 30,
              paddingLeft: 8,
              paddingRight: 8,
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 11,
              color: "#1A1A1A",
              backgroundColor: "#FAFAF9",
              border: "1px solid #E4E1DC",
              borderRadius: 6,
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#FFDE28")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E1DC")}
          />
          {manualUrl.trim() && (
            /* Small preview thumbnail */
            <div
              style={{
                width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                backgroundColor: "#F0EEEB",
                backgroundImage: `url(${manualUrl.trim()})`,
                backgroundSize: "cover", backgroundPosition: "center",
                border: "2px solid #FFDE28",
              }}
            />
          )}
        </div>
      </div>

      {saveError && (
        <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{saveError}</p>
      )}

      {/* Save / saved row */}
      {savedId ? (
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <div
            style={{
              flex: 1, height: 34, backgroundColor: "#F0EEEB", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#9A9590",
            }}
          >
            ✓ Added to library
          </div>
          <button
            type="button"
            onClick={() => onOpenSpec(savedId)}
            style={{
              height: 34, paddingLeft: 14, paddingRight: 14, flexShrink: 0,
              backgroundColor: "#1A1A1A", border: "none", borderRadius: 8,
              fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#FFDE28",
              cursor: "pointer",
            }}
          >
            View →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 10, width: "100%", height: 34,
            backgroundColor: "#FFDE28",
            border: "none", borderRadius: 8,
            fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A",
            cursor: saving ? "default" : "pointer",
            transition: "background-color 0.2s ease",
          }}
        >
          {saving ? "Saving…" : "Add to library"}
        </button>
      )}
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
  onOpenSpec,
  onNavigateToLibrary,
  onSpecSaved,
}: {
  role: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInvocations?: any[];
  onOpenSpec: (id: string) => void;
  onNavigateToLibrary: (args: Record<string, unknown>) => void;
  onSpecSaved?: () => void;
}) {
  const isUser = role === "user";

  // scrapeSpec tool result
  const scrapeInvocation = toolInvocations?.find(
    (inv) => inv.toolName === "scrapeSpec" && inv.state === "result"
  );
  const scrapeResult = scrapeInvocation?.result as unknown;
  const specError = scrapeResult && typeof scrapeResult === "object" && "error" in scrapeResult
    ? (scrapeResult as { error: string }).error
    : null;
  const alreadyExists =
    scrapeResult && typeof scrapeResult === "object" && "already_exists" in scrapeResult
      ? (scrapeResult as AlreadyExistsResult)
      : null;
  const specResult = isSpecResult(scrapeResult) ? scrapeResult : null;
  const hasSpec = specResult && !specError && !alreadyExists;

  // searchSpecs tool result
  const searchInvocation = toolInvocations?.find(
    (inv) => inv.toolName === "searchSpecs" && inv.state === "result"
  );
  const searchResult: SearchSpecsResult | null = searchInvocation?.result ?? null;
  const hasSearchResults =
    searchResult && !searchResult.error && (searchResult.results?.length ?? 0) > 0;

  // Don't render an empty bubble (tool-only messages with no text)
  const cleanedContent = content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
  if (!cleanedContent && !hasSpec && !specError && !alreadyExists && !hasSearchResults) return null;

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
          <AlreadyInLibraryCard result={alreadyExists} onOpenSpec={onOpenSpec} />
        )}

        {hasSpec && specResult && (
          <SpecResultCard
            result={specResult}
            onOpenSpec={onOpenSpec}
            onSaved={onSpecSaved}
          />
        )}

        {hasSearchResults && searchResult && (
          <SearchResultsList
            searchResult={searchResult}
            onOpenSpec={onOpenSpec}
            onNavigateToLibrary={() => onNavigateToLibrary(searchInvocation.args ?? {})}
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

const STORAGE_KEY = "ida-chat-messages";

export default function IdaWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [openSpecId, setOpenSpecId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore persisted messages on mount — so history survives page navigation
  const [restoredMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [INITIAL_MESSAGE];
  });

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/ida",
    body: { context: { pathname } },
    initialMessages: restoredMessages,
    onError: (err) => {
      console.error("Ida error:", err);
      setApiError(err.message ?? "Something went wrong. Check the terminal for details.");
    },
    onResponse: () => setApiError(null),
  });

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages]);

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

  function handleOpenSpec(id: string) {
    setOpenSpecId(id);     // open the modal — chat panel stays open behind it
  }

  function handleNavigateToLibrary(args: Record<string, unknown>) {
    const keywords = args.keywords as string | undefined;
    const categoryName = args.category_name as string | undefined;
    const colors = args.colors as string[] | undefined;
    const patterns = args.patterns as string[] | undefined;
    const materials = args.materials as string[] | undefined;

    const tagTerms = [...(colors ?? []), ...(patterns ?? []), ...(materials ?? [])];
    const q = [keywords, ...tagTerms].filter(Boolean).join(" ");

    const detail = { q: q || null, cat: categoryName || null };

    if (pathname === "/specs") {
      // Already on the library — fire a custom event so the client component
      // applies filters in-place without a navigation/re-fetch cycle.
      window.dispatchEvent(new CustomEvent("ida:filter-specs", { detail }));
    } else {
      // Navigate to specs page; SpecLibraryClient reads URL params on mount.
      const params = new URLSearchParams();
      if (detail.q) params.set("q", detail.q);
      if (detail.cat) params.set("cat", detail.cat);
      router.push(`/specs${params.toString() ? `?${params.toString()}` : ""}`);
    }
  }

  function handleNewChat() {
    setMessages([INITIAL_MESSAGE]);
    setApiError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <>
      {/* ── Spec detail modal (triggered from chat) ── */}
      <SpecDetailModal
        specId={openSpecId}
        onClose={() => setOpenSpecId(null)}
      />

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
            zIndex: openSpecId ? 10 : 100,
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
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                type="button"
                onClick={handleNewChat}
                disabled={isLoading}
                title="New conversation"
                style={{ background: "none", border: "none", cursor: isLoading ? "default" : "pointer", color: "#9A9590", padding: 4, borderRadius: 6, opacity: isLoading ? 0.4 : 1 }}
                className="hover:bg-[#F0EEEB] transition-colors"
              >
                <SquarePen size={15} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9590", padding: 4, borderRadius: 6 }}
                className="hover:bg-[#F0EEEB] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
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
                onOpenSpec={handleOpenSpec}
                onNavigateToLibrary={handleNavigateToLibrary}
                onSpecSaved={() => router.refresh()}
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
      {/* z-index drops to 10 while spec modal is open so the modal backdrop covers the bubble */}
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
          zIndex: openSpecId ? 10 : 101,
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
