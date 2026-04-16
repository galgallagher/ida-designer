"use client";

/**
 * SpecCardShape — a custom tldraw shape for product images on the canvas.
 *
 * Why a custom shape instead of a native `image`?
 * - Native image shapes have built-in double-click behaviour (enter crop mode),
 *   which fights our "double-click opens the spec modal" handler.
 * - A custom shape lets us attach a clean DOM onClick that opens the spec
 *   detail modal without tldraw intercepting.
 *
 * Pattern (from tldraw's interactive-shape example):
 * - HTMLContainer with `pointerEvents: 'all'` so the DOM receives events.
 * - The image has `pointerEvents: 'none'` so the click lands on the parent.
 * - onClick fires only when the browser registers a click (no drag) — tldraw
 *   still receives pointerdown/move through the container, so drag/select works.
 * - stopPropagation in onClick prevents tldraw from also treating it as a
 *   canvas click (which would deselect).
 *
 * The shape dispatches a window CustomEvent('canvas:open-spec', { specId })
 * that ProjectCanvasClient listens for — this avoids needing to thread a
 * React callback through tldraw's shape registry.
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLBaseShape,
} from "tldraw";
import type React from "react";

// Props type — kept separate so we can augment tldraw's global shape map.
// code / category / showInfo are optional fields that were added after the
// initial shape shipped, so they're marked optional to keep older snapshots
// loading cleanly (tldraw validates every prop on snapshot load).
//
// showInfo controls whether the text footer (category / name / code) is
// rendered. Default is false — the card is image-only until the user clicks
// the info toggle button, which expands the card by TEXT_AREA_H pixels.
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

// Height of the text footer when info is visible. Used for both layout
// (in component) and for resizing the card when toggling (in the button).
const TEXT_AREA_H = 68;

// Shared style for the small card-corner buttons. `pressed=true` paints the
// button in the yellow CTA colour so the info toggle looks active.
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

// ── Card body renderer ───────────────────────────────────────────────────────
// Used by both component() (interactive) and toSvg() (PDF/image export).
// Returns just the image + optional text footer — NO buttons, NO click handlers.
// The component() wrapper adds the button overlay + HTMLContainer; toSvg()
// wraps this in a <foreignObject>. Factoring it out keeps the visual
// appearance identical between interactive and export rendering.
function SpecCardBody({
  shape,
}: {
  shape: SpecCardShape;
}): React.ReactElement {
  const { h, imageUrl, specName, code, category } = shape.props;
  const infoVisible = shape.props.showInfo === true;
  const imageAreaHeight = infoVisible ? Math.max(h - TEXT_AREA_H, 40) : h;

  return (
    <>
      {/* Image area */}
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
            crossOrigin="anonymous"
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

      {/* Text footer (only when info is toggled on) */}
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
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: "#9A9590",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {category}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1A1A1A",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
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

// Register our custom shape type with tldraw's TypeScript registry so that
// `editor.createShape({ type: "spec-card", ... })` and `BaseBoxShapeUtil<T>`
// both type-check correctly. Without this, tldraw only knows about its
// built-in shape types and treats "spec-card" as unknown.
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
    // Optional: older snapshots predate these props.
    code: T.string.optional(),
    category: T.string.optional(),
    showInfo: T.boolean.optional(),
  };

  getDefaultProps(): SpecCardShape["props"] {
    return {
      w: 240,
      h: 240, // image-only by default (square)
      imageUrl: "",
      specId: "",
      specName: "",
      code: "",
      category: "",
      showInfo: false,
    };
  }

  // Allow resize (handled by BaseBoxShapeUtil), disable rotation/editing
  override canResize = () => true;
  override canEdit = () => false;
  override hideRotateHandle = () => true;

  component(shape: SpecCardShape) {
    const { w, h, specId } = shape.props;
    const infoVisible = shape.props.showInfo === true;

    function openModal(e: React.MouseEvent | React.PointerEvent) {
      e.stopPropagation();
      if (specId) {
        window.dispatchEvent(
          new CustomEvent("canvas:open-spec", { detail: { specId } }),
        );
      }
    }

    // Toggle the info footer. Grow/shrink the shape by TEXT_AREA_H so the
    // image area stays visually identical on either side of the toggle.
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
        {/* Shared body — image + optional text footer. Same renderer as the
          * SVG export path, so the card looks identical in-app and in the PDF. */}
        <SpecCardBody shape={shape} />

        {/* ── Button cluster (top-right, interactive only) ──────────────────
          * Absolutely positioned over the image. stopPropagation on pointerdown
          * prevents tldraw from starting a drag when the user grabs a button;
          * the rest of the card body remains fully draggable because the
          * propagation is only stopped inside these small footprints.
          * These buttons are NOT rendered in SVG exports (see toSvg below).
          */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 6,
          }}
        >
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
            {/* Lucide "info" — circle with lowercase i */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          <button
            type="button"
            title="Open product details"
            aria-label="Open product details"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={openModal}
            style={cardButtonStyle(false)}
          >
            {/* Lucide "arrow-up-right" */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </button>
        </div>
      </HTMLContainer>
    );
  }

  // ── SVG export (PDF, PNG, etc.) ─────────────────────────────────────────
  // When tldraw exports a shape, it calls toSvg if present; otherwise it
  // wraps component() in a foreignObject, which would include our buttons.
  // Overriding toSvg lets us render the same card body inside a foreignObject
  // but WITHOUT the interactive button overlay — so PDFs come out clean.
  override toSvg(shape: SpecCardShape) {
    const { w, h } = shape.props;
    return (
      <foreignObject x={0} y={0} width={w} height={h}>
        <div
          // xmlns is required for XHTML inside SVG foreignObject. React's
          // HTMLAttributes type doesn't list it, so we cast on the attribute.
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
          <SpecCardBody shape={shape} />
        </div>
      </foreignObject>
    );
  }

  indicator(shape: SpecCardShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={14} ry={14} />
    );
  }
}
