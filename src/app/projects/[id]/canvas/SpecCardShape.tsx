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
  type RecordProps,
  type TLBaseShape,
} from "tldraw";
import type React from "react";

type SpecCardShapeProps = {
  w: number;
  h: number;
  imageUrl: string;
  specId: string;
  specName: string;
  code?: string;
  category?: string;
  showInfo?: boolean;
};

// Height of the text footer when info is visible.
const TEXT_AREA_H = 68;

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

function SpecCardBody({ shape }: { shape: SpecCardShape }): React.ReactElement {
  const { h, imageUrl, specName, code, category } = shape.props;
  const infoVisible = shape.props.showInfo === true;
  const imageAreaHeight = infoVisible ? Math.max(h - TEXT_AREA_H, 40) : h;

  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: imageAreaHeight,
          overflow: "hidden",
          backgroundColor: "#F5F4F2",
          flexShrink: 0,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={specName}
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
      </div>

      {infoVisible ? (
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {category ? (
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.6, color: "#9A9590", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {category}
            </div>
          ) : null}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {specName || "Product"}
          </div>
          {code ? (
            <div style={{ fontSize: 11, color: "#9A9590" }}>{code}</div>
          ) : null}
        </div>
      ) : null}
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
    };
  }

  override canResize = () => true;
  override canEdit = () => false;
  override hideRotateHandle = () => true;

  component(shape: SpecCardShape) {
    const { w, h, specId } = shape.props;
    const infoVisible = shape.props.showInfo === true;

    function openModal(e: React.MouseEvent | React.PointerEvent) {
      e.stopPropagation();
      if (specId) {
        window.dispatchEvent(new CustomEvent("canvas:open-spec", { detail: { specId } }));
      }
    }

    const toggleInfo = (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextVisible = !infoVisible;
      const delta = nextVisible ? TEXT_AREA_H : -TEXT_AREA_H;
      this.editor.updateShape<SpecCardShape>({
        id: shape.id,
        type: "spec-card",
        props: { showInfo: nextVisible, h: h + delta },
      });
    };

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "hidden",
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-inter), sans-serif",
          position: "relative",
        }}
      >
        <SpecCardBody shape={shape} />

        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
          {/* ⓘ — toggle info footer */}
          <button
            type="button"
            title={infoVisible ? "Hide details" : "Show details"}
            aria-label={infoVisible ? "Hide details" : "Show details"}
            aria-pressed={infoVisible}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={toggleInfo}
            style={cardButtonStyle(infoVisible)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

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
      </HTMLContainer>
    );
  }

  override async toSvg(shape: SpecCardShape) {
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
            borderRadius: 14,
            backgroundColor: "#FFFFFF",
            boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          <SpecCardBody shape={shapeForExport} />
        </div>
      </foreignObject>
    );
  }

  indicator(shape: SpecCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={14} ry={14} />;
  }
}
