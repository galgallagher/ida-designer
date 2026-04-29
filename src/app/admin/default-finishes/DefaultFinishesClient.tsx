"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, Upload, X, ArrowLeft, Sparkles, ImagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDefaultFinish,
  updateDefaultFinish,
  deleteDefaultFinish,
  uploadDefaultFinishImage,
  copyDefaultsToAllStudios,
} from "./actions";
import type { DefaultFinishRow, MaterialCategory } from "@/types/database";
import { MATERIAL_CATEGORIES } from "@/types/database";

interface Props {
  finishes: DefaultFinishRow[];
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A",
  backgroundColor: "#FAFAF9", border: "1.5px solid #E4E1DC", borderRadius: 8,
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600,
  color: "#1A1A1A", marginBottom: 6, display: "block",
};

export default function DefaultFinishesClient({ finishes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DefaultFinishRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<string | null>(null);

  // Image picked in the dialog (uploaded after the row is created/updated)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const dialogFileRef = useRef<HTMLInputElement>(null);

  // Reset picker when dialog opens/closes or when editing changes
  useEffect(() => {
    if (!dialogOpen) {
      setImageFile(null);
      setImagePreview(null);
      if (dialogFileRef.current) dialogFileRef.current.value = "";
    }
  }, [dialogOpen]);

  function handleImagePick(file: File | null) {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) { setFormError("File must be an image."); return; }
    if (file.size > 4 * 1024 * 1024) { setFormError("Image must be under 4 MB."); return; }
    setFormError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  const grouped: Record<string, DefaultFinishRow[]> = {};
  for (const f of finishes) {
    (grouped[f.category] = grouped[f.category] ?? []).push(f);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = editing
        ? await updateDefaultFinish(editing.id, fd)
        : await createDefaultFinish(fd);
      if (res.error) { setFormError(res.error); return; }

      // Upload image if one was picked. For create we use the new id; for edit, the existing id.
      const targetId = editing?.id ?? ("id" in res ? res.id : undefined);
      if (imageFile && targetId) {
        const imgFd = new FormData();
        imgFd.set("file", imageFile);
        const imgRes = await uploadDefaultFinishImage(targetId, imgFd);
        if (imgRes.error) { setFormError(imgRes.error); return; }
      }

      setDialogOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this default finish? This won't remove it from existing studios.")) return;
    startTransition(async () => {
      await deleteDefaultFinish(id);
      router.refresh();
    });
  }

  function handleCopyToAll() {
    if (!confirm("Copy current defaults to ALL existing studios? This will add (not replace) materials. Run only when you've finished curating.")) return;
    setCopyResult(null);
    startTransition(async () => {
      const res = await copyDefaultsToAllStudios();
      if (res.error) setCopyResult(`Error: ${res.error}`);
      else setCopyResult(`Copied ${res.copied} rows across ${res.studios} studios.`);
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ padding: 32, gap: 16 }}>
      {/* Back link */}
      <Link
        href="/admin"
        className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
        style={{ color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, textDecoration: "none", width: "fit-content" }}
      >
        <ArrowLeft size={13} />
        Admin
      </Link>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
            Default Finishes
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", marginTop: 2 }}>
            {finishes.length} {finishes.length === 1 ? "finish" : "finishes"} · copied to every new studio on creation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyToAll}
            disabled={isPending || finishes.length === 0}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 34, paddingLeft: 12, paddingRight: 12, backgroundColor: "#fff", border: "1px solid #E4E1DC", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#1A1A1A", cursor: isPending || finishes.length === 0 ? "not-allowed" : "pointer", flexShrink: 0, fontFamily: "var(--font-inter), sans-serif" }}
            title="One-shot: add these defaults to every existing studio"
          >
            <Sparkles size={13} color="#9A9590" />
            Copy to all studios
          </button>
          <button
            onClick={() => { setEditing(null); setFormError(null); setDialogOpen(true); }}
            disabled={isPending}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 34, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0, fontFamily: "var(--font-inter), sans-serif" }}
          >
            <Plus size={14} />
            Add finish
          </button>
        </div>
      </div>

      {copyResult && (
        <div
          style={{
            padding: "10px 14px", borderRadius: 8,
            backgroundColor: copyResult.startsWith("Error") ? "#FEF2F2" : "#F0FDF4",
            color: copyResult.startsWith("Error") ? "#DC2626" : "#16A34A",
            fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500,
          }}
        >
          {copyResult}
        </div>
      )}

      {/* Empty state */}
      {finishes.length === 0 && (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            border: "2px dashed #E4E1DC", borderRadius: 14, padding: 48, textAlign: "center",
            backgroundColor: "#FFFFFF", marginTop: 24,
          }}
        >
          <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
            No defaults yet
          </h2>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", maxWidth: 420, lineHeight: 1.5 }}>
            Add finishes here to seed every new studio. Existing studios won&apos;t be affected unless you click &ldquo;Copy to all studios&rdquo;.
          </p>
        </div>
      )}

      {/* Grouped by category */}
      <div className="flex-1 overflow-auto flex flex-col gap-6">
        {MATERIAL_CATEGORIES.map(({ key, label }) => {
          const items = grouped[key] ?? [];
          if (items.length === 0) return null;

          return (
            <div key={key}>
              <p
                style={{
                  fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600,
                  color: "#9A9590", letterSpacing: "0.06em", textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {label} · {items.length}
              </p>
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {items.map((finish) => (
                  <FinishCard
                    key={finish.id}
                    finish={finish}
                    onEdit={() => { setEditing(finish); setFormError(null); setDialogOpen(true); }}
                    onDelete={() => handleDelete(finish.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setFormError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit finish" : "Add default finish"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3" style={{ marginTop: 10 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select name="category" defaultValue={editing?.category ?? "wood"} style={inputStyle}>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Image</label>
              <ImagePicker
                preview={imagePreview ?? editing?.image_url ?? null}
                hasNewFile={Boolean(imageFile)}
                onPick={() => dialogFileRef.current?.click()}
                onClear={() => handleImagePick(null)}
              />
              <input
                ref={dialogFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                name="description"
                defaultValue={editing?.description ?? ""}
                style={{ ...inputStyle, height: 80, padding: "10px 12px", resize: "vertical" }}
              />
            </div>

            {formError && (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#DC2626" }}>
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2" style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#fff", border: "1px solid #E4E1DC", borderRadius: 8, fontSize: 13, color: "#1A1A1A", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1A1A1A", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif" }}
              >
                {isPending ? "Saving…" : editing ? "Save" : "Add"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Finish card with image upload ─────────────────────────────────────────────

function FinishCard({
  finish,
  onEdit,
  onDelete,
}: {
  finish: DefaultFinishRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hover, setHover] = useState(false);
  const router = useRouter();

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadDefaultFinishImage(finish.id, fd);
    setUploading(false);
    if (res.error) alert(res.error);
    else router.refresh();
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      {/* Image */}
      <div
        className="relative flex items-center justify-center"
        style={{ aspectRatio: "1 / 1", backgroundColor: "#F5F3F0" }}
      >
        {finish.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={finish.image_url} alt={finish.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>
            No image
          </p>
        )}

        {hover && (
          <div className="absolute inset-0 flex items-center justify-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.85)" }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #E4E1DC", backgroundColor: "#fff", cursor: "pointer" }}
              title={finish.image_url ? "Replace image" : "Upload image"}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} color="#1A1A1A" />}
            </button>
            <button
              onClick={onEdit}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #E4E1DC", backgroundColor: "#fff", cursor: "pointer" }}
              title="Edit"
            >
              <Pencil size={13} color="#1A1A1A" />
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #E4E1DC", backgroundColor: "#fff", cursor: "pointer" }}
              title="Delete"
            >
              <Trash2 size={13} color="#DC2626" />
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
      </div>

      {/* Name + category */}
      <div style={{ padding: "10px 12px" }}>
        <p
          className="truncate"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
        >
          {finish.name}
        </p>
        <p
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}
        >
          {finish.category}
        </p>
      </div>
    </div>
  );
}

// Suppress unused import warnings for icons used inside Dialog only conditionally
void X;

// ── Image picker (used inside the Add/Edit dialog) ────────────────────────────

function ImagePicker({
  preview,
  hasNewFile,
  onPick,
  onClear,
}: {
  preview: string | null;
  hasNewFile: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  if (preview) {
    return (
      <div
        className="relative"
        style={{
          width: "100%", aspectRatio: "16 / 9",
          borderRadius: 8, border: "1.5px solid #E4E1DC",
          overflow: "hidden", backgroundColor: "#F5F3F0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />

        {/* Overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(255,255,255,0.85)" }}
        >
          <button
            type="button"
            onClick={onPick}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 32, paddingLeft: 12, paddingRight: 12, borderRadius: 7, border: "1px solid #E4E1DC", backgroundColor: "#fff", cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#1A1A1A" }}
          >
            <Upload size={12} />
            Replace
          </button>
          {hasNewFile && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid #E4E1DC", backgroundColor: "#fff", cursor: "pointer" }}
              title="Discard new image"
            >
              <X size={12} color="#9A9590" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex flex-col items-center justify-center gap-1.5 transition-colors"
      style={{
        width: "100%", aspectRatio: "16 / 9",
        borderRadius: 8, border: "1.5px dashed #E4E1DC",
        backgroundColor: "#FAFAF9", cursor: "pointer", color: "#9A9590",
        fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500,
      }}
    >
      <ImagePlus size={20} />
      Click to upload
      <span style={{ fontSize: 10, color: "#C0BEBB" }}>PNG/JPG · max 4 MB</span>
    </button>
  );
}
