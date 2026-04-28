"use client";

/**
 * TldrawCanvas — tldraw v4 with Liveblocks real-time sync.
 *
 * - Liveblocks Storage (LiveMap<id, TLRecord>) is the live source of truth.
 * - On first open of a canvas, seeds the Liveblocks room from the existing
 *   Supabase snapshot (passed as initialContent) so no data is lost.
 * - Keeps a debounced backup save to Supabase for disaster recovery.
 * - Shows other users' cursors as coloured overlays on the canvas.
 *
 * Must be mounted inside a Liveblocks <RoomProvider> — see ProjectCanvasClient.
 */

import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import {
  Tldraw,
  getSnapshot,
  createShapeId,
  createTLStore,
  defaultShapeUtils,
  type Editor,
  type TLComponents,
  type TLStoreWithStatus,
  type TLRecord,
} from "tldraw";
import "tldraw/tldraw.css";
import type { Json } from "@/types/database";
import { SpecCardShapeUtil } from "./SpecCardShape";
import { CanvasImageShapeUtil } from "./CanvasImageShape";
import { useStorage, useMutation, useMyPresence, useOthers, type JsonObject } from "@/lib/liveblocks";

const CUSTOM_SHAPE_UTILS = [SpecCardShapeUtil, CanvasImageShapeUtil];

// Document-scope records are shared across users; session records
// (instance, camera, pointer, presence) stay local to each client.
const DOCUMENT_TYPENAMES = new Set(["document", "page", "shape", "binding", "asset"]);
function isDocumentRecord(record: { typeName?: string } | undefined): boolean {
  return !!record?.typeName && DOCUMENT_TYPENAMES.has(record.typeName);
}

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

// ── Other users' cursors overlay ─────────────────────────────────────────────

