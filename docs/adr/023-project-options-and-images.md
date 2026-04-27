# ADR 023 — Project Options & Images

**Status:** Accepted  
**Date:** 2026-04-27  
**Supersedes:** ADR 022 (project specs pipeline)

## Context

Projects need a place to collect specs that are being considered — materials, fabrics, furniture, etc. — before any formal commitment. An earlier architecture (ADR 022) planned a 3-stage pipeline with project codes, schedule types, and formal spec documents. That complexity was abandoned in favour of a simpler approach that covers the actual use case: a visual consideration board.

Projects also need a way to capture inspiration images and sketches. These start life on the canvas (dropped or pasted) and need to be discoverable without opening the canvas.

## Decision

### Project Options (`project_options`)

A flat consideration list. One row per spec per project, enforced by a unique constraint on `(project_id, spec_id)`.

**Schema:**
```
project_options (
  id          uuid PK
  project_id  uuid FK → projects
  studio_id   uuid FK → studios
  spec_id     uuid FK → specs (NOT NULL)
  notes       text
  status      text DEFAULT 'draft'
  created_at  timestamptz
)
UNIQUE (project_id, spec_id)
```

**Rules:**
- A spec can appear in a project's options only once.
- Rows can be fully deleted (no concept of "empty slots" or permanent codes).
- When a spec is removed from Project Options, all `SpecCardShape` instances with that `specId` are deleted from every canvas in the project via server-side JSON patching.

**No project codes.** No schedule types. No formal documents at this stage.

### Project Images (`project_images`)

Images pasted or dropped onto a canvas are stored here. Each image can be tagged as `inspiration` or `sketch`.

**Schema:**
```
project_images (
  id            uuid PK
  project_id    uuid FK → projects
  studio_id     uuid FK → studios
  canvas_id     uuid FK → project_canvases (nullable — survives canvas deletion)
  storage_path  text NOT NULL
  url           text NOT NULL
  type          text CHECK (type IN ('inspiration', 'sketch')) DEFAULT 'inspiration'
  created_at    timestamptz
)
```

**Lifecycle:**
1. User drops/pastes an image on the canvas → uploaded to `canvas-images` bucket → `project_images` row inserted → `CanvasImageShape` created on canvas with `imageId` prop.
2. User taps the eye button on the shape → selects Inspiration or Sketch → `project_images.type` updated + shape prop updated.
3. User deletes an image from Project Options → `project_images` row deleted → Storage file deleted → `CanvasImageShape` patched out of every canvas JSON.
4. Removing the canvas shape does NOT delete the `project_images` row — deletion is always initiated from Project Options.

### Project Options UI

Route: `/projects/[id]/options`

**Layout:** Full-width content area. Navigation is via sub-items inside `ProjectNav` (the project left sidebar), not a separate panel. This matches the Studio Library pattern.

**ProjectNav sub-items** (shown when on `/options`):
- One item per spec category present in the project (with count)
- Inspiration (with count)
- Sketches (with count)

Sub-items link to `?s={category|inspiration|sketch}`. The page server component reads `searchParams.s` and passes `section` to the client. The client derives `active` from this prop — no local state needed for section.

The project layout fetches sub-nav data (category names + image counts) in parallel with other data so `ProjectNav` can render it without a separate client fetch.

**Content:** Square card grid (same grid as Studio Library). Spec cards show image, category, name, code (reserved space even when empty for consistent height). Image cards show image, date, with hover overlay for delete + retag.

## What NOT to do

- Do not add project codes or schedule types to `project_options`. That complexity belongs in a future "Schedule" feature if it's ever needed.
- Do not auto-populate Project Options from the canvas. Adding a spec to the canvas (via "Add from Library") also adds it to `project_options` — but pasting a URL does not. The link is explicit.
- Do not add a third nav panel/sidebar to the Project Options page. Sub-navigation lives inside `ProjectNav`.
- Do not null `spec_id` on a project option. Either the row exists with a spec, or it's deleted.
