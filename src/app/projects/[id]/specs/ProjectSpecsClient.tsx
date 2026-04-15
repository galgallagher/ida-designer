"use client";

/**
 * ProjectSpecsClient — /projects/[id]/specs (Project Library)
 *
 * Flat grid of all products and materials being considered for this project.
 * Items are added from the studio library with a single click — no schedule
 * assignment at this stage. Schedule assignment happens on the Specs tab.
 */

import { useState, useTransition, useMemo } from "react";
import { Plus, Package, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addSpecToProject, removeSpecFromProject } from "./actions";
import SpecDetailModal from "@/app/specs/SpecDetailModal";
import type { ProjectSpecRow } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

type SpecDetail = {
  id: string;
  name: string;
  code: string | null;
  image_url: string | null;
  category_name: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
};

interface Props {
  projectId: string;
  projectName: string;
  projectSpecs: ProjectSpecRow[];
  librarySpecs: SpecDetail[];
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProjectSpecsClient({
  projectId,
  projectName,
  projectSpecs,
  librarySpecs,
}: Props) {
  const [openSpecId, setOpenSpecId]   = useState<string | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [search, setSearch]           = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Derived data ──────────────────────────────────────────────────────────────

  // Build a map for fast spec detail lookups
  const specDetailMap = useMemo(() => {
    const map = new Map<string, SpecDetail>();
    librarySpecs.forEach((s) => map.set(s.id, s));
    return map;
  }, [librarySpecs]);

  // Spec IDs already in the project (exclude from picker)
  const addedSpecIds = useMemo(
    () => new Set(projectSpecs.map((ps) => ps.spec_id)),
    [projectSpecs]
  );

  // Filtered library for the picker
  const filteredLibrary = useMemo(() => {
    const q = search.toLowerCase().trim();
    return librarySpecs.filter(
      (s) => !addedSpecIds.has(s.id) && (q === "" || s.name.toLowerCase().includes(q))
    );
  }, [librarySpecs, search, addedSpecIds]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function openDialog() {
    setSearch("");
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSearch("");
    setError(null);
  }

  function pickSpec(spec: SpecDetail) {
    setError(null);
    startTransition(async () => {
      const result = await addSpecToProject(projectId, { spec_id: spec.id });
      if (result.error) {
        setError(result.error);
      } else {
        closeDialog();
      }
    });
  }

  function handleRemove(projectSpecId: string) {
    if (!window.confirm("Remove this spec from the project?")) return;
    startTransition(async () => {
      await removeSpecFromProject(projectSpecId, projectId);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Project Library
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
            {projectSpecs.length > 0 && (
              <span style={{ marginLeft: 8, backgroundColor: "#F0EEEB", borderRadius: 20, padding: "1px 8px" }}>
                {projectSpecs.length}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          disabled={isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add to library
        </button>
      </div>

      {/* ── Flat grid ──────────────────────────────────────────────────────── */}
      {projectSpecs.length > 0 ? (
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {projectSpecs.map((ps) => (
            <SpecCard
              key={ps.id}
              projectSpec={ps}
              spec={specDetailMap.get(ps.spec_id) ?? null}
              onRemove={handleRemove}
              onOpen={setOpenSpecId}
              isPending={isPending}
            />
          ))}
        </div>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          style={{ borderRadius: 16, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <div className="flex items-center justify-center mb-4" style={{ width: 52, height: 52, backgroundColor: "#F0EEEB", borderRadius: 14 }}>
            <Package size={22} style={{ color: "#9A9590" }} />
          </div>
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>
            No items yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 24, lineHeight: 1.6, maxWidth: 320 }}>
            Add products and materials from your studio library. Assign them to schedules once you're ready.
          </p>
          <button
            type="button"
            onClick={openDialog}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 38, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
          >
            <Plus size={14} />
            Add first item
          </button>
        </div>
      )}

      {/* ── Spec detail modal ─────────────────────────────────────────────── */}
      <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />

      {/* ── Add to library dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              Add to library
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your studio library…"
              style={{
                width: "100%",
                height: 38,
                paddingLeft: 12,
                paddingRight: 12,
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#1A1A1A",
                backgroundColor: "#FAFAF9",
                border: "1.5px solid #E4E1DC",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626" }}>
                {error}
              </p>
            )}

            <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 380, minHeight: 80 }}>
              {filteredLibrary.length === 0 ? (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", textAlign: "center", padding: "28px 0" }}>
                  {librarySpecs.length === 0
                    ? "Your studio library is empty. Use Ida to add products first."
                    : search
                    ? "No matching items."
                    : "All library items are already in this project."}
                </p>
              ) : (
                filteredLibrary.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => pickSpec(spec)}
                    disabled={isPending}
                    className="flex items-center gap-3 text-left transition-colors hover:bg-black/[0.04]"
                    style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "none", cursor: "pointer", width: "100%" }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#F0EEEB", overflow: "hidden" }}
                    >
                      {spec.image_url ? (
                        <img src={spec.image_url} alt={spec.name} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                      ) : (
                        <Package size={16} style={{ color: "#C0BEBB" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {spec.name}
                      </p>
                      {spec.category_name && (
                        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
                          {spec.category_name}
                        </p>
                      )}
                    </div>
                    {isPending && <Loader2 size={13} className="animate-spin" style={{ color: "#9A9590", flexShrink: 0 }} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SpecCard ───────────────────────────────────────────────────────────────────

function SpecCard({
  projectSpec,
  spec,
  onRemove,
  onOpen,
  isPending,
}: {
  projectSpec: ProjectSpecRow;
  spec: SpecDetail | null;
  onRemove: (id: string) => void;
  onOpen: (specId: string) => void;
  isPending: boolean;
}) {
  return (
    <div
      className="group relative text-left w-full"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      onClick={() => onOpen(projectSpec.spec_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(projectSpec.spec_id); }}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(projectSpec.id); }}
        disabled={isPending}
        title="Remove from project"
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{
          top: 8, right: 8,
          width: 24, height: 24,
          border: "none",
          background: "rgba(26,26,26,0.55)",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          padding: 0,
          backdropFilter: "blur(4px)",
        }}
      >
        <X size={11} />
      </button>

      <div
        className="bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-md"
        style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}
      >
        {/* Square image */}
        <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backgroundColor: "#F0EEEB",
              backgroundImage: spec?.image_url ? `url(${spec.image_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!spec?.image_url && <Package size={20} style={{ color: "#D4D2CF" }} />}
          </div>
        </div>

        {/* Text */}
        <div className="p-2.5 flex flex-col gap-1">
          {spec?.category_name && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 9, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {spec.category_name}
            </p>
          )}
          <p
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {spec?.name ?? "Unknown"}
          </p>
          {spec?.code && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#C0BEBB" }}>
              {spec.code}
            </p>
          )}
          {(spec?.cost_from || spec?.cost_to) && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}>
              {spec!.cost_from && spec!.cost_to
                ? `£${spec!.cost_from} – £${spec!.cost_to}`
                : spec!.cost_from ? `from £${spec!.cost_from}` : `up to £${spec!.cost_to}`}
              {spec!.cost_unit && ` ${spec!.cost_unit}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
