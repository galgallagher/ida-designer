"use client";

/**
 * SpecCardShape — custom tldraw shape for spec/product cards on the canvas.
 * Used for items scraped from URLs or added from the project library.
 * Has an ⓘ button to toggle the info footer, and an arrow button to open
 * the full spec detail modal.
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
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { ImageStyleBar } from "./ImageStyleBar";

// Reads the global schedule-code map maintained by ProjectCanvasClient and
// re-renders when it changes. Returns the codes assigned to this spec.
function useScheduleCodesForSpec(specId: string): string[] {
  const [codes, setCodes] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const map = (window as unknown as { __canvasScheduleCodes?: Record<string, string[]> }).__canvasScheduleCodes;
    return map?.[specId] ?? [];
  });
  useEffect(() => {
    function read() {
      if (typeof window === "undefined") return;
      const map = (window as unknown as { __canvasScheduleCodes?: Record<string, string[]> }).__canvasScheduleCodes;
      setCodes(map?.[specId] ?? []);
    }
    read();
    window.addEventListener("canvas:schedule-codes-updated", read);
    return () => window.removeEventListener("canvas:schedule-codes-updated", read);
  }, [specId]);
  return codes;
}

type SpecCardShapeProps = {
  w: number;
  h: number;
  imageUrl: string;
  specId: string;
  specName: string;
  code?: string;
  category?: string;
  showInfo?: boolean;
  // Image positioning within the cropped frame (0–1, default 0.5/0.5 = centered).
  // Used as objectPosition to allow nudging the image up/down/left/right inside
  // the box without changing the box itself. Editable via double-click.
  imageOffsetX?: number;
  imageOffsetY?: number;
  // Transform controls
  flipX?: boolean;
  flipY?: boolean;
  cornerRadius?: number; // px, default 14
};

function cardButtonStyle(pressed: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    padding: 0,
    border: "none",
    borderRadius: 6,
    backgroundColor: pressed ? "#FFDE28" : "rgba(255,255,255,0.95)",
    boxShadow: "0 1px 4px rgba(26,26,26,0.15)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#1A1A1A",
  };
}

// In edit mode, render an interactive image that can be dragged to reposition.
// Outside edit mode, render a plain non-interactive img.
function SpecCardBody({
  shape,
  editor,
  isEditing,
}: {
  shape: SpecCardShape;
  editor: Editor | null;
  isEditing: boolean;
}): React.ReactElement {
  const { w, h, imageUrl, specId, specName } = shape.props;
  const scheduleCodes = useScheduleCodesForSpec(specId);

  const offsetX = shape.props.imageOffsetX ?? 0.5;
  const offsetY = shape.props.imageOffsetY ?? 0.5;
  const flipX = shape.props.flipX ?? false;
  const flipY = shape.props.flipY ?? false;
  const flipTransform = [flipX && "scaleX(-1)", flipY && "scaleY(-1)"].filter(Boolean).join(" ") || undefined;

  const imgRef = useRef<HTMLImageElement | null>(null);
  // Live offsets while dragging (avoid hammering shape store on every move).
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

    // Compute how the image is laid out inside the container under object-fit:
    // cover. The dimension that overflows is the one we can pan.
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const renderedW = img.naturalWidth * scale;
    const renderedH = img.naturalHeight * scale;
    const overflowX = Math.max(0, renderedW - w);
    const overflowY = Math.max(0, renderedH - h);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startX = offsetX;
    const startY = offsetY;

    function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startPointerX;
      const dy = ev.clientY - startPointerY;
      // Dragging right reveals more of the left of the image → decrease X.
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
      // Commit to the shape store (creates a single undo entry).
      editor!.markHistoryStoppingPoint("reposition image");
      editor!.updateShape<SpecCardShape>({
        id: shape.id,
        type: "spec-card",
        props: { imageOffsetX: nextX, imageOffsetY: nextY },
      });
      setLiveOffset(null);
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <>
      <div
        onPointerDown={startReposition}
        style={{
          position: "relative",
          width: "100%",
          height: h,
          overflow: "hidden",
          backgroundColor: "#F5F4F2",
          flexShrink: 0,
          cursor: isEditing ? (liveOffset ? "grabbing" : "grab") : "default",
          // Subtle yellow ring when editing the image position
          boxShadow: isEditing ? "inset 0 0 0 2px #FFDE28" : undefined,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={imageUrl}
            alt={specName}
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
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#9A9590",
              pointerEvents: "none",
            }}
          >
            No image
          </div>
        )}

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

        {/* Schedule code pill(s) — bottom-left, when assigned */}
        {scheduleCodes.length > 0 && (
          <div
            className="canvas-card-buttons"
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              pointerEvents: "none",
            }}
          >
            {scheduleCodes.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  boxShadow: "0 1px 4px rgba(26,26,26,0.15)",
                  borderRadius: 20,
                  padding: "3px 9px",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

    </>
  );
}

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    "spec-card": SpecCardShapeProps;
  }
}

