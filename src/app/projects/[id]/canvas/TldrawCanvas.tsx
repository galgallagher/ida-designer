"use client";

/**
 * TldrawCanvas — wrapper around tldraw v4 that handles:
 * - Loading/restoring a snapshot from the database
 * - Debounced auto-save on every change
 * - Image upload to Supabase Storage on drop/paste
 * - Stripped-down UI (no page menu, no share, no debug, no help)
 */

import { useCallback, useRef, useEffect, useMemo } from "react";
import { Tldraw, getSnapshot, Editor, type TLComponents } from "tldraw";
import "tldraw/tldraw.css";
import type { TLAssetStore } from "@tldraw/tlschema";
import type { Json } from "@/types/database";
import { SpecCardShapeUtil } from "./SpecCardShape";

// Custom shapes registered with the editor. `spec-card` is our clickable
// product-image shape that opens the spec detail modal on click.
const CUSTOM_SHAPE_UTILS = [SpecCardShapeUtil];

interface Props {
  initialContent: Json | null;
  onSave: (content: Json) => Promise<void>;
  onImageUpload: (file: File) => Promise<string | null>;
  onEditorMount?: (editor: Editor) => void;
}

// ── Hide tldraw UI elements that conflict with our own chrome ─────────────────
// Setting a component to null removes it entirely.
const COMPONENTS: TLComponents = {
  PageMenu: null,        // We manage canvases ourselves — hide tldraw's page tabs
  MainMenu: null,        // Hamburger menu — not needed
  HelpMenu: null,        // "?" help button
  DebugPanel: null,       // Debug info
  DebugMenu: null,        // Debug menu
  SharePanel: null,       // "Share" button
  // Keep: Toolbar (bottom drawing tools), StylePanel (colours/sizes),
  // NavigationPanel (zoom controls), QuickActions (undo/redo)
};

export default function TldrawCanvas({ initialContent, onSave, onImageUpload, onEditorMount }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // ── Debounced save ──────────────────────────────────────────────────────────

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const editor = editorRef.current;
      if (!editor || isSavingRef.current) return;

      isSavingRef.current = true;
      try {
        const snapshot = getSnapshot(editor.store);
        await onSave(snapshot as unknown as Json);
      } catch (err) {
        console.error("[TldrawCanvas] auto-save failed:", err);
      } finally {
        isSavingRef.current = false;
      }
    }, 1500);
  }, [onSave]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // ── Custom asset store for image uploads ────────────────────────────────────

  const assetStore: TLAssetStore = useMemo(() => ({
    async upload(_asset, file) {
      const url = await onImageUpload(file);
      if (!url) throw new Error("Image upload failed");
      return { src: url };
    },

    resolve(asset) {
      return asset.props.src ?? "";
    },
  }), [onImageUpload]);

  // ── Snapshot to restore ─────────────────────────────────────────────────────

  const hasContent =
    initialContent &&
    typeof initialContent === "object" &&
    !Array.isArray(initialContent) &&
    ("document" in initialContent || "store" in initialContent) &&
    Object.keys(initialContent).length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = hasContent ? (initialContent as any) : undefined;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="ida-canvas-tldraw" style={{ position: "absolute", inset: 0 }}>
      <Tldraw
        snapshot={snapshot}
        assets={assetStore}
        shapeUtils={CUSTOM_SHAPE_UTILS}
        components={COMPONENTS}
        onMount={(editor: Editor) => {
          editorRef.current = editor;
          onEditorMount?.(editor);

          // Turn on "always snap" so shapes snap to each other's edges,
          // centres, and equal gaps by default — same behaviour as Figma
          // and Photoshop. tldraw's default is modifier-triggered (Cmd/Ctrl
          // while dragging); flipping the user preference makes it always-on
          // and Cmd/Ctrl becomes the temporary *disable* shortcut instead.
          editor.user.updateUserPreferences({ isSnapMode: true });

          // Disable tldraw's default URL/embed paste → bookmark behavior.
          // We handle product URLs through Ida instead.
          editor.registerExternalContentHandler("url", () => {
            // no-op: swallow URL pastes silently
          });
          editor.registerExternalContentHandler("embed", () => {
            // no-op: prevent embed cards from URLs
          });

          // Listen for any store changes → trigger auto-save
          editor.store.listen(
            () => {
              debouncedSave();
            },
            { scope: "document", source: "user" },
          );
        }}
      />
    </div>
  );
}
