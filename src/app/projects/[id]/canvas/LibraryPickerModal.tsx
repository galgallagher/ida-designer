"use client";

/**
 * LibraryPickerModal — pick items from the studio's Product Library and drop
 * them onto the canvas as spec-card shapes.
 *
 * Behaviour:
 * - Fetches all studio library specs on open (one-shot, client-side filter).
 * - Search filters by name, code, or category name — case-insensitive.
 * - Click a tile → fires onSelect(spec), which places it on the canvas.
 * - Modal stays open so the user can add several items without reopening.
 * - Selected tiles briefly flash a yellow "✓ Added" badge.
 */

import { useEffect, useState, useMemo } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getLibrarySpecs, getProjectOptionSpecIds, type LibrarySpecLite } from "./actions";
import { getScheduleCodesForProject } from "../specifications/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (spec: LibrarySpecLite) => void;
  projectId: string;
}

export default function LibraryPickerModal({ open, onClose, onSelect, projectId }: Props) {
  const [specs, setSpecs] = useState<LibrarySpecLite[]>([]);
  const [optionIds, setOptionIds] = useState<Set<string>>(new Set());
  const [scheduleCodes, setScheduleCodes] = useState<Record<string, string[]>>({});
  const [tab, setTab] = useState<"options" | "specified" | "library">("options");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Track recently-added spec ids to show a transient "Added" badge.
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, number>>({});

  // Fetch library + project options on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getLibrarySpecs(),
      getProjectOptionSpecIds(projectId),
      getScheduleCodesForProject(projectId),
    ]).then(([libRes, ids, codeMap]) => {
      if (cancelled) return;
      setSpecs(libRes.specs);
      setError(libRes.error);
      const set = new Set(ids);
      setOptionIds(set);
      setScheduleCodes(codeMap);
      // Default to whichever tab has items (prefer Specified, then Options, then Library)
      const hasSpecified = Object.keys(codeMap).length > 0;
      setTab(hasSpecified ? "specified" : set.size > 0 ? "options" : "library");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, projectId]);

  // Reset search / badges when the modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setRecentlyAdded({});
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let scoped = specs;
    if (tab === "options") scoped = specs.filter((s) => optionIds.has(s.id));
    else if (tab === "specified") scoped = specs.filter((s) => (scheduleCodes[s.id]?.length ?? 0) > 0);
    if (!q) return scoped;
    return scoped.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.category_name ?? "").toLowerCase().includes(q) ||
        (scheduleCodes[s.id] ?? []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [specs, query, tab, optionIds, scheduleCodes]);

  function handleTileClick(spec: LibrarySpecLite) {
    onSelect(spec);
    // Flash an "Added" badge for 1.5 seconds.
    setRecentlyAdded((prev) => ({ ...prev, [spec.id]: Date.now() }));
    setTimeout(() => {
      setRecentlyAdded((prev) => {
        const next = { ...prev };
        delete next[spec.id];
        return next;
      });
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 max-w-3xl"
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          backgroundColor: "#FFFFFF",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: 56, borderBottom: "1px solid #E4E1DC" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#1A1A1A",
            }}
          >
            Add from Product Library
          </h2>
          {/* shadcn DialogContent renders its own close (X) button — no custom one here */}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div
          className="flex gap-1 px-5 flex-shrink-0"
          style={{ borderBottom: "1px solid #E4E1DC" }}
        >
          <PickerTab active={tab === "options"} onClick={() => setTab("options")} label="Project Options" />
          <PickerTab active={tab === "specified"} onClick={() => setTab("specified")} label="Specified" />
          <PickerTab active={tab === "library"} onClick={() => setTab("library")} label="Studio Library" />
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #E4E1DC" }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3"
            style={{
              border: "1px solid #E4E1DC",
              backgroundColor: "#F5F4F2",
              height: 36,
            }}
          >
            <Search size={14} style={{ color: "#9A9590", flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code or category..."
              className="outline-none bg-transparent flex-1"
              style={{ fontSize: 13, color: "#1A1A1A" }}
            />
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────────────────── */}
        <div
          className="px-5 py-4 overflow-y-auto flex-1"
          style={{ minHeight: 200, backgroundColor: "#FAFAF9" }}
        >
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "#9A9590" }} />
            </div>
          ) : error ? (
            <div className="text-center py-10" style={{ fontSize: 13, color: "#DC2626" }}>
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10" style={{ fontSize: 13, color: "#9A9590" }}>
              {query
                ? `No items match "${query}".`
                : tab === "options"
                  ? "No items in this project's options yet. Try the Studio Library tab."
                  : tab === "specified"
                    ? "No specified items yet. Assign codes on the Specifications page."
                    : "Your library is empty. Add items via the Product Library or by scraping product URLs."}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
            >
              {filtered.map((spec) => {
                const isRecent = !!recentlyAdded[spec.id];
                const codes = scheduleCodes[spec.id] ?? [];
                return (
                  <button
                    key={spec.id}
                    onClick={() => handleTileClick(spec)}
                    className="text-left rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E4E1DC",
                      boxShadow: "0 1px 3px rgba(26,26,26,0.04)",
                      cursor: "pointer",
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        backgroundColor: "#F5F4F2",
                        overflow: "hidden",
                      }}
                    >
                      {spec.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spec.image_url}
                          alt={spec.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center h-full"
                          style={{ fontSize: 11, color: "#9A9590" }}
                        >
                          No image
                        </div>
                      )}

                      {/* Schedule code pill(s) — bottom-left */}
                      {codes.length > 0 && !isRecent ? (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 3,
                            maxWidth: "calc(100% - 12px)",
                          }}
                        >
                          {codes.map((c) => (
                            <span
                              key={c}
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: "#1A1A1A",
                                backgroundColor: "rgba(255,255,255,0.95)",
                                boxShadow: "0 1px 4px rgba(26,26,26,0.15)",
                                borderRadius: 20,
                                padding: "2px 7px",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* "Added" badge */}
                      {isRecent ? (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            backgroundColor: "rgba(255, 222, 40, 0.85)",
                            color: "#1A1A1A",
                            fontSize: 12,
                            fontWeight: 600,
                            gap: 6,
                            display: "flex",
                          }}
                        >
                          <Check size={14} />
                          Added
                        </div>
                      ) : null}
                    </div>

                    {/* Text */}
                    <div style={{ padding: "8px 10px" }}>
                      {spec.category_name ? (
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 600,
                            letterSpacing: 0.6,
                            color: "#9A9590",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {spec.category_name}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                          lineHeight: 1.25,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 1,
                        }}
                      >
                        {spec.name}
                      </div>
                      {spec.code ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9A9590",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {spec.code}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          className="px-5 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: "1px solid #E4E1DC", backgroundColor: "#FFFFFF" }}
        >
          <span style={{ fontSize: 11, color: "#9A9590" }}>
            {loading ? "Loading…" : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md transition-colors hover:bg-black/[0.04]"
            style={{ fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickerTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 transition-colors"
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #1A1A1A" : "2px solid transparent",
        marginBottom: -1,
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? "#1A1A1A" : "#9A9590",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
