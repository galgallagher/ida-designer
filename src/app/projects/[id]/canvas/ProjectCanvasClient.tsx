"use client";

/**
 * ProjectCanvasClient — the main canvas UI.
 *
 * Wraps tldraw with:
 * - Multi-canvas tab bar (create, rename, delete, switch)
 * - Auto-save (debounced 1.5s after every change)
 * - Image upload on drop/paste (→ Supabase Storage)
 * - URL scrape bar → scrapes product, saves to library, adds to project,
 *   places product image on the canvas
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Link2, X, Check, Package, FileText, ChevronDown, Download } from "lucide-react";
import {
  saveCanvasContent,
  loadCanvasContent,
  createCanvas,
  renameCanvas,
  deleteCanvas,
  uploadCanvasImage,
  type LibrarySpecLite,
} from "./actions";
import type { Json } from "@/types/database";
import type { Editor } from "tldraw";
import { createShapeId } from "tldraw";
import SpecDetailModal from "@/app/specs/SpecDetailModal";
import LibraryPickerModal from "./LibraryPickerModal";
import { addSpecToProject } from "../options/actions";

// Lazy-load tldraw to keep bundle size down on other pages
const TldrawCanvas = dynamic(() => import("./TldrawCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#F5F4F2" }}>
      <Loader2 size={24} className="animate-spin" style={{ color: "#9A9590" }} />
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanvasMeta {
  id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  projectId: string;
  studioId: string;
  canvases: CanvasMeta[];
}

interface ScrapeCardResult {
  spec_id: string;
  name: string;
  brand?: string | null;
  code?: string | null;
  category_name?: string | null;
  image_url?: string | null;
  cost_from?: number | null;
  cost_to?: number | null;
  cost_unit?: string | null;
  source_url: string;
  already_existed: boolean;
  added_to_project: boolean;
}

// ── Paper-size presets ────────────────────────────────────────────────────────
// Dimensions in pixels at 96 DPI — that's the ratio browsers/tldraw use when
// mapping CSS pixels to real-world units, so a frame at these sizes prints
// at true A4/A3 at 100% scale.
interface SheetPreset {
  label: string;
  paper: string;            // "A4", "A3" — used as display name on the frame
  orientation: "P" | "L";   // portrait / landscape (for the frame name suffix)
  w: number;
  h: number;
}

const SHEET_PRESETS: SheetPreset[] = [
  { label: "A4 Portrait",  paper: "A4", orientation: "P", w:  794, h: 1123 },
  { label: "A4 Landscape", paper: "A4", orientation: "L", w: 1123, h:  794 },
  { label: "A3 Portrait",  paper: "A3", orientation: "P", w: 1123, h: 1587 },
  { label: "A3 Landscape", paper: "A3", orientation: "L", w: 1587, h: 1123 },
];

// Convert pixels at 96 DPI back to millimetres (for the subtle dim label).
const pxToMm = (px: number) => Math.round((px / 96) * 25.4);

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectCanvasClient({ projectId, studioId, canvases: initialCanvases }: Props) {
  const [canvases, setCanvases] = useState<CanvasMeta[]>(initialCanvases);
  const [activeCanvasId, setActiveCanvasId] = useState<string>(initialCanvases[0]?.id ?? "");
  const [canvasContent, setCanvasContent] = useState<Json | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Spec detail modal
  const [openSpecId, setOpenSpecId] = useState<string | null>(null);

  // Library picker modal
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  // Tracks how many cards we've placed from the picker in this session, so
  // successive picks offset from the viewport centre instead of stacking.
  const libraryPlacementCountRef = useRef(0);

  // "Add sheet" dropdown (A4/A3 frame presets)
  const [sheetMenuOpen, setSheetMenuOpen] = useState(false);
  const sheetMenuRef = useRef<HTMLDivElement>(null);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportIsError, setExportIsError] = useState(false);

  // Image upload error
  const [uploadError, setUploadError] = useState<string | null>(null);

  // URL scraping state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  // ── Load canvas content when active canvas changes ──────────────────────────

  useEffect(() => {
    if (!activeCanvasId) return;
    let cancelled = false;

    setIsLoading(true);
    loadCanvasContent(activeCanvasId).then(({ content }) => {
      if (cancelled) return;
      setCanvasContent(content);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeCanvasId]);

  // ── Close dropdown on outside click ─────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpenId]);

  // Focus URL input when opened
  useEffect(() => {
    if (showUrlInput && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [showUrlInput]);

  // ── Listen for Ida widget spec-saved events ─────────────────────────────────
  // When the user saves a spec via Ida chat, place it on the active canvas.

  useEffect(() => {
    function handleIdaSpecSaved(e: Event) {
      const detail = (e as CustomEvent).detail as ScrapeCardResult | null;
      if (!detail) return;
      placeProductOnCanvas(detail);
    }
    window.addEventListener("ida:spec-saved", handleIdaSpecSaved);
    return () => window.removeEventListener("ida:spec-saved", handleIdaSpecSaved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for spec-card click events from the custom tldraw shape ─────────
  // The SpecCardShape component dispatches `canvas:open-spec` on click because
  // threading a React callback through tldraw's shape registry is awkward.

  useEffect(() => {
    function handleOpenSpec(e: Event) {
      const detail = (e as CustomEvent).detail as { specId?: string } | null;
      if (detail?.specId) setOpenSpecId(detail.specId);
    }
    window.addEventListener("canvas:open-spec", handleOpenSpec);
    return () => window.removeEventListener("canvas:open-spec", handleOpenSpec);
  }, []);

  // ── Auto-save handler (called from TldrawCanvas on change) ──────────────────

  const handleSave = useCallback(
    async (content: Json) => {
      if (!activeCanvasId) return;
      await saveCanvasContent(activeCanvasId, content);
    },
    [activeCanvasId],
  );

  // ── Image upload handler (called from TldrawCanvas on file drop/paste) ──────

  const handleImageUpload = useCallback(
    async (file: File): Promise<{ url: string; imageId: string | null } | null> => {
      if (!activeCanvasId) return null;
      const fd = new FormData();
      fd.append("file", file);
      const { url, imageId, error } = await uploadCanvasImage(activeCanvasId, projectId, fd);
      if (error || !url) {
        console.error("[handleImageUpload]", error);
        return null;
      }
      return { url, imageId };
    },
    [activeCanvasId, projectId],
  );


  // ── Image upload error handler ──────────────────────────────────────────────

  const handleUploadError = useCallback((message: string) => {
    setUploadError(message);
    setTimeout(() => setUploadError(null), 5000);
  }, []);

  // ── Editor ref callback ─────────────────────────────────────────────────────
  // Click-to-open is handled inside the SpecCardShape component itself — it
  // dispatches a window event we listen for above. So this callback just
  // captures the editor reference.

  const handleEditorMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // ── URL scrape handler ──────────────────────────────────────────────────────

  async function handleUrlSubmit() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      setScrapeStatus("Please enter a valid URL");
      return;
    }

    setIsScraping(true);
    setScrapeStatus("Scraping product page...");

    try {
      const res = await fetch("/api/canvas/scrape-and-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, project_id: projectId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setScrapeStatus(err.error ?? "Scraping failed");
        setIsScraping(false);
        return;
      }

      const result: ScrapeCardResult = await res.json();
      setScrapeStatus(null);

      // Place the product on the canvas
      await placeProductOnCanvas(result);

      // Success feedback
      const msg = result.already_existed
        ? `"${result.name}" was already in your library`
        : `"${result.name}" added to library & project`;
      setScrapeStatus(msg);
      setUrlValue("");

      // Clear status after 3 seconds
      setTimeout(() => setScrapeStatus(null), 3000);
    } catch (err) {
      console.error("[handleUrlSubmit]", err);
      setScrapeStatus("Something went wrong. Try again.");
    } finally {
      setIsScraping(false);
    }
  }

  // ── Place a scraped product on the canvas as a note + image ─────────────────

  async function placeProductOnCanvas(result: ScrapeCardResult) {
    const editor = editorRef.current;
    if (!editor) return;

    // Find the center of the current viewport
    const viewportBounds = editor.getViewportScreenBounds();
    const center = editor.screenToPage({
      x: viewportBounds.x + viewportBounds.w / 2,
      y: viewportBounds.y + viewportBounds.h / 2,
    });

    // Card dimensions:
    // - Width: fixed 240px (matches Project Options card feel).
    // - Height: matches image aspect (image-only by default, no text footer).
    //   User can toggle the info footer on via the "i" button on the card,
    //   which grows the card by 68px.
    const CARD_W = 240;
    let cardH = 240;

    if (result.image_url) {
      try {
        const img = new Image();
        const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 300, h: 300 });
          img.src = result.image_url!;
        });

        const aspect = dimensions.h / dimensions.w;
        cardH = Math.min(Math.max(CARD_W * aspect, 160), 320);
      } catch (err) {
        console.error("[placeProductOnCanvas] image sizing failed:", err);
        // Fall through with default cardH — still place the card.
      }
    }

    editor.createShape({
      id: createShapeId(),
      type: "spec-card",
      x: center.x - CARD_W / 2,
      y: center.y - cardH / 2,
      props: {
        w: CARD_W,
        h: cardH,
        imageUrl: result.image_url ?? "",
        specId: result.spec_id,
        specName: result.name,
        code: result.code ?? "",
        category: result.category_name ?? "",
        showInfo: false,
      },
    });
  }

  // ── Place a library spec on canvas (from the picker modal) ─────────────────

  async function handleLibrarySpecSelect(spec: LibrarySpecLite) {
    const editor = editorRef.current;
    if (!editor) return;

    // Size the card from the image's natural aspect (same logic as scrape flow).
    const CARD_W = 240;
    let cardH = 240;
    if (spec.image_url) {
      try {
        const img = new Image();
        const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 300, h: 300 });
          img.src = spec.image_url!;
        });
        const aspect = dimensions.h / dimensions.w;
        cardH = Math.min(Math.max(CARD_W * aspect, 160), 320);
      } catch {
        /* fall through with default cardH */
      }
    }

    // Place near the viewport centre, offsetting successive picks so they
    // don't all stack on the exact same spot.
    const viewportBounds = editor.getViewportScreenBounds();
    const viewportCentre = editor.screenToPage({
      x: viewportBounds.x + viewportBounds.w / 2,
      y: viewportBounds.y + viewportBounds.h / 2,
    });
    const offsetStep = 24;
    const i = libraryPlacementCountRef.current;
    libraryPlacementCountRef.current = i + 1;
    const offset = { x: (i % 5) * offsetStep, y: Math.floor(i / 5) * offsetStep };

    editor.createShape({
      id: createShapeId(),
      type: "spec-card",
      x: viewportCentre.x - CARD_W / 2 + offset.x,
      y: viewportCentre.y - cardH / 2 + offset.y,
      props: {
        w: CARD_W,
        h: cardH,
        imageUrl: spec.image_url ?? "",
        specId: spec.id,
        specName: spec.name,
        code: spec.code ?? "",
        category: spec.category_name ?? "",
        showInfo: false,
      },
    });

    // Add to project options (fire-and-forget — ignore if already there)
    addSpecToProject(projectId, { spec_id: spec.id });
  }

  // Reset placement offset when the picker closes so the next session starts
  // fresh at the viewport centre.
  useEffect(() => {
    if (!libraryPickerOpen) libraryPlacementCountRef.current = 0;
  }, [libraryPickerOpen]);

  // ── Sheet dropdown: close on outside click ──────────────────────────────────

  useEffect(() => {
    if (!sheetMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sheetMenuRef.current && !sheetMenuRef.current.contains(e.target as Node)) {
        setSheetMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sheetMenuOpen]);

  // ── Add a sheet (print-sized frame) to the canvas ──────────────────────────
  // Creates a tldraw native frame shape at the preset dimensions. Frames are
  // tldraw's container primitive — shapes dragged inside become children of
  // the frame, and the frame is the natural unit for a future export-to-PDF.

  function handleAddSheet(preset: SheetPreset) {
    const editor = editorRef.current;
    if (!editor) return;

    // Count existing frames so we can give this sheet a unique name suffix.
    const existingFrames = editor
      .getCurrentPageShapes()
      .filter((s) => s.type === "frame").length;

    // Place the frame centred in the current viewport so the user sees it
    // immediately (rather than it spawning offscreen).
    const viewportBounds = editor.getViewportScreenBounds();
    const centre = editor.screenToPage({
      x: viewportBounds.x + viewportBounds.w / 2,
      y: viewportBounds.y + viewportBounds.h / 2,
    });

    editor.createShape({
      id: createShapeId(),
      type: "frame",
      x: centre.x - preset.w / 2,
      y: centre.y - preset.h / 2,
      props: {
        w: preset.w,
        h: preset.h,
        name: `${preset.paper} ${preset.orientation} ${existingFrames + 1}`,
      },
    });

    // Zoom out a little if the new frame doesn't fit — A3 especially is large.
    editor.zoomToFit({ animation: { duration: 300 } });

    setSheetMenuOpen(false);
  }

  // ── Export frames to PDF ─────────────────────────────────────────────────
  // If the user has selected frames, export just those. Otherwise, export
  // all frames on the current canvas. Produces a single multi-page PDF —
  // one page per frame — at true print dimensions.

  async function handleExportPdf() {
    const editor = editorRef.current;
    if (!editor || isExporting) return;

    // Resolve which frames to export based on selection.
    const pageShapes = editor.getCurrentPageShapes();
    const allFrames = pageShapes.filter((s) => s.type === "frame");
    const selectedIds = new Set(editor.getSelectedShapeIds());
    const selectedFrames = allFrames.filter((f) => selectedIds.has(f.id));
    const framesToExport = selectedFrames.length > 0 ? selectedFrames : allFrames;

    if (framesToExport.length === 0) {
      setExportIsError(true);
      setExportStatus("No sheets on this canvas. Click \"Add sheet\" to create one.");
      setTimeout(() => setExportStatus(null), 3500);
      return;
    }

    setIsExporting(true);
    setExportIsError(false);
    setExportStatus(
      `Exporting ${framesToExport.length} sheet${framesToExport.length === 1 ? "" : "s"}…`,
    );

    try {
      // Lazy-load the PDF helper (pdf-lib is ~200KB) so it doesn't bloat the
      // initial canvas bundle — it's only needed if the user actually exports.
      const { exportFramesToPdf, downloadBlob } = await import("./exportPdf");

      const blob = await exportFramesToPdf(editor, framesToExport, {
        onProgress: (current, total) => {
          setExportStatus(`Rendering sheet ${current} of ${total}…`);
        },
      });

      // Build a sensible filename from the active canvas name.
      const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
      const rawName = activeCanvas?.name ?? "canvas";
      const cleanName = rawName.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "canvas";
      downloadBlob(blob, `${cleanName}.pdf`);

      setExportStatus(
        `✓ ${framesToExport.length} sheet${framesToExport.length === 1 ? "" : "s"} exported`,
      );
      setTimeout(() => setExportStatus(null), 3000);
    } catch (err) {
      console.error("[handleExportPdf]", err);
      setExportIsError(true);
      setExportStatus("Export failed. Check the console for details.");
      setTimeout(() => setExportStatus(null), 4000);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Create new canvas ───────────────────────────────────────────────────────

  async function handleCreate() {
    setIsCreating(true);
    const { canvas, error } = await createCanvas(projectId, "Untitled");
    setIsCreating(false);
    if (error || !canvas) return;

    setCanvases((prev) => [...prev, canvas]);
    setActiveCanvasId(canvas.id);
  }

  // ── Rename canvas ──────────────────────────────────────────────────────────

  async function handleRenameSubmit(canvasId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    const { error } = await renameCanvas(canvasId, projectId, trimmed);
    if (!error) {
      setCanvases((prev) =>
        prev.map((c) => (c.id === canvasId ? { ...c, name: trimmed } : c)),
      );
    }
    setRenamingId(null);
  }

  // ── Delete canvas ──────────────────────────────────────────────────────────

  async function handleDelete(canvasId: string) {
    if (canvases.length <= 1) return;

    const { error } = await deleteCanvas(canvasId, projectId);
    if (error) return;

    const remaining = canvases.filter((c) => c.id !== canvasId);
    setCanvases(remaining);
    if (activeCanvasId === canvasId) {
      setActiveCanvasId(remaining[0]?.id ?? "");
    }
    setMenuOpenId(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F4F2" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center px-5 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: "1px solid #E4E1DC",
          backgroundColor: "#FFFFFF",
          fontFamily: "var(--font-inter), sans-serif",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 18,
            fontWeight: 700,
            color: "#1A1A1A",
            marginRight: 24,
            flexShrink: 0,
          }}
        >
          Canvas
        </h1>

        {/* Divider */}
        <div style={{ width: 1, height: 24, backgroundColor: "#E4E1DC", marginRight: 12, flexShrink: 0 }} />

        {/* Canvas tabs */}
        {canvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId;
          const isRenaming = renamingId === canvas.id;

          return (
            <div key={canvas.id} className="relative flex items-center">
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(canvas.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit(canvas.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="px-3 py-1.5 rounded-md outline-none"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    border: "1px solid #FFDE28",
                    backgroundColor: "#FFFEF5",
                    width: 140,
                  }}
                />
              ) : (
                <button
                  onClick={() => setActiveCanvasId(canvas.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#1A1A1A" : "#9A9590",
                    backgroundColor: isActive ? "#F5F4F2" : "transparent",
                  }}
                >
                  {canvas.name}

                  {/* Context menu trigger */}
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === canvas.id ? null : canvas.id);
                    }}
                    className="ml-0.5 rounded p-0.5 hover:bg-black/5 transition-colors"
                    style={{ lineHeight: 0, color: "#9A9590" }}
                  >
                    <MoreHorizontal size={13} />
                  </span>
                </button>
              )}

              {/* Dropdown menu */}
              {menuOpenId === canvas.id && (
                <div
                  ref={menuRef}
                  className="absolute top-full left-0 mt-1 z-50 py-1 rounded-lg shadow-lg"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E4E1DC",
                    minWidth: 150,
                  }}
                >
                  <button
                    onClick={() => {
                      setRenameValue(canvas.name);
                      setRenamingId(canvas.id);
                      setMenuOpenId(null);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-black/[0.03] transition-colors"
                    style={{ fontSize: 13, color: "#1A1A1A" }}
                  >
                    <Pencil size={13} /> Rename
                  </button>
                  {canvases.length > 1 && (
                    <button
                      onClick={() => handleDelete(canvas.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-red-50 transition-colors"
                      style={{ fontSize: 13, color: "#DC2626" }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add canvas button */}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center justify-center rounded-md hover:bg-black/[0.04] transition-colors"
          style={{ width: 30, height: 30, color: "#9A9590" }}
          title="New canvas"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Add sheet dropdown (A4 / A3 print-sized frames) ─────────────── */}
        <div ref={sheetMenuRef} className="relative" style={{ marginRight: 8 }}>
          <button
            onClick={() => setSheetMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#1A1A1A",
              backgroundColor: "#F5F4F2",
              border: "1px solid #E4E1DC",
            }}
            aria-haspopup="menu"
            aria-expanded={sheetMenuOpen}
          >
            <FileText size={14} />
            Add sheet
            <ChevronDown size={12} style={{ color: "#9A9590" }} />
          </button>

          {sheetMenuOpen && (
            <div
              role="menu"
              className="absolute top-full right-0 mt-1 z-50 py-1 rounded-lg shadow-lg"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E4E1DC",
                minWidth: 200,
              }}
            >
              {SHEET_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleAddSheet(preset)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-black/[0.03] transition-colors gap-4"
                  style={{ fontSize: 13, color: "#1A1A1A" }}
                >
                  <span>{preset.label}</span>
                  <span style={{ fontSize: 11, color: "#9A9590", flexShrink: 0 }}>
                    {pxToMm(preset.w)} × {pxToMm(preset.h)} mm
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Export PDF button ───────────────────────────────────────────── */}
        <button
          onClick={handleExportPdf}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1A1A",
            backgroundColor: "#F5F4F2",
            border: "1px solid #E4E1DC",
            marginRight: 8,
            opacity: isExporting ? 0.6 : 1,
            cursor: isExporting ? "default" : "pointer",
          }}
          title="Export sheets to PDF (uses selection if set, otherwise all sheets)"
        >
          {isExporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Export PDF
        </button>

        {/* ── Add from Library button ─────────────────────────────────────── */}
        <button
          onClick={() => setLibraryPickerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1A1A",
            backgroundColor: "#F5F4F2",
            border: "1px solid #E4E1DC",
            marginRight: 8,
          }}
        >
          <Package size={14} />
          Add from Library
        </button>

        {/* ── URL scrape input (right side) ────────────────────────────────── */}
        {showUrlInput ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg px-3"
              style={{
                border: "1px solid #E4E1DC",
                backgroundColor: "#F5F4F2",
                height: 34,
              }}
            >
              <Link2 size={14} style={{ color: "#9A9590", flexShrink: 0 }} />
              <input
                ref={urlInputRef}
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlSubmit();
                  if (e.key === "Escape") {
                    setShowUrlInput(false);
                    setUrlValue("");
                    setScrapeStatus(null);
                  }
                }}
                placeholder="Paste a product URL..."
                disabled={isScraping}
                className="outline-none bg-transparent"
                style={{
                  fontSize: 13,
                  color: "#1A1A1A",
                  width: 280,
                }}
              />
              {isScraping ? (
                <Loader2 size={14} className="animate-spin" style={{ color: "#9A9590" }} />
              ) : urlValue.trim() ? (
                <button
                  onClick={handleUrlSubmit}
                  className="rounded p-0.5 hover:bg-black/5 transition-colors"
                  style={{ color: "#1A1A1A" }}
                >
                  <Check size={14} />
                </button>
              ) : null}
            </div>
            <button
              onClick={() => {
                setShowUrlInput(false);
                setUrlValue("");
                setScrapeStatus(null);
              }}
              className="rounded p-1 hover:bg-black/5 transition-colors"
              style={{ color: "#9A9590" }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowUrlInput(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#1A1A1A",
              backgroundColor: "#FFDE28",
              border: "none",
            }}
          >
            <Link2 size={14} />
            Add URL
          </button>
        )}
      </div>

      {/* ── Scrape status bar ──────────────────────────────────────────────── */}
      {scrapeStatus && (
        <div
          className="flex items-center gap-2 px-5 flex-shrink-0"
          style={{
            height: 36,
            backgroundColor: isScraping ? "#FFFEF5" : "#F0FDF4",
            borderBottom: "1px solid #E4E1DC",
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            color: isScraping ? "#92400E" : "#166534",
          }}
        >
          {isScraping && <Loader2 size={12} className="animate-spin" />}
          {scrapeStatus}
        </div>
      )}

      {/* ── Export status bar ──────────────────────────────────────────────── */}
      {exportStatus && (
        <div
          className="flex items-center gap-2 px-5 flex-shrink-0"
          style={{
            height: 36,
            backgroundColor: exportIsError
              ? "#FEF2F2"
              : isExporting
                ? "#FFFEF5"
                : "#F0FDF4",
            borderBottom: "1px solid #E4E1DC",
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            color: exportIsError
              ? "#991B1B"
              : isExporting
                ? "#92400E"
                : "#166534",
          }}
        >
          {isExporting && <Loader2 size={12} className="animate-spin" />}
          {exportStatus}
        </div>
      )}

      {/* ── Image upload error bar ─────────────────────────────────────────── */}
      {uploadError && (
        <div
          className="flex items-center gap-2 px-5 flex-shrink-0"
          style={{
            height: 36,
            backgroundColor: "#FEF2F2",
            borderBottom: "1px solid #E4E1DC",
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            color: "#991B1B",
          }}
        >
          {uploadError}
        </div>
      )}

      {/* ── Canvas area ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin" style={{ color: "#9A9590" }} />
          </div>
        ) : (
          <TldrawCanvas
            key={activeCanvasId}
            initialContent={canvasContent}
            onSave={handleSave}
            onImageUpload={handleImageUpload}
            onEditorMount={handleEditorMount}
            onUploadError={handleUploadError}
          />
        )}
      </div>

      {/* ── Spec detail modal (opens from the arrow button on a spec card) ── */}
      {openSpecId && (
        <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />
      )}

      {/* ── Library picker modal (opens from "Add from Library" button) ───── */}
      <LibraryPickerModal
        open={libraryPickerOpen}
        onClose={() => setLibraryPickerOpen(false)}
        onSelect={handleLibrarySpecSelect}
      />
    </div>
  );
}

