# ADR 026 — Canvas Image Style Controls

**Status:** Accepted
**Date:** 2026-04-28

## Context

Designers using the canvas (ADR 018) need basic image manipulation: flip horizontally, flip vertically, rotate, change corner radius, and snap to a square aspect. tldraw's stock toolbar covers rotation but nothing else. The `CanvasImageShape` and `SpecCardShape` are both image-bearing shapes; the controls should look identical on both.

Two UI shapes were considered: a separate side panel that appears when an image is selected, or a floating bar attached to the shape itself. A floating bar is closer to the visual centre of work, doesn't compete with tldraw's existing toolbar, and matches the in-place editing pattern designers expect from Figma and Canva.

## Decision

### Shared component

A single `ImageStyleBar` component lives at `src/app/projects/[id]/canvas/ImageStyleBar.tsx` and is used by both `CanvasImageShape` and `SpecCardShape`. Props are deliberately primitive — `flipX`, `flipY`, `cornerRadius`, `maxRadius`, `isSquare`, plus four callbacks — so the bar has no knowledge of tldraw or shape utils.

### Floating positioning

The bar is positioned `bottom: calc(100% + 10px)` above the shape, centred horizontally. To make this possible without clipping, the shape's `HTMLContainer` uses `overflow: visible`, with a nested inner `<div>` taking `overflow: hidden` to keep the image clipped to its rounded corners. The bar itself uses `pointerEvents: "auto"` and stops propagation so clicks don't reach the canvas.

### Visibility

The bar shows only when this specific shape is the **sole** selection and the shape is not in edit mode (double-click reposition). The check uses `useValue` against `editor.getSelectedShapeIds()`:

```ts
const isSelected = useValue("isSelected", () => {
  const ids = editor.getSelectedShapeIds();
  return ids.length === 1 && ids[0] === shape.id;
}, [editor, shape.id]);
```

This avoids the n-bars problem when multi-selecting and avoids covering the image while the user repositions it inside the frame.

### Corner radius as a slider

Earlier prototypes used four preset buttons (none / small / medium / large). A continuous slider proved better — designers wanted exact pill-shape and full-circle results, not preset stops. The slider runs from `0` to `Math.floor(Math.min(w, h) / 2)`, so as the shape is resized the maximum radius automatically tracks the shorter side. At max value the image is a circle.

Default `cornerRadius` is `0` (right angles), matching the rest of the Ida UI which uses tight corners except on cards.

### Flip via CSS

`flipX` and `flipY` are applied as a CSS transform on the `<img>` element: `transform: scaleX(-1) scaleY(-1)`. This avoids any tldraw store gymnastics and stays purely visual. The shape's bounds, hit-testing, and bindings are unaffected.

### Make-square

A single-tap "make square" button sets `w` and `h` to `Math.min(w, h)`. Useful for laying out grids of inspiration images that look uneven by default.

### Native rotation

Earlier custom shapes overrode `hideRotateHandle = () => true`. Removed — tldraw's built-in rotation handle is now exposed on both image shapes. No additional code needed.

## Consequences

**Good**
- One component, two consumers, identical UX. No drift between inspiration images and project option cards.
- The bar adds zero shape-level state — `flipX`, `flipY`, `cornerRadius` are plain shape props that round-trip through the existing snapshot/save flow and through Liveblocks (ADR 025) without special handling.
- Slider feel is right for a design tool; preset buttons would have felt rigid.

**Risks / trade-offs**
- The bar overlaps the canvas above the shape, which means it can be clipped by very tall canvases scrolled to the top edge. In practice this is rare; if it becomes a problem we'll add a flip-to-bottom mode.
- `overflow: visible` on the shape container means we have to be deliberate about where clipping happens (the inner frame div). If we add another layer in future, we need to remember which div owns clipping.
- Flip-via-CSS means `toSvg` exports must apply the same transform manually. Both shape utils do this; new image-bearing shapes will need to as well.

## References

- ADR 018 — Project canvas (tldraw)
- `src/app/projects/[id]/canvas/ImageStyleBar.tsx` — shared bar component
- `src/app/projects/[id]/canvas/CanvasImageShape.tsx` — usage from inspiration images
- `src/app/projects/[id]/canvas/SpecCardShape.tsx` — usage from project option cards
