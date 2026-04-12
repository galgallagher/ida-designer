"use client";

/**
 * SpecDetailModal
 *
 * Opens as an overlay when a spec tile is clicked in the library.
 * Fetches spec data via the getSpecDetail server action.
 * Close with the X button, Escape key, or clicking the backdrop.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ExternalLink, Package, Pencil, ArrowRight, Trash2 } from "lucide-react";
import { getSpecDetail, deleteSpec, type SpecDetailData } from "./actions";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  specId: string | null;
  onClose: () => void;
}

export default function SpecDetailModal({ specId, onClose }: Props) {
  const [data, setData] = useState<SpecDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);


  // Fetch data whenever specId changes; reset delete state on open/close
  useEffect(() => {
    setConfirmDelete(false);
    setDeleteError(null);
    setLightboxOpen(false);
    if (!specId) {
      setData(null);
      return;
    }
    setLoading(true);
    getSpecDetail(specId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [specId]);

  async function handleDelete() {
    if (!spec) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteSpec(spec.id);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      setConfirmDelete(false);
    } else {
      onClose();
    }
  }

  const { spec, category, fields, valueMap, tags, suppliers, projects } = data ?? {};
  const createdDate = spec
    ? new Date(spec.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  // Lightbox — portalled to document.body so it escapes the Dialog's CSS transform
  const lightbox = lightboxOpen && spec?.image_url
    ? createPortal(
        <div
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
          onPointerDown={(e) => e.nativeEvent.stopImmediatePropagation()}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spec.image_url}
            alt={spec.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "auto",
              height: "auto",
              display: "block",
              borderRadius: 12,
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              cursor: "default",
            }}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              position: "fixed", top: 20, right: 20,
              background: "rgba(255,255,255,0.15)", border: "none",
              borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#FFFFFF",
            }}
          >
            <X size={18} />
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
    {lightbox}
    <Dialog open={!!specId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="[&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => { if (lightboxOpen) { e.preventDefault(); setLightboxOpen(false); } }}
        style={{
          maxWidth: 800,
          maxHeight: "calc(100vh - 48px)",
          padding: 0,
          overflow: "hidden",
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
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
            {/* Delete error inline */}
            {deleteError && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#EF4444", maxWidth: 260 }}>
                {deleteError}
              </p>
            )}

            {/* Confirm delete prompt */}
            {confirmDelete && !deleteError ? (
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
                  Delete this spec?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    height: 26, paddingLeft: 10, paddingRight: 10,
                    backgroundColor: "#EF4444", border: "none", borderRadius: 6,
                    fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600,
                    color: "#FFFFFF", cursor: deleting ? "default" : "pointer",
                  }}
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    height: 26, paddingLeft: 10, paddingRight: 10,
                    backgroundColor: "#F0EEEB", border: "none", borderRadius: 6,
                    fontFamily: "var(--font-inter), sans-serif", fontSize: 11,
                    color: "#9A9590", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {spec && !deleteError && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    title="Delete spec"
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      backgroundColor: "transparent", border: "none",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#C0BEBB",
                    }}
                    className="transition-colors hover:bg-[#FEE2E2] hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
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
              </>
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
                <button
                  type="button"
                  onClick={() => spec?.image_url && setLightboxOpen(true)}
                  style={{
                    width: 200, height: 200, borderRadius: 14, padding: 0, border: "none",
                    backgroundColor: "#F0EEEB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
                    cursor: spec?.image_url ? "zoom-in" : "default",
                    overflow: "hidden",
                  }}
                >
                  {spec?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spec.image_url}
                      alt={spec.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />
                  ) : (
                    <Package size={32} style={{ color: "#D4D2CF" }} />
                  )}
                </button>

                {/* Date */}
                {createdDate && (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB", marginTop: 10 }}>
                    Added {createdDate}
                  </p>
                )}

                {/* Global library badge */}
                {spec?.global_spec_id && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10,
                    padding: "3px 8px", borderRadius: 6,
                    background: "#F5F3FF", border: "1px solid #E0DAFF",
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, color: "#7C3AED", fontWeight: 500, letterSpacing: "0.02em" }}>
                      Shared library
                    </span>
                  </div>
                )}

                {/* Product page link */}
                {spec?.source_url && (
                  <a
                    href={spec.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70 mt-3"
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "1px solid #E4E1DC",
                      backgroundColor: "#FFFFFF",
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: 12, fontWeight: 500, color: "#1A1A1A",
                      textDecoration: "none", display: "inline-flex",
                    }}
                  >
                    View product <ExternalLink size={10} />
                  </a>
                )}

                {/* Open full page link */}
                {spec && (
                  <Link
                    href={`/specs/${spec.id}`}
                    className="flex items-center gap-1 mt-3 transition-opacity hover:opacity-60"
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

                {/* Characteristics — always show all template fields; empty ones show a dash */}
                {(fields ?? []).length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Characteristics
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 20 }}>
                      {fields!.map((field) => {
                        const val = valueMap![field.id];
                        const isUrl = field.field_type === "url";
                        return (
                          <div key={field.id}>
                            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#B0AEA9", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                              {field.name}
                            </p>
                            {val ? (
                              isUrl ? (
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
                              )
                            ) : (
                              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#D4D2CF", lineHeight: 1.4 }}>
                                —
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
                          {(sup.supplier_code || sup.unit_cost) && (
                            <div className="flex items-center gap-3 mt-0.5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                              {sup.supplier_code && <span>Code: {sup.supplier_code}</span>}
                              {sup.unit_cost && <span>£{sup.unit_cost} / unit</span>}
                            </div>
                          )}
                          {sup.website && (
                            <a
                              href={sup.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                              style={{
                                marginTop: 8,
                                padding: "5px 12px",
                                borderRadius: 8,
                                border: "1px solid #E4E1DC",
                                backgroundColor: "#FFFFFF",
                                fontFamily: "var(--font-inter), sans-serif",
                                fontSize: 12,
                                fontWeight: 500,
                                color: "#1A1A1A",
                                textDecoration: "none",
                              }}
                            >
                              Visit website <ExternalLink size={10} />
                            </a>
                          )}
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
      </DialogContent>
    </Dialog>
    </>
  );
}
