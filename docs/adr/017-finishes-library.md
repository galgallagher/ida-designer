# ADR 017 — Finishes Library

**Status:** Accepted  
**Date:** 2026-04-14

## Context

Interior design studios routinely work with a standard set of architectural material finishes — wood species, stone types, metals, glass variants, concrete finishes. These are the materials a contractor is typically asked to source and install, and designers need a consistent reference point when specifying them.

Two existing concepts needed to be kept separate:

1. **Studio finish codes** (`studio_finishes`, migration 028) — short reference codes like `WD-01`, `MT-03` assigned to surfaces in technical drawings. Used in the drawings system.
2. **Finishes Library** (`studio_materials`, migration 035) — a browsable material catalogue with images, descriptions, and category organisation. Used as a design reference.

These are fundamentally different: finish codes are a drawing annotation system; the finishes library is a material reference catalogue.

## Decision

### One table: `studio_materials`

Each studio owns its own full copy of the finishes library. There is no shared global table. The seed function `seed_default_studio_materials(p_studio_id uuid)` inserts ~50 standard materials at studio creation time. After that, the studio owns the data entirely — they can add, rename, re-image, or delete any entry.

This is intentionally simpler than the global_specs → specs pattern used for the product library. For finishes, there is no concept of "saving a product from a supplier catalogue" — every studio starts with the same base set and diverges as needed.

### Categories (5)

`wood` · `stone` · `metal` · `glass` · `concrete`

Enforced as a check constraint. Ceramic was deliberately excluded — ceramic items (specific tiles, products) are better suited to the product library where they can carry supplier, SKU, and cost data.

### Images

Images are optional and start null after seeding. Studios upload their own images via the UI. A one-time script (`scripts/seed-material-images.ts`) can be run to pre-populate images from ambientCG (CC0 public domain textures). Default images are stored at `material-images/_defaults/{slug}.jpg`; studio-specific uploads at `material-images/{studio_id}/{material_id}.{ext}`.

The `material-images` Storage bucket is public (same pattern as `spec-images`) — images must load in the browser without auth tokens.

### Route

`/finishes` — top-level route in the main nav, alongside `/specs` (Product Library). Not nested under settings — it is a first-class design tool, not an admin configuration.

## Consequences

- Studios must be seeded with `seed_default_studio_materials()` on creation, alongside the existing `seed_default_spec_categories()` call.
- No cross-studio sharing of materials — studios that want to share a custom finish must recreate it manually. Acceptable trade-off for simplicity.
- The `studio_finishes` table (finish codes) remains separate and unchanged.
- Images sourced from ambientCG are CC0 and require no attribution.
