"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Package, X, Search, Trash2, ImageIcon } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addSpecToProject, removeSpecFromProject } from "./actions";
import { tagProjectImage, deleteProjectImage } from "../canvas/actions";
import SpecDetailModal from "@/app/specs/SpecDetailModal";
import type { ProjectImageRow, ProjectImageType } from "@/types/database";

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

type ProjectOptionRow = {
  id: string;
  spec_id: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

interface Props {
  projectId: string;
  projectName: string;
  projectSpecs: ProjectOptionRow[];
  librarySpecs: SpecDetail[];
  alreadyAddedIds: string[];
  images: ProjectImageRow[];
  section: string | null;
}

type ActiveSection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "inspiration" }
  | { kind: "sketch" };

function parseSection(s: string | null): ActiveSection {
  if (!s) return { kind: "all" };
  if (s === "inspiration") return { kind: "inspiration" };
  if (s === "sketch") return { kind: "sketch" };
  return { kind: "category", name: decodeURIComponent(s) };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProjectOptionsClient({
  projectId,
  projectName,
  projectSpecs,
  librarySpecs,
  alreadyAddedIds,
  images: initialImages,
  section,
}: Props) {
  const [openSpecId, setOpenSpecId]           = useState<string | null>(null);
  const [dialogOpen, setDialogOpen]           = useState(false);
  const [search, setSearch]                   = useState("");
  const [addError, setAddError]               = useState<string | null>(null);
  const [isPending, startTransition]          = useTransition();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [images, setImages]                   = useState(initialImages);

  const active = parseSection(section);

  const specDetailMap = useMemo(() => {
    const m = new Map<string, SpecDetail>();
    librarySpecs.forEach((s) => m.set(s.id, s));
    return m;
  }, [librarySpecs]);

  const excludedIds = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  const totalSpecs = projectSpecs.length;

  const filteredLibrary = useMemo(() => {
    const q = search.toLowerCase().trim();
    return librarySpecs.filter(
      (s) => !excludedIds.has(s.id) && (q === "" || s.name.toLowerCase().includes(q)),
    );
  }, [librarySpecs, search, excludedIds]);

  // Specs visible for the active section
  const visibleSpecs = useMemo(() => {
    if (active.kind === "inspiration" || active.kind === "sketch") return [];
    return projectSpecs.filter((ps) => {
      const spec = ps.spec_id ? specDetailMap.get(ps.spec_id) : null;
      if (active.kind === "all") return true;
      return (spec?.category_name ?? null) === active.name;
    });
  }, [active, projectSpecs, specDetailMap]);

  // Images visible for the active section
  const visibleImages = useMemo(() => {
    if (active.kind === "inspiration") return images.filter((i) => i.type === "inspiration");
    if (active.kind === "sketch")      return images.filter((i) => i.type === "sketch");
    return [];
  }, [active, images]);

  const isImageSection = active.kind === "inspiration" || active.kind === "sketch";

  function handleAdd(specId: string) {
    setAddError(null);
    startTransition(async () => {
      const result = await addSpecToProject(projectId, { spec_id: specId });
      if (result.error) setAddError(result.error);
      else { setDialogOpen(false); setSearch(""); }
    });
  }

  function handleRemoveConfirmed() {
    if (!confirmRemoveId) return;
    const id = confirmRemoveId;
    setConfirmRemoveId(null);
    startTransition(async () => { await removeSpecFromProject(id, projectId); });
  }

  async function handleRetag(imageId: string, newType: ProjectImageType) {
    const { error } = await tagProjectImage(imageId, newType);
    if (!error) setImages((prev) => prev.map((img) => img.id === imageId ? { ...img, type: newType } : img));
  }

  async function handleDeleteImage(imageId: string) {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    await deleteProjectImage(imageId);
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "var(--font-inter), sans-serif", backgroundColor: "#EDEDED" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-8 flex-shrink-0"
        style={{ height: 64, backgroundColor: "#FFFFFF", borderBottom: "1px solid #E4E1DC" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
            Project Options
          </h1>
          <p style={{ fontSize: 12, color: "#9A9590", marginTop: 1 }}>{projectName}</p>
        </div>
        <button
          type="button"
          onClick={() => { setDialogOpen(true); setSearch(""); setAddError(null); }}
          disabled={isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 34, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add item
        </button>
      </div>

      {/* ── Content area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* Spec cards (all / category views) */}
          {!isImageSection && (
            visibleSpecs.length === 0 ? (
              active.kind === "all" && totalSpecs === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 text-center"
                  style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
                >
                  <div className="flex items-center justify-center mb-4" style={{ width: 48, height: 48, backgroundColor: "#F0EEEB", borderRadius: 12 }}>
                    <Package size={20} style={{ color: "#9A9590" }} />
                  </div>
                  <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
                    No items yet
                  </p>
                  <p style={{ fontSize: 13, color: "#9A9590", marginBottom: 20, lineHeight: 1.6, maxWidth: 320 }}>
                    Add materials, finishes, and products from your studio library to this project.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setDialogOpen(true); setSearch(""); setAddError(null); }}
                    className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                    style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
                  >
                    <Plus size={14} />
                    Add first item
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon={<Package size={28} style={{ color: "#C0BEBB" }} />}
                  message="No items in this category yet."
                />
              )
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {visibleSpecs.map((ps) => {
                  const spec = ps.spec_id ? specDetailMap.get(ps.spec_id) : null;
                  if (!spec) return null;
                  return (
                    <LibraryCard
                      key={ps.id}
                      projectSpecId={ps.id}
                      spec={spec}
                      onOpen={() => setOpenSpecId(spec.id)}
                      onRemove={() => setConfirmRemoveId(ps.id)}
                      isPending={isPending}
                    />
                  );
                })}
              </div>
            )
          )}

          {/* Image grid (inspiration / sketch) */}
          {isImageSection && (
            visibleImages.length === 0 ? (
              <EmptyState
                icon={<ImageIcon size={28} style={{ color: "#C0BEBB" }} />}
                message={active.kind === "inspiration"
                  ? "No inspiration images yet. Paste or drop images on the canvas and tag them."
                  : "No sketches yet. Paste or drop images on the canvas and tag them as Sketch."}
              />
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {visibleImages.map((img) => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    onRetag={handleRetag}
                    onDelete={handleDeleteImage}
                  />
                ))}
              </div>
            )
          )}
      </div>

      {/* ── Spec detail modal ──────────────────────────────────────────────── */}
      {openSpecId && (
        <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />
      )}

      {/* ── Remove confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={!!confirmRemoveId} onOpenChange={(open) => { if (!open) setConfirmRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "var(--font-playfair), serif" }}>
              Remove from project?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ lineHeight: 1.6 }}>
              This will remove the item from Project Options and delete all instances of it from every canvas in this project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirmed}
              style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
            >
              <Trash2 size={13} style={{ marginRight: 6 }} />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add item dialog ────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setSearch(""); setAddError(null); } }}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20 }}>
              Add to options
            </DialogTitle>
          </DialogHeader>

          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#C0BEBB", pointerEvents: "none" }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your studio library…"
              style={{ width: "100%", height: 38, paddingLeft: 32, paddingRight: 12, fontSize: 13, color: "#1A1A1A", backgroundColor: "#FAFAF9", border: "1.5px solid #E4E1DC", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {addError && (
            <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 8 }}>{addError}</p>
          )}

          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredLibrary.length === 0 ? (
              <p style={{ fontSize: 13, color: "#C0BEBB", padding: "12px 4px" }}>
                {search ? "No matching items." : "All items from your library are already in this project."}
              </p>
            ) : (
              filteredLibrary.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => handleAdd(spec.id)}
                  disabled={isPending}
                  className="flex items-center gap-3 text-left transition-colors hover:bg-black/[0.04]"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "none", cursor: "pointer", width: "100%" }}
                >
                  {spec.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={spec.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: "#F0EEEB", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {spec.name}
                    </p>
                    {spec.category_name && (
                      <p style={{ fontSize: 11, color: "#9A9590" }}>{spec.category_name}</p>
                    )}
                  </div>
                  <Plus size={14} style={{ color: "#C0BEBB", flexShrink: 0 }} />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared empty state ────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon}
      <p style={{ fontSize: 13, color: "#9A9590", maxWidth: 340, lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}

// ── LibraryCard ───────────────────────────────────────────────────────────────

function LibraryCard({
  spec,
  onOpen,
  onRemove,
  isPending,
}: {
  projectSpecId: string;
  spec: SpecDetail;
  onOpen: () => void;
  onRemove: () => void;
  isPending: boolean;
}) {
  return (
    <div className="group relative" style={{ background: "none", padding: 0 }}>
      <button
        type="button"
        onClick={onOpen}
        className="text-left w-full"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <div className="bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-md" style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}>
          <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: "#F0EEEB", backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              {!spec.image_url && <Package size={20} style={{ color: "#D4D2CF" }} />}
            </div>
          </div>
          <div className="p-2.5 flex flex-col gap-1" style={{ minHeight: 72 }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: "#C0BEBB", textTransform: "uppercase", letterSpacing: "0.07em", visibility: spec.category_name ? "visible" : "hidden" }}>
              {spec.category_name ?? "·"}
            </p>
            <p className="font-semibold" style={{ fontSize: 12, color: "#1A1A1A", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {spec.name}
            </p>
            <p style={{ fontSize: 10, color: "#C0BEBB", letterSpacing: "0.02em", visibility: spec.code ? "visible" : "hidden" }}>
              {spec.code ?? "·"}
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={isPending}
        title="Remove from project"
        className="absolute top-2 right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.9)", cursor: "pointer", color: "#9A9590", zIndex: 1 }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── ImageCard ─────────────────────────────────────────────────────────────────

function ImageCard({
  image,
  onRetag,
  onDelete,
}: {
  image: ProjectImageRow;
  onRetag: (id: string, type: ProjectImageType) => void;
  onDelete: (id: string) => void;
}) {
  const otherType: ProjectImageType = image.type === "inspiration" ? "sketch" : "inspiration";
  const otherLabel = image.type === "inspiration" ? "Move to Sketches" : "Move to Inspiration";

  return (
    <div
      className="group relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderRadius: 12, boxShadow: "0 2px 8px rgba(26,26,26,0.06)" }}
    >
      <div className="relative flex-shrink-0" style={{ paddingTop: "100%" }}>
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "12px 12px 0 0" }}>
          <Image src={image.url} alt="" fill sizes="(max-width: 1280px) 33vw, 20vw" className="object-cover" unoptimized />
        </div>
      </div>

      <div
        className="absolute left-0 right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col"
        style={{ bottom: 37, background: "linear-gradient(to top, rgba(26,26,26,0.55) 0%, transparent 55%)" }}
      >
        <button
          onClick={() => onDelete(image.id)}
          className="absolute top-2 right-2 flex items-center justify-center rounded-lg transition-colors hover:bg-red-600"
          style={{ width: 28, height: 28, backgroundColor: "rgba(26,26,26,0.65)", border: "none", cursor: "pointer", color: "#FFFFFF" }}
          title="Delete image"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={() => onRetag(image.id, otherType)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg whitespace-nowrap"
          style={{ fontSize: 11, fontWeight: 600, backgroundColor: "rgba(255,255,255,0.92)", color: "#1A1A1A", border: "none", cursor: "pointer" }}
        >
          {otherLabel}
        </button>
      </div>

      <div className="px-3 py-2" style={{ borderTop: "1px solid #F0EDEA", height: 37, boxSizing: "border-box" }}>
        <p style={{ fontSize: 11, color: "#9A9590" }}>
          {new Date(image.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