function CursorsOverlay({ editor }: { editor: Editor }) {
  const others = useOthers();
  // Re-render every animation frame so cursor positions stay accurate as the
  // camera pans or zooms (page → screen conversion changes with camera).
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    let rafId: number;
    const tick = () => { forceUpdate((n) => n + 1); rafId = requestAnimationFrame(tick); };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }}>
      {others.map(({ connectionId, presence, info }) => {
        if (!presence.cursor) return null;
        // pageToScreen returns window/viewport-relative coords; the overlay is
        // positioned inside the tldraw container, so subtract the container's
        // screen offset to get container-local coords.
        const screen = editor.pageToScreen(presence.cursor);
        const bounds = editor.getViewportScreenBounds();
        const x = screen.x - bounds.x;
        const y = screen.y - bounds.y;
        const color = (info as { color?: string } | null)?.color ?? "#9A9590";
        const name = (info as { name?: string } | null)?.name ?? "User";
        return (
          <div
            key={connectionId}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-2px, -2px)",
              pointerEvents: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M1 1L1 14L4.5 10.5L7.5 17L9.5 16L6.5 9.5L12 9.5Z"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="0.8"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 10,
                backgroundColor: color,
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                fontFamily: "var(--font-inter), sans-serif",
                boxShadow: "0 1px 4px rgba(26,26,26,0.2)",
              }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TldrawCanvas({
  initialContent,
  onSave,
  onImageUpload,
  onEditorMount,
  onUploadError,
}: Props) {
  // tldraw store — manually managed so Liveblocks can drive it
  const store = useMemo(
    () => createTLStore({ shapeUtils: [...defaultShapeUtils, ...CUSTOM_SHAPE_UTILS] }),
    [],
  );
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({ status: "loading" });
  const [editorState, setEditorState] = useState<Editor | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  // Tracks whether we've already seeded the room from Supabase so we don't
  // re-seed on subsequent Liveblocks storage updates.
  const hasSeededRef = useRef(false);

  // Keep stable refs to callbacks so closures don't go stale
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => { onImageUploadRef.current = onImageUpload; }, [onImageUpload]);
  const onUploadErrorRef = useRef(onUploadError);
  useEffect(() => { onUploadErrorRef.current = onUploadError; }, [onUploadError]);

  // ── Liveblocks hooks ────────────────────────────────────────────────────────

  // All tldraw records from Liveblocks Storage. Null while the room is loading.
  // useStorage returns the LiveMap as a plain object snapshot, not a Map.
  const records = useStorage((root) => root.records) as unknown as Record<string, JsonObject> | null;

  // Seed the Liveblocks room from a Supabase snapshot (first open only).
  // Only document-scope records are shared; session records (instance state,
  // camera, presence) stay local to each user.
  const seedRoom = useMutation(
    ({ storage }, initialRecords: Record<string, TLRecord>) => {
      const lbRecords = storage.get("records");
      for (const [id, record] of Object.entries(initialRecords)) {
        if (!isDocumentRecord(record)) continue;
        lbRecords.set(id, record as unknown as JsonObject);
      }
    },
    [],
  );

  // Push local tldraw changes to Liveblocks Storage.
  const pushChanges = useMutation(
    (
      { storage },
      changes: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        added: Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updated: Record<string, [any, any]>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        removed: Record<string, any>;
      },
    ) => {
      const lbRecords = storage.get("records");
      for (const record of Object.values(changes.added)) {
        if (!isDocumentRecord(record as TLRecord)) continue;
        lbRecords.set((record as TLRecord).id, record as unknown as JsonObject);
      }
      for (const update of Object.values(changes.updated)) {
        const after = (update as [TLRecord, TLRecord])[1];
        if (!isDocumentRecord(after)) continue;
        lbRecords.set(after.id, after as unknown as JsonObject);
      }
      for (const [id, record] of Object.entries(changes.removed)) {
        if (!isDocumentRecord(record as TLRecord)) continue;
        lbRecords.delete(id);
      }
    },
    [],
  );

  const [, updateMyPresence] = useMyPresence();
  const updatePresenceRef = useRef(updateMyPresence);
  useEffect(() => { updatePresenceRef.current = updateMyPresence; }, [updateMyPresence]);

  // ── Debounced Supabase backup save ─────────────────────────────────────────
  // Liveblocks is the live source of truth; Supabase is disaster recovery.
  // We save less aggressively (5s debounce, only on local user changes).

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
        console.error("[TldrawCanvas] backup save failed:", err);
      } finally {
        isSavingRef.current = false;
      }
    }, 5000);
  }, [onSave]);

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  // ── Sync Liveblocks → tldraw store ─────────────────────────────────────────

  useEffect(() => {
    if (records === null) {
      // Room still connecting
      setStoreWithStatus({ status: "loading" });
      return;
    }

    const recordKeys = Object.keys(records);

    if (recordKeys.length === 0 && !hasSeededRef.current) {
      // New room — seed from Supabase snapshot if we have one
      hasSeededRef.current = true;
      const snap = initialContent as {
        document?: { store?: Record<string, TLRecord> };
      } | null;
      const initialRecords = snap?.document?.store;
      if (initialRecords && Object.keys(initialRecords).length > 0) {
        seedRoom(initialRecords);
        return; // useEffect will re-fire after seeding populates records
      }
    }

    // Apply all Liveblocks records to the tldraw store. Only touch
    // document-scope records — session state stays local to each client.
    store.mergeRemoteChanges(() => {
      const remoteIds = new Set(recordKeys);
      const localDocumentIds = store
        .allRecords()
        .filter(isDocumentRecord)
        .map((r) => r.id);

      // Remove local document records that no longer exist in Liveblocks
      const toRemove = localDocumentIds.filter((id) => !remoteIds.has(id));
      if (toRemove.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.remove(toRemove as any);
      }

      // Upsert all remote records (already filtered to document scope on push)
      const toUpsert = Object.values(records) as unknown as TLRecord[];
      if (toUpsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.put(toUpsert as any);
      }
    });

    setStoreWithStatus({
      status: "synced-remote",
      connectionStatus: "online",
      store,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // ── Sync tldraw store → Liveblocks ─────────────────────────────────────────
  // Only push changes made by this user (source: "user"). Changes from
  // mergeRemoteChanges have source: "remote" and are intentionally excluded
  // to prevent feedback loops.

  useEffect(() => {
    const unsub = store.listen(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => {
        const changes = entry.changes;
        if (!changes) return;
        pushChanges({
          added: changes.added ?? {},
          updated: changes.updated ?? {},
          removed: changes.removed ?? {},
        });
        debouncedSave();
      },
      { scope: "document", source: "user" },
    );
    return unsub;
  }, [store, pushChanges, debouncedSave]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="ida-canvas-tldraw" style={{ position: "absolute", inset: 0 }}>
      <Tldraw
        store={storeWithStatus}
        shapeUtils={CUSTOM_SHAPE_UTILS}
        components={COMPONENTS}
        onMount={(editor: Editor) => {
          editorRef.current = editor;
          setEditorState(editor);
          onEditorMount?.(editor);

          editor.user.updateUserPreferences({ isSnapMode: true });

          // Swallow URL/embed pastes — handled through Ida's URL bar instead.
          editor.registerExternalContentHandler("url", () => {});
          editor.registerExternalContentHandler("embed", () => {});

          // Track cursor position and broadcast to other users.
          const container = editor.getContainer();
          const handlePointerMove = (e: PointerEvent) => {
            const { x, y } = editor.screenToPage({ x: e.clientX, y: e.clientY });
            updatePresenceRef.current({ cursor: { x, y } });
          };
          const handlePointerLeave = () => {
            updatePresenceRef.current({ cursor: null });
          };
          container.addEventListener("pointermove", handlePointerMove);
          container.addEventListener("pointerleave", handlePointerLeave);

          // Intercept all file drops and clipboard image pastes.
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
                const msg =
                  file.size > 50 * 1024 * 1024
                    ? "Image too large — must be under 50 MB."
                    : "Image upload failed. Check your connection and try again.";
                onUploadErrorRef.current?.(msg);
                continue;
              }

              const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ w: 800, h: 600 });
                img.src = result.url;
              });

              const MAX_W = 800;
              const scale = dims.w > MAX_W ? MAX_W / dims.w : 1;
              const w = Math.round(dims.w * scale);
              const h = Math.round(dims.h * scale);
              const offset = i * 24;

              editor.createShape({
                id: createShapeId(),
                type: "canvas-image",
                x: viewportCenter.x - w / 2 + offset,
                y: viewportCenter.y - h / 2 + offset,
                props: { w, h, imageUrl: result.url, imageId: result.imageId ?? "", tag: undefined },
              });
            }
          });
        }}
      />

      {/* Render other users' cursors on top of the canvas */}
      {editorState && <CursorsOverlay editor={editorState} />}
    </div>
  );
}
