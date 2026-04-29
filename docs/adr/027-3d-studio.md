# ADR 027 — 3D Studio

**Status:** Accepted
**Date:** 2026-04-29

## Context

Interior design studios need to visualise individual 3D models (furniture, fixtures, fittings) with real materials applied, so they can create presentation images for clients. The workflow is: export a model from Rhino or SketchUp → upload to Ida → assign materials from the project's spec library to each mesh → capture a render for the client.

Ida already holds the materials library (specs with product images). The 3D Studio makes it the authoritative source of material decisions for a project's 3D assets.

## Decision

### Feature scope (v1)

- **Formats:** GLB, GLTF, FBX, and OBJ. Rhino 7 does not natively export GLB, so FBX and OBJ are needed for the primary user base. Format dispatch happens client-side: drei's `useGLTF` for GLB/GLTF, `useFBX` for FBX, R3F's `useLoader(OBJLoader)` for OBJ. Each format runs through a normalisation pass (see below) so the rest of the pipeline (texture application, selection, IBL lighting) is identical across formats.
- **Upload:** browser-side upload to Supabase Storage (`studio-models` private bucket). File path: `{studio_id}/{model_id}/{filename}`. Auto-save: text+assignment changes debounce to the DB at 800 ms.
- **Renderer:** WebGL2 (default R3F renderer). WebGPU was the original goal but drei's components and Three's shadow system still emit WebGL-only materials (`MeshDepthMaterial`, `ShaderMaterial`) that WebGPU's NodeBuilder rejects, and `gl.capabilities.getMaxAnisotropy()` doesn't exist on WebGPURenderer. We'll revisit when the ecosystem catches up.
- **Tone mapping:** AgX default. ACES Filmic and Khronos Neutral selectable in the Scene panel.
- **Lighting:** IBL via drei `<Environment preset="studio" />` (intensity user-adjustable). One soft directional fill light to give shape to dark/unmapped materials. ContactShadows for grounding. Background and grid colour adapt to scene background mode.
- **Material application:** the user selects one or many meshes (shift/cmd-click to multi-select) and picks a spec from the project's spec library. The spec's `image_url` is applied as a texture, with per-mesh sliders for scale (linked X/Y by default, optional split), rotation, brightness, roughness, and metalness. By default, transform/level edits broadcast to every mesh sharing the same spec; a checkbox unlinks them.
- **Mesh display labels:** users can rename meshes inline (display name only — assignment storage still keys on the file's original mesh name). Persisted in `studio_models.mesh_labels` JSONB.
- **Source-material strip:** every loaded mesh's source material is replaced with a uniform neutral PBR (`#EEEEEE`, roughness 0.55). Embedded textures are intentionally discarded — the user owns material decisions via spec assignments.
- **Landing page:** the studio opens to a card grid (mirroring Project Options): every model is a card with name (inline-editable), format chip, and a hover-revealed delete button. Click a card to enter the editor; "← All models" returns to the grid.
- **Render export:** browser screenshot of the Three.js canvas, sent to Replicate img2img for photorealistic enhancement (not yet wired). No server-side render pipeline.

### Data model

Table `studio_models` (migration 050) with columns added by migration 051:

- `studio_id`, `project_id` — multi-tenant, project-scoped
- `file_path` — path in Supabase Storage (never a public URL)
- `format` — enum: glb | gltf | fbx | obj
- `material_assignments` — JSONB: `{ [meshName]: { specId, scaleX, scaleY, rotation, roughness, metalness, brightness } }`. Legacy string-only entries are read-compatible via `readAssignment()`.
- `mesh_labels` — JSONB: `{ [originalMeshName]: displayName }` (migration 051)
- `thumbnail_url` — optional, set after first render

### Format normalisation

Every loaded model passes through a strip + normalise step before rendering:

| Format | Normalisation pass |
|---|---|
| GLB / GLTF | Strip materials → neutral PBR. Anisotropy on basecolor textures. |
| FBX | Scale heuristic (×0.01 if bounding sphere > 50). Strip materials → neutral PBR. |
| OBJ | Scale heuristic. Strip materials → neutral PBR. `computeVertexNormals()` if normals attribute is missing. |

The classic FBX gotchas (DirectX→OpenGL normal flip, MeshPhong→MeshStandard conversion) become non-issues since we don't preserve source materials in v1.

### UI structure (in the editor view)

- Three-panel body: **MeshListPanel** (left) | **R3F viewport** (centre) | tabbed **MaterialPanel / ScenePanel** (right).
- Top bar: `← All models` link, model name (inline-editable), format chip, save status badge (saving / saved / error).
- The Scene panel contains every renderer-affecting control (tone mapping, exposure, env intensity, key light, shadow strength, background mode, grid toggle). Persisted to `localStorage` per browser.
- The MaterialPanel has its own filter for excluding spec categories from the picker (also persisted to `localStorage`).

### Navigation

"3D Studio" sits in `ProjectNav` between Canvas and Project Options.

### Storage security

- Bucket is private. Download URLs are Supabase signed URLs (1-hour expiry), generated server-side in a Server Action.
- RLS on `studio_models` uses `ANY(SELECT auth_user_studio_ids())` (see ADR 007).
- Storage policies check `bucket_id = 'studio-models'` + authenticated; cross-studio isolation is enforced in the server actions that mint signed URLs.

## Consequences

- Source materials are intentionally discarded — this is a deliberate v1 simplification given the workflow (users always reassign Ida specs anyway). Means we get away with not solving FBX MeshPhong/normal-flip edge cases.
- Product photos applied as textures will not tile correctly for large meshes. The texture-map generation pipeline (Replicate) will address it in v2.
- WebGPU was deferred. The viewer is WebGL2-only for now and works in every browser the rest of Ida supports.
- Per-mesh transforms keyed on the file's original mesh name → renaming via `mesh_labels` is purely cosmetic and never breaks assignments.
