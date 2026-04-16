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
import { Search, Loader2, Check, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getLibrarySpecs, type LibrarySpecLite } from "./actions";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (spec: LibrarySpecLite) => void;
}

export default function LibraryPickerModal({ open, onClose, onSelect }: Props) {
  const [specs, setSpecs] = useState<LibrarySpecLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Track recently-added spec ids to show a transient "Added" badge.
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, number>>({});

  // Fetch library on open (and refetch if reopened — cheap enough)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLibrarySpecs().then(({ specs, error }) => {
      if (cancelled) return;
      setSpecs(specs);
      setError(error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Reset search / badges when the modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setRecentlyAdded({});
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return specs;
    return specs.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.category_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [specs, query]);

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
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-black/[0.04] transition-colors"
            style={{ color: "#9A9590" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
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
              {specs.length === 0
                ? "Your library is empty. Add items via the Product Library or by scraping product URLs."
                : `No items match "${query}".`}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
            >
              {filtered.map((spec) => {
                const isRecent = !!recentlyAdded[spec.id];
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
