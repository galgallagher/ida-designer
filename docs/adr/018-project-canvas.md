# ADR 018 — Project Canvas

**Status:** Accepted (updated 2026-04-28 — schedule-code overlays, image repositioning, hide-icons toggle, custom-shape ↔ parent communication pattern)
**Date:** 2026-04-15

## Context

Interior design studios typically begin a project by collecting visual inspiration — product images, material swatches, sketches, supplier product pages. This happens before any structured spec or schedule work. The existing Product Library and Project Library are structured tools for later in the process; there was no freeform "thinking space" for the early creative phase.

Studios need a canvas where they can drop images, paste product URLs, and visually arrange options — essentially a mood board that lives inside the project. Multiple canvases per project allow separation by concern (e.g. "Artwork", "Materials", "Concepts").

## Decision

### tldraw as the canvas engine

We use [tldraw](https://tldraw.dev/) — an open-source React canvas library — for pan/zoom, free image placement, multi-select, and custom shapes. tldraw is well-maintained, MIT-licensed, and designed for embedding.

The canvas is lazy-loaded via `next/dynamic` to avoid adding ~500KB to other pages' bundles.

### Data model: JSONB snapshot

One table: `project_canvases` with a `content jsonb` column that holds the entire tldraw snapshot. This is intentionally simple — tldraw manages all layout state internally and serialises to/from JSON. No need to model individual canvas items relationally at this stage.

Multiple canvases per project are supported from day one via `project_id` + `name` + `order_index`.

### Image storage

Images dropped or pasted onto canvases are uploaded to a `canvas-images` Supabase Storage bucket (public, same pattern as `spec-images`). Path convention: `{studio_id}/{canvas_id}/{filename}`.

Each uploaded image is also recorded in the `project_images` table (`project_id`, `studio_id`, `canvas_id`, `storage_path`, `url`, `type`). The `type` column is `inspiration | sketch` — set when the user tags the image via the eye button on the canvas shape. This record is what surfaces the image in Project Options.

### Custom shapes

Two distinct custom tldraw shapes serve different purposes on the canvas:

**`SpecCardShape`** — created when a spec is placed from the "Add from Library" picker or via the Ida widget scrape flow. Renders the spec image as the entire card with two action buttons in the top-right (clipboard = add-to-schedule, arrow = open detail modal) and a white pill in the bottom-left when the spec has been assigned a schedule code. These cards link to a `project_options` row — removing the spec from Project Options deletes all matching `SpecCardShape` instances from every canvas via server-side JSON patching.

The `code`, `category`, and `showInfo` props were retired (no longer rendered) but kept on the shape schema for backwards-compatibility with existing canvas snapshots.

**`CanvasImageShape`** — created when a user pastes or drops an image file directly onto the canvas. Stores an `imageId` prop linking to a `project_images` DB row. Has an eye button (dropdown) to tag the image as **Inspiration** or **Sketch**. Tagged images appear in Project Options under the matching section. Deleting an image from Project Options removes the DB row, the Storage file, and patches out the shape from canvas JSON.

The two shapes are intentionally separate: spec cards are structured library items; canvas images are freeform visual references.

### Custom-shape ↔ parent component communication

Custom tldraw shapes live inside tldraw's renderer; threading React callbacks through the shape registry is awkward. We use two patterns instead:

1. **Window CustomEvents** for shape → parent triggers. A button on a shape calls `window.dispatchEvent(new CustomEvent("canvas:open-spec", { detail: { specId } }))`; the parent (`ProjectCanvasClient`) listens with `window.addEventListener` in a `useEffect`. Used for: `canvas:open-spec`, `canvas:add-to-schedule`.

2. **Window-level signal map** for parent → shape data. The parent maintains shared data (e.g. `Record<specId, scheduleCodes[]>`) on `window.__canvasScheduleCodes` and dispatches `canvas:schedule-codes-updated` whenever it changes. Shapes subscribe via a small `useState` + `useEffect` hook (see `useScheduleCodesForSpec`). Avoids prop-drilling through tldraw's typed shape props.

These patterns are the project's standard way of bridging the React tree inside tldraw and the surrounding app.

### Image repositioning (objectOffsetX/Y)

Both `SpecCardShape` and `CanvasImageShape` support InDesign-style image repositioning inside their frame. tldraw's built-in crop tool only works with its native `image` shape, so we implemented a small alternative:

- Two optional shape props: `imageOffsetX`, `imageOffsetY` (0–1, default 0.5/0.5 = centered). They feed CSS `object-position` on the underlying `<img>` (which has `object-fit: cover`).
- `canEdit = () => true` flips the shape into tldraw's editing mode on double-click. We detect this via `useEditor()` + `useValue(() => editor.getEditingShapeId() === shape.id)`.
- In edit mode, the image area becomes a pointer-capture target. The drag handler computes overflow from `naturalWidth/Height` × cover scale and updates offsets via `editor.updateShape`. A single `markHistoryStoppingPoint` call gives one undo entry per drag.
- A small "Drag image · Esc to finish" pill is shown while editing; Escape / clicking outside exits via tldraw's default behaviour.

### Hide-icons toggle

A header toggle (`Hide icons` / `Show icons`) hides every per-card overlay (action buttons, schedule-code pills, INSPIRATION/SKETCH pills) for a clean printout / screenshot view. Implementation: every overlay container carries the `canvas-card-buttons` class; the canvas wrapper sets `data-hide-card-buttons="true"` driven by a per-project localStorage flag; one global CSS rule (`[data-hide-card-buttons="true"] .canvas-card-buttons { display: none !important }`) does the work. Preference is stored as `canvas:hide-card-buttons:{projectId}` in localStorage.

### Persistence

Auto-save on every change, debounced (1.5s). tldraw fires change events; we serialize the snapshot and `UPDATE` the JSONB column. No manual save button.

### Nav placement

"Canvas" appears in the project nav after "Overview" and before "Drawings". It's where projects start, so it belongs near the top.

## Consequences

- tldraw adds a new dependency (~500KB gzipped). Lazy-loading limits the impact to the canvas page only.
- Canvas content is opaque JSONB — we can't query individual items via SQL. Acceptable trade-off for simplicity; if we need structured queries later, we can extract metadata into a side table.
- No real-time collaboration. Single-user editing only. Multi-user would require tldraw's sync protocol — a significant effort for a later phase.
- A default "Inspiration" canvas is auto-created when the user first visits the Canvas tab for a project, so the page is never empty.
