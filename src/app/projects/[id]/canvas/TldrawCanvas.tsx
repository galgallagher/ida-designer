"use client";

/**
 * TldrawCanvas — wrapper around tldraw v4 that handles:
 * - Loading/restoring a snapshot from the database
 * - Debounced auto-save on every change
 * - Image upload to Supabase Storage on drop/paste (→ canvas-image shape)
 * - Stripped-down UI (no page menu, no share, no debug, no help)
 */

import { useCallback, useRef, useEffect, useMemo } from "react";
import { Tldraw, getSnapshot, createShapeId, Editor, type TLComponents } from "tldraw";
import "tldraw/tldraw.css";
import type { TLAssetStore } from "@tldraw/tlschema";
import type { Json } from "@/types/database";
import { SpecCardShapeUtil } from "./SpecCardShape";
import { CanvasImageShapeUtil } from "./CanvasImageShape";

const CUSTOM_SHAPE_UTILS = [SpecCardShapeUtil, CanvasImageShapeUtil];

interface Props {
  initialContent: Json | null;
  onSave: (content: Json) => Promise<void>;
  onImageUpload: (file: File) => Promise<{ url: string; imageId: string | null } | null>;
  onEditorMount?: (editor: Editor) => void;
  onUploadError?: (message: string) => void;
}

const COMPONENTS: TLComponents = {
  PageMenu: null,
  MainMenu: null,
  HelpMenu: null,
  DebugPanel: null,
  DebugMenu: null,
  SharePanel: null,
};

export default function TldrawCanvas({ initialContent, onSave, onImageUpload, onEditorMount, onUploadError }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Keep a stable ref to onImageUpload so the files handler closure doesn't stale
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => { onImageUploadRef.current = onImageUpload; }, [onImageUpload]);

  const onUploadErrorRef = useRef(onUploadError);
  useEffect(() => { onUploadErrorRef.current = onUploadError; }, [onUploadError]);

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

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  // Asset store — only needed for resolving existing native image assets that
  // may already exist in older snapshots. New uploads go through the files handler.
  const assetStore: TLAssetStore = useMemo(() => ({
    async upload(_asset, _file) {
      // Uploads are now handled by the "files" external content handler below.
      // This path should not be reached for new images.
      throw new Error("Unexpected asset upload — use files handler");
    },
    resolve(asset) {
      return asset.props.src ?? "";
    },
  }), []);

  const hasContent =
    initialContent &&
    typeof initialContent === "object" &&
    !Array.isArray(initialContent) &&
    ("document" in initialContent || "store" in initialContent) &&
    Object.keys(initialContent).length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = hasContent ? (initialContent as any) : undefined;

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

          editor.user.updateUserPreferences({ isSnapMode: true });

          // Swallow URL/embed pastes — handled through Ida's URL bar instead.
          editor.registerExternalContentHandler("url", () => {});
          editor.registerExternalContentHandler("embed", () => {});

          // Intercept all file drops and clipboard image pastes.
          // Creates canvas-image shapes instead of tldraw's native image shapes,
          // so our eye/tag button overlay is always present.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.registerExternalContentHandler("files", async (content: any) => {
            const files: File[] = (content.files ?? []).filter(
              (f: File) => f.type.startsWith("image/"),
            );
            if (files.length === 0) return;

            const viewportBounds = editor.getViewportScreenBounds();
            const viewportCenter = editor.screenToPage({
              x: viewportBounds.x + viewportBounds.w / 2,
              y: viewportBounds.y + viewportBounds.h / 2,
            });

            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const result = await onImageUploadRef.current(file);

              if (!result) {
                const msg = file.size > 50 * 1024 * 1024
                  ? "Image too large — must be under 50 MB."
                  : "Image upload failed. Check your connection and try again.";
                onUploadErrorRef.current?.(msg);
                continue;
              }

              // Get natural image dimensions to size the shape correctly.
              const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ w: 800, h: 600 });
                img.src = result.url;
              });

              // Scale down to fit within 800px wide, preserve aspect ratio.
              const MAX_W = 800;
              const scale = dims.w > MAX_W ? MAX_W / dims.w : 1;
              const w = Math.round(dims.w * scale);
              const h = Math.round(dims.h * scale);

              // Stagger multiple files so they don't stack exactly.
              const offset = i * 24;
              editor.createShape({
                id: createShapeId(),
                type: "canvas-image",
                x: viewportCenter.x - w / 2 + offset,
                y: viewportCenter.y - h / 2 + offset,
                props: {
                  w,
                  h,
                  imageUrl: result.url,
                  imageId: result.imageId ?? "",
                  tag: undefined,
                },
              });
            }
          });

          editor.store.listen(
            () => { debouncedSave(); },
            { scope: "document", source: "user" },
          );
        }}
      />
    </div>
  );
}
