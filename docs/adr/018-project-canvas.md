# ADR 018 — Project Canvas

**Status:** Accepted  
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

Images dropped onto canvases are uploaded to a `canvas-images` Supabase Storage bucket (public, same pattern as `spec-images`). Path convention: `{studio_id}/{canvas_id}/{asset_id}.{ext}`.

### Spec URL cards (custom shape)

When a user pastes a product URL onto the canvas, we create a custom tldraw shape (`SpecCardShape`) that fires the existing scrape-spec pipeline and renders a rich product card — image, name, brand, price — directly on the canvas. Same underlying infrastructure as the Ida chat widget, different surface.

These cards are not formal project specs. No conversion to `project_specs` at this stage — the canvas is pure inspiration space.

### Persistence

Auto-save on every change, debounced (1.5s). tldraw fires change events; we serialize the snapshot and `UPDATE` the JSONB column. No manual save button.

### Nav placement

"Canvas" appears in the project nav after "Overview" and before "Drawings". It's where projects start, so it belongs near the top.

## Consequences

- tldraw adds a new dependency (~500KB gzipped). Lazy-loading limits the impact to the canvas page only.
- Canvas content is opaque JSONB — we can't query individual items via SQL. Acceptable trade-off for simplicity; if we need structured queries later, we can extract metadata into a side table.
- No real-time collaboration. Single-user editing only. Multi-user would require tldraw's sync protocol — a significant effort for a later phase.
- A default "Inspiration" canvas is auto-created when the user first visits the Canvas tab for a project, so the page is never empty.
