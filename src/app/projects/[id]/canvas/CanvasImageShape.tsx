"use client";

/**
 * CanvasImageShape — custom tldraw shape for images pasted or dropped onto
 * the canvas (photos, screenshots, inspiration images, sketches).
 *
 * Unlike spec-card shapes (which represent library products), these are raw
 * images. They support tagging as "inspiration" or "sketch" via an eye button.
 * The tag is stored both in the shape props (for canvas persistence) and in
 * the project_images table (for the Images section).
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  useEditor,
  useValue,
  type Editor,
  type RecordProps,
  type TLBaseShape,
} from "tldraw";
import React, { useState, useRef, useEffect } from "react";
import { tagProjectImage } from "./actions";
import { ImageStyleBar } from "./ImageStyleBar";

export type CanvasImageTag = "inspiration" | "sketch";

type CanvasImageShapeProps = {
  w: number;
  h: number;
  imageUrl: string;
  imageId: string;   // project_images DB record ID (empty string if not yet persisted)
  tag?: CanvasImageTag;
  // Image positioning within the cropped frame (0–1, default 0.5/0.5 = centered).
  // Editable via double-click. See SpecCardShape for the same pattern.
  imageOffsetX?: number;
  imageOffsetY?: number;
  // Transform controls
  flipX?: boolean;
  flipY?: boolean;
  cornerRadius?: number; // px, default 10
};

const TAG_CONFIG: Record<CanvasImageTag, { label: string; bg: string; color: string }> = {
  inspiration: { label: "Inspiration", bg: "rgba(255,255,255,0.95)", color: "#1A1A1A" },
  sketch:      { label: "Sketch",      bg: "rgba(255,255,255,0.95)", color: "#1A1A1A" },
};

function cardButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    padding: 0,
    border: "none",
    borderRadius: 6,
    backgroundColor: active ? "#FFDE28" : "rgba(255,255,255,0.95)",
    boxShadow: "0 1px 4px rgba(26,26,26,0.15)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#1A1A1A",
  };
}

// ── Eye button with inline tag dropdown ──────────────────────────────────────

function TagButton({
  tag,
  onSetTag,
}: {
  tag: CanvasImageTag | undefined;
  onSetTag: (t: CanvasImageTag | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        title={tag ? `Tagged: ${TAG_CONFIG[tag].label}` : "Tag this image"}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          ...cardButtonStyle(false),
          backgroundColor: "rgba(255,255,255,0.95)",
          color: "#1A1A1A",
        }}
      >
        {tag ? (
          // Eye open
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ) : (
          // EyeOff — broken/untagged
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <path d="M10.73 10.73a3 3 0 1 0 4.24 4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        )}
      </button>

      {open && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 32,
            right: 0,
            zIndex: 999,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E4E1DC",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(26,26,26,0.12)",
            padding: "4px",
            minWidth: 130,
          }}
        >
          {(["inspiration", "sketch"] as CanvasImageTag[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={(e) => { e.stopPropagation(); onSetTag(t); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: tag === t ? "#F5F4F2" : "transparent",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 12,
                fontWeight: tag === t ? 600 : 400,
                color: "#1A1A1A",
                textAlign: "left",
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                backgroundColor: t === "inspiration" ? "#FFDE28" : "#1A1A1A",
              }} />
              {TAG_CONFIG[t].label}
            </button>
          ))}
          {tag && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSetTag(undefined); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "6px 10px",
                marginTop: 2,
                border: "none",
                borderTop: "1px solid #F0EDEA",
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: "transparent",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 11,
                color: "#9A9590",
                textAlign: "left",
              }}
            >
              Remove tag
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Image body with drag-to-reposition (in edit mode) ────────────────────────

function CanvasImageBody({
  shape,
  editor,
  isEditing,
}: {
  shape: CanvasImageShape;
  editor: Editor | null;
  isEditing: boolean;
}): React.ReactElement {
  const { w, h, imageUrl } = shape.props;
  const offsetX = shape.props.imageOffsetX ?? 0.5;
  const offsetY = shape.props.imageOffsetY ?? 0.5;
  const flipX = shape.props.flipX ?? false;
  const flipY = shape.props.flipY ?? false;
  const flipTransform = [flipX && "scaleX(-1)", flipY && "scaleY(-1)"].filter(Boolean).join(" ") || undefined;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [liveOffset, setLiveOffset] = useState<{ x: number; y: number } | null>(null);
  const displayX = liveOffset?.x ?? offsetX;
  const displayY = liveOffset?.y ?? offsetY;

  function startReposition(e: React.PointerEvent<HTMLDivElement>) {
    if (!isEditing || !editor) return;
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;

    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const renderedW = img.naturalWidth * scale;
    const renderedH = img.naturalHeight * scale;
    const overflowX = Math.max(0, renderedW - w);
    const overflowY = Math.max(0, renderedH - h);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startX = offsetX;
    const startY = offsetY;

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startPointerX;
      const dy = ev.clientY - startPointerY;
      const nextX = overflowX > 0 ? clamp01(startX - dx / overflowX) : startX;
      const nextY = overflowY > 0 ? clamp01(startY - dy / overflowY) : startY;
      setLiveOffset({ x: nextX, y: nextY });
    }

    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      const dx = ev.clientX - startPointerX;
      const dy = ev.clientY - startPointerY;
      const nextX = overflowX > 0 ? clamp01(startX - dx / overflowX) : startX;
      const nextY = overflowY > 0 ? clamp01(startY - dy / overflowY) : startY;
      editor!.markHistoryStoppingPoint("reposition image");
      editor!.updateShape<CanvasImageShape>({
        id: shape.id,
        type: "canvas-image",
        props: { imageOffsetX: nextX, imageOffsetY: nextY },
      });
      setLiveOffset(null);
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      onPointerDown={startReposition}
      style={{
        position: "absolute",
        inset: 0,
        cursor: isEditing ? (liveOffset ? "grabbing" : "grab") : "default",
        boxShadow: isEditing ? "inset 0 0 0 2px #FFDE28" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${displayX * 100}% ${displayY * 100}%`,
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
          transform: flipTransform,
        }}
      />
    </div>
  );
}

// ── Shape declaration ─────────────────────────────────────────────────────────

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    "canvas-image": CanvasImageShapeProps;
  }
}

export type CanvasImageShape = TLBaseShape<"canvas-image", CanvasImageShapeProps>;

export class CanvasImageShapeUtil extends BaseBoxShapeUtil<CanvasImageShape> {
  static override type = "canvas-image" as const;
  static override props: RecordProps<CanvasImageShape> = {
    w: T.number,
    h: T.number,
    imageUrl: T.string,
    imageId: T.string,
    tag: T.string.optional() as T.Validatable<CanvasImageTag | undefined>,
    imageOffsetX: T.number.optional(),
    imageOffsetY: T.number.optional(),
    flipX: T.boolean.optional(),
    flipY: T.boolean.optional(),
    cornerRadius: T.number.optional(),
  };

  getDefaultProps(): CanvasImageShape["props"] {
    return {
      w: 400, h: 300, imageUrl: "", imageId: "", tag: undefined,
      imageOffsetX: 0.5, imageOffsetY: 0.5,
      flipX: false, flipY: false, cornerRadius: 0,
    };
  }

  override canResize = () => true;
  override canEdit = () => true; // double-click → reposition image inside the frame

  component(shape: CanvasImageShape) {
    const { w, h, imageUrl, imageId, tag } = shape.props;
    const flipX = shape.props.flipX ?? false;
    const flipY = shape.props.flipY ?? false;
    const cornerRadius = shape.props.cornerRadius ?? 0;
    const editor = this.editor;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editorFromHook = useEditor();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isEditing = useValue(
      "isEditingCanvasImage",
      () => editorFromHook.getEditingShapeId() === shape.id,
      [editorFromHook, shape.id],
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSelected = useValue(
      "isSelectedCanvasImage",
      () => {
        const ids = editorFromHook.getSelectedShapeIds();
        return ids.length === 1 && ids[0] === shape.id;
      },
      [editorFromHook, shape.id],
    );

    const setTag = (t: CanvasImageTag | undefined) => {
      editor.updateShape<CanvasImageShape>({
        id: shape.id,
        type: "canvas-image",
        props: { tag: t },
      });
      // Persist to project_images if we have a DB record
      if (imageId) {
        tagProjectImage(imageId, t ?? "inspiration");
      }
    };

    const updateProps = (props: Partial<CanvasImageShapeProps>) => {
      editor.updateShape<CanvasImageShape>({ id: shape.id, type: "canvas-image", props });
    };

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "visible",
          position: "relative",
        }}
      >
        {/* Style bar — floats above shape when selected (not while repositioning) */}
        {isSelected && !isEditing && (
          <ImageStyleBar
            flipX={flipX}
            flipY={flipY}
            cornerRadius={cornerRadius}
            maxRadius={Math.floor(Math.min(w, h) / 2)}
            isSquare={w === h}
            onFlipX={() => updateProps({ flipX: !flipX })}
            onFlipY={() => updateProps({ flipY: !flipY })}
            onSetRadius={(r) => updateProps({ cornerRadius: r })}
            onMakeSquare={() => {
              const s = Math.min(w, h);
              updateProps({ w: s, h: s });
            }}
          />
        )}

        {/* Image frame — clips image to rounded corners */}
        <div style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius: cornerRadius,
          backgroundColor: "#F5F4F2",
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
        }}>
          <CanvasImageBody shape={shape} editor={editorFromHook} isEditing={isEditing} />

          {/* Edit-mode hint */}
          {isEditing && (
            <div
              className="canvas-card-buttons"
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                padding: "3px 9px",
                borderRadius: 20,
                backgroundColor: "rgba(26,26,26,0.78)",
                color: "#FFFFFF",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                pointerEvents: "none",
                boxShadow: "0 1px 4px rgba(26,26,26,0.2)",
              }}
            >
              Drag image · Esc to finish
            </div>
          )}

          {/* Tag pill — subtle label at bottom-left when tagged */}
          {tag && (
            <div
              className="canvas-card-buttons"
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                padding: "3px 9px",
                borderRadius: 20,
                backgroundColor: TAG_CONFIG[tag].bg,
                color: TAG_CONFIG[tag].color,
                boxShadow: "0 1px 4px rgba(26,26,26,0.15)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                pointerEvents: "none",
              }}
            >
              {TAG_CONFIG[tag].label}
            </div>
          )}

          {/* Eye button — top-right */}
          <div className="canvas-card-buttons" style={{ position: "absolute", top: 8, right: 8 }}>
            <TagButton tag={tag} onSetTag={setTag} />
          </div>
        </div>
      </HTMLContainer>
    );
  }

  override async toSvg(shape: CanvasImageShape) {
    const { w, h, imageUrl } = shape.props;
    const cornerRadius = shape.props.cornerRadius ?? 0;
    const flipX = shape.props.flipX ?? false;
    const flipY = shape.props.flipY ?? false;
    const flipTransform = [flipX && "scaleX(-1)", flipY && "scaleY(-1)"].filter(Boolean).join(" ") || undefined;

    let embeddedSrc: string | null = null;
    if (imageUrl) {
      try {
        const res = await fetch(imageUrl, { mode: "cors", credentials: "omit" });
        if (res.ok) {
          const blob = await res.blob();
          embeddedSrc = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* fall through */ }
    }

    const src = embeddedSrc ?? imageUrl;
    const ox = (shape.props.imageOffsetX ?? 0.5) * 100;
    const oy = (shape.props.imageOffsetY ?? 0.5) * 100;
    return (
      <foreignObject x={0} y={0} width={w} height={h}>
        <div
          {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
          style={{ width: w, height: h, overflow: "hidden", borderRadius: cornerRadius }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ox}% ${oy}%`, display: "block", transform: flipTransform }} />
        </div>
      </foreignObject>
    );
  }

  indicator(shape: CanvasImageShape) {
    const r = shape.props.cornerRadius ?? 0;
    return <rect width={shape.props.w} height={shape.props.h} rx={r} ry={r} />;
  }
}