export type SpecCardShape = TLBaseShape<"spec-card", SpecCardShapeProps>;

export class SpecCardShapeUtil extends BaseBoxShapeUtil<SpecCardShape> {
  static override type = "spec-card" as const;
  static override props: RecordProps<SpecCardShape> = {
    w: T.number,
    h: T.number,
    imageUrl: T.string,
    specId: T.string,
    specName: T.string,
    code: T.string.optional(),
    category: T.string.optional(),
    showInfo: T.boolean.optional(),
    imageOffsetX: T.number.optional(),
    imageOffsetY: T.number.optional(),
    flipX: T.boolean.optional(),
    flipY: T.boolean.optional(),
    cornerRadius: T.number.optional(),
  };

  getDefaultProps(): SpecCardShape["props"] {
    return {
      w: 240,
      h: 240,
      imageUrl: "",
      specId: "",
      specName: "",
      code: "",
      category: "",
      showInfo: false,
      imageOffsetX: 0.5,
      imageOffsetY: 0.5,
      flipX: false,
      flipY: false,
      cornerRadius: 0,
    };
  }

  override canResize = () => true;
  override canEdit = () => true; // double-click → reposition image inside the frame

  component(shape: SpecCardShape) {
    const { w, h, specId } = shape.props;
    const flipX = shape.props.flipX ?? false;
    const flipY = shape.props.flipY ?? false;
    const cornerRadius = shape.props.cornerRadius ?? 0;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editor = useEditor();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isEditing = useValue(
      "isEditingSpecCard",
      () => editor.getEditingShapeId() === shape.id,
      [editor, shape.id],
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSelected = useValue(
      "isSelectedSpecCard",
      () => {
        const ids = editor.getSelectedShapeIds();
        return ids.length === 1 && ids[0] === shape.id;
      },
      [editor, shape.id],
    );

    const updateProps = (props: Partial<SpecCardShapeProps>) => {
      editor.updateShape<SpecCardShape>({ id: shape.id, type: "spec-card", props });
    };

    function openModal(e: React.MouseEvent | React.PointerEvent) {
      e.stopPropagation();
      if (specId) {
        window.dispatchEvent(new CustomEvent("canvas:open-spec", { detail: { specId } }));
      }
    }

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "visible",
          fontFamily: "var(--font-inter), sans-serif",
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

        {/* Card frame — clips image to rounded corners */}
        <div style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius: cornerRadius,
          backgroundColor: "#FFFFFF",
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
          display: "flex",
          flexDirection: "column",
        }}>
          <SpecCardBody shape={shape} editor={editor} isEditing={isEditing} />

          <div className="canvas-card-buttons" style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
            {/* + — add to schedule */}
            {specId ? (
              <button
                type="button"
                title="Add to schedule"
                aria-label="Add to schedule"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("canvas:add-to-schedule", { detail: { specId } }));
                }}
                style={cardButtonStyle(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="3" width="8" height="4" rx="1" />
                  <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <path d="M12 11v6" />
                  <path d="M9 14h6" />
                </svg>
              </button>
            ) : null}

            {/* ↗ — open spec detail modal */}
            <button
              type="button"
              title="Open product details"
              aria-label="Open product details"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={openModal}
              style={cardButtonStyle(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </button>
          </div>
        </div>
      </HTMLContainer>
    );
  }

  override async toSvg(shape: SpecCardShape) {
    const { w, h, imageUrl } = shape.props;
    const cornerRadius = shape.props.cornerRadius ?? 0;

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
      } catch {
        /* fall through */
      }
    }

    const shapeForExport: SpecCardShape = embeddedSrc
      ? { ...shape, props: { ...shape.props, imageUrl: embeddedSrc } }
      : shape;

    return (
      <foreignObject x={0} y={0} width={w} height={h}>
        <div
          {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
          style={{
            width: w,
            height: h,
            overflow: "hidden",
            borderRadius: cornerRadius,
            backgroundColor: "#FFFFFF",
            boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          <SpecCardBody shape={shapeForExport} editor={null} isEditing={false} />
        </div>
      </foreignObject>
    );
  }

  indicator(shape: SpecCardShape) {
    const r = shape.props.cornerRadius ?? 0;
    return <rect width={shape.props.w} height={shape.props.h} rx={r} ry={r} />;
  }
}
