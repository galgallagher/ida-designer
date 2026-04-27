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
  type RecordProps,
  type TLBaseShape,
} from "tldraw";
import React, { useState, useRef, useEffect } from "react";
import { tagProjectImage } from "./actions";

export type CanvasImageTag = "inspiration" | "sketch";

type CanvasImageShapeProps = {
  w: number;
  h: number;
  imageUrl: string;
  imageId: string;   // project_images DB record ID (empty string if not yet persisted)
  tag?: CanvasImageTag;
};

const TAG_CONFIG: Record<CanvasImageTag, { label: string; bg: string; color: string }> = {
  inspiration: { label: "Inspiration", bg: "rgba(255,222,40,0.92)", color: "#1A1A1A" },
  sketch:      { label: "Sketch",      bg: "rgba(26,26,26,0.78)",  color: "#FFFFFF"  },
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
          ...cardButtonStyle(!!tag),
          backgroundColor: tag
            ? tag === "inspiration" ? "#FFDE28" : "rgba(26,26,26,0.85)"
            : "rgba(255,255,255,0.95)",
          color: tag === "sketch" ? "#FFFFFF" : "#1A1A1A",
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
  };

  getDefaultProps(): CanvasImageShape["props"] {
    return { w: 400, h: 300, imageUrl: "", imageId: "", tag: undefined };
  }

  override canResize = () => true;
  override canEdit = () => false;
  override hideRotateHandle = () => true;

  component(shape: CanvasImageShape) {
    const { w, h, imageUrl, imageId, tag } = shape.props;
    const editor = this.editor;

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

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "hidden",
          borderRadius: 10,
          backgroundColor: "#F5F4F2",
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        {/* Tag pill — subtle label at bottom-left when tagged */}
        {tag && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              padding: "2px 8px",
              borderRadius: 20,
              backgroundColor: TAG_CONFIG[tag].bg,
              color: TAG_CONFIG[tag].color,
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
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <TagButton tag={tag} onSetTag={setTag} />
        </div>
      </HTMLContainer>
    );
  }

  override async toSvg(shape: CanvasImageShape) {
    const { w, h, imageUrl } = shape.props;

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
    return (
      <foreignObject x={0} y={0} width={w} height={h}>
        <div
          {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
          style={{ width: w, height: h, overflow: "hidden", borderRadius: 10 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </foreignObject>
    );
  }

  indicator(shape: CanvasImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={10} ry={10} />;
  }
}
