"use client";

/**
 * SpecDetailModal
 *
 * Opens as an overlay when a spec tile is clicked in the library.
 * Fetches spec data via the getSpecDetail server action.
 * Close with the X button, Escape key, or clicking the backdrop.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { X, ExternalLink, Tag, Package, Pencil, ArrowRight } from "lucide-react";
import { getSpecDetail, type SpecDetailData } from "./actions";

interface Props {
  specId: string | null;
  onClose: () => void;
}

export default function SpecDetailModal({ specId, onClose }: Props) {
  const [data, setData] = useState<SpecDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  // Fetch data whenever specId changes
  useEffect(() => {
    if (!specId) {
      setVisible(false);
      setData(null);
      return;
    }
    setLoading(true);
    setVisible(true);
    getSpecDetail(specId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [specId]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );
  useEffect(() => {
    if (!specId) return;
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [specId, handleKeyDown]);

  if (!specId) return null;

  const { spec, category, fields, valueMap, tags, suppliers, projects } = data ?? {};
  const createdDate = spec
    ? new Date(spec.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          backgroundColor: "rgba(26,26,26,0.45)",
          backdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 51,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 800,
            maxHeight: "calc(100vh - 48px)",
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            boxShadow: "0 24px 80px rgba(26,26,26,0.22)",
            display: "flex", flexDirection: "column",
            pointerEvents: "auto",
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1) translateY(0)" : "scale(0.97) translateY(8px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            overflow: "hidden",
          }}
        >
          {/* ── Header bar ── */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px 12px",
              borderBottom: "1px solid #F0EEEB",
              flexShrink: 0,
            }}
          >
            <div style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>
              {category?.name ?? "Spec"}
            </div>
            <div className="flex items-center gap-3">
              {spec && (
                <Link
                  href={`/specs/${spec.id}/edit`}
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 12, color: "#9A9590", textDecoration: "none",
                  }}
                >
                  <Pencil size={11} /> Edit
                </Link>
              )}
              <button
                onClick={onClose}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: "#F0EEEB", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#9A9590", flexShrink: 0,
                }}
                className="transition-colors hover:bg-[#E4E1DC]"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading || !data ? (
              /* Loading skeleton */
              <div style={{ padding: 28 }}>
                <div className="flex gap-6 animate-pulse">
                  <div style={{ width: 200, height: 200, borderRadius: 14, backgroundColor: "#F0EEEB", flexShrink: 0 }} />
                  <div className="flex-1 space-y-3 pt-2">
                    <div style={{ height: 10, width: 80, backgroundColor: "#F0EEEB", borderRadius: 4 }} />
                    <div style={{ height: 22, width: "65%", backgroundColor: "#F0EEEB", borderRadius: 6 }} />
                    <div style={{ height: 14, width: "85%", backgroundColor: "#F0EEEB", borderRadius: 4 }} />
                    <div style={{ height: 14, width: "70%", backgroundColor: "#F0EEEB", borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 28, display: "flex", gap: 28 }}>

                {/* ── Left column: image + meta ── */}
                <div style={{ width: 200, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 200, height: 200, borderRadius: 14,
                      backgroundColor: "#F0EEEB",
                      backgroundImage: spec?.image_url ? `url(${spec.image_url})` : undefined,
                      backgroundSize: "cover", backgroundPosition: "center",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
                    }}
                  >
                    {!spec?.image_url && <Package size={32} style={{ color: "#D4D2CF" }} />}
                  </div>

                  {/* Tags */}
                  {(tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {tags!.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-2 py-0.5"
                          style={{
                            backgroundColor: "#F0EEEB", borderRadius: 6,
                            fontFamily: "var(--font-inter), sans-serif",
                            fontSize: 10, color: "#9A9590",
                          }}
                        >
                          <Tag size={8} />{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Date */}
                  {createdDate && (
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 10 }}>
                      Added {createdDate}
                    </p>
                  )}

                  {/* Open full page link */}
                  {spec && (
                    <Link
                      href={`/specs/${spec.id}`}
                      className="flex items-center gap-1 mt-4 transition-opacity hover:opacity-60"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontSize: 11, color: "#C0BEBB", textDecoration: "none",
                      }}
                    >
                      Full page <ArrowRight size={10} />
                    </Link>
                  )}
                </div>

                {/* ── Right column: details ── */}
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Name + description */}
                  <h2
                    style={{
                      fontFamily: "var(--font-playfair), serif",
                      fontSize: 22, fontWeight: 700, color: "#1A1A1A",
                      lineHeight: 1.2, marginBottom: spec?.description ? 8 : 18,
                    }}
                  >
                    {spec?.name}
                  </h2>
                  {spec?.description && (
                    <p
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontSize: 13, color: "#9A9590", lineHeight: 1.6, marginBottom: 18,
                      }}
                    >
                      {spec.description}
                    </p>
                  )}

                  {/* Cost */}
                  {(spec?.cost_from || spec?.cost_to) && (
                    <div
                      style={{
                        padding: "12px 16px", backgroundColor: "#FAFAF9",
                        borderRadius: 10, border: "1px solid #F0EEEB",
                        marginBottom: 20,
                      }}
                    >
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                        Estimated cost
                      </p>
                      <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
                        {spec?.cost_from && spec?.cost_to
                          ? `£${Number(spec.cost_from).toLocaleString()} – £${Number(spec.cost_to).toLocaleString()}`
                          : spec?.cost_from
                            ? `from £${Number(spec.cost_from).toLocaleString()}`
                            : `up to £${Number(spec?.cost_to).toLocaleString()}`}
                        {spec?.cost_unit && (
                          <span style={{ fontSize: 12, fontWeight: 400, color: "#9A9590", marginLeft: 5 }}>
                            {spec.cost_unit}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Characteristics */}
                  {(fields ?? []).length > 0 && Object.keys(valueMap ?? {}).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        Characteristics
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 20 }}>
                        {fields!.map((field) => {
                          const val = valueMap![field.id];
                          if (!val) return null;
                          const isUrl = field.field_type === "url";
                          return (
                            <div key={field.id}>
                              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#B0AEA9", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                                {field.name}
                              </p>
                              {isUrl ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                                  style={{
                                    fontFamily: "var(--font-inter), sans-serif",
                                    fontSize: 11, fontWeight: 500, color: "#6B7280",
                                    textDecoration: "none", background: "#F0EEEB",
                                    borderRadius: 5, padding: "2px 7px",
                                  }}
                                >
                                  View <ExternalLink size={8} />
                                </a>
                              ) : (
                                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A", lineHeight: 1.4 }}>
                                  {val}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suppliers */}
                  {(suppliers ?? []).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        Supplier{suppliers!.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-col gap-2">
                        {suppliers!.map((sup) => (
                          <div
                            key={sup.id}
                            style={{
                              padding: "10px 14px", backgroundColor: "#FAFAF9",
                              borderRadius: 10, border: "1px solid #F0EEEB",
                            }}
                          >
                            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
                              {sup.name}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                              {sup.supplier_code && <span>Code: {sup.supplier_code}</span>}
                              {sup.unit_cost && <span>£{sup.unit_cost} / unit</span>}
                              {sup.website && (
                                <a
                                  href={sup.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 hover:underline"
                                  style={{ color: "#9A9590" }}
                                >
                                  Website <ExternalLink size={8} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {(projects ?? []).length > 0 && (
                    <div>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        Used in {projects!.length} project{projects!.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {projects!.map((project) => (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="flex items-center justify-between transition-shadow hover:shadow-sm"
                            style={{
                              padding: "8px 14px", backgroundColor: "#FAFAF9",
                              borderRadius: 8, border: "1px solid #F0EEEB",
                              textDecoration: "none",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {project.code && (
                                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#C0BEBB" }}>
                                  {project.code}
                                </span>
                              )}
                              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
                                {project.name}
                              </span>
                            </div>
                            <ArrowRight size={12} style={{ color: "#C0BEBB" }} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
