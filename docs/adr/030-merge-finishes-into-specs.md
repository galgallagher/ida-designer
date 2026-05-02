# ADR 030 — Merge Finishes into the Spec Library

**Status:** Superseded by [ADR 031](031-library-product-sourcing-model.md)
**Date:** 2026-04-30
**Superseded:** 2026-05-02

> **Why superseded:** The category-level `source_type` flag and the seeded `Finishes` category tree
> were rejected after further discussion. Studios define their own categories; the supplier-vs-
> contractor distinction is a per-spec property (and is best modelled at the project_options level
> when a library item is assigned to a project). The deeper restructure (canonical product_library
> with library_items as thin pointers + nullable overrides) addresses the same goals — finishes
> become library items with `product_library_id IS NULL`. See ADR 031 for the new model.

## Context

The Finishes Library (`studio_materials`, ADR-less, migration 035) and the Spec Library (`specs`, migration 009) evolved as parallel systems:

| | Finishes Library | Spec Library |
|---|---|---|
| Table | `studio_materials` | `specs` |
| Categories | Hardcoded enum (`wood\|stone\|metal\|glass\|concrete`) | `spec_categories` (hierarchical, studio-editable) |
| Defaults | `default_finishes` + trigger (ADR 028) | `seed_default_spec_categories` |
| Project assignment | Not yet implemented | `project_options` (ADR 023) |
| Schedule | Not yet implemented | `project_specs` (ADR 022) |
| Canvas | Not yet implemented | `SpecCardShape` (ADR 018) |
| 3D Studio | Not yet implemented | `studio_models.assignments` (ADR 027) |
| Supplier link | None | `spec_suppliers` (ADR-less, migration 014) |
| Image upload | `material-images` bucket | `spec-images` bucket |

The user wants to assign finishes to projects, drop them onto the canvas, tag them on 3D meshes, and list them in the Specifications schedule. Building all of that against `studio_materials` would duplicate every spec feature — search, picker, project assignment, canvas card, 3D assignment, future contractor link.

A finish (e.g. "polished brass") is fundamentally the same kind of object as a spec (e.g. "Kirkby Voyage Fabric in Sage"). The only meaningful difference is *who sources it*: a supplier (specs) vs. a contractor (finishes). That's a property of the thing, not a different thing.

## Decision

**Merge `studio_materials` into `specs` as a category-tagged subset, driven by a new `source_type` flag on `spec_categories`.**

### `source_type` on spec categories

Add `source_type text` to `spec_categories` with values `'supplier' | 'contractor' | null`:

- `supplier` — specs in this category are sourced from a supplier (the existing default for everything)
- `contractor` — specs in this category are specified to a contractor; no supplier picker, no SKU/code expectations
- `null` — unspecified (legacy / mixed)

This single flag drives all UI differences:
- Spec detail / edit pages hide the supplier picker for `contractor` categories
- Picker labels read "Specified to contractor" instead of "Sourced from supplier"
- When contractors are introduced as first-class entities, the contractor picker mirrors the supplier picker, gated on `source_type = 'contractor'`

### New "Finishes" category tree

Seed every studio with a top-level `Finishes` category (`source_type = 'contractor'`) and child categories:

- Wood
- Stone
- Metal
- Glass
- Concrete & Plaster

These mirror the five hardcoded categories in `studio_materials.category`. A dedicated `Finish` spec template is created with a single optional `description` field — finishes don't need template fields the way fabrics or lighting do.

### Migration of existing data

For each studio:

1. Ensure the new Finishes categories exist (create if missing) and the `Finish` template exists.
2. For every `studio_materials` row, create a corresponding `specs` row:
   - `name`, `description`, `image_url`, `image_path` copied verbatim
   - `category_id` set to the matching child category (Wood/Stone/etc.)
   - `template_id` set to the studio's `Finish` template
3. Copy the original `material-images` storage objects to the `spec-images` bucket (or alias paths — see Consequences).
4. Drop the `studio_materials` table once verified.

`default_finishes` follows the same pattern: rows become global specs (or a global finish-spec list), and the `trg_seed_default_finishes` trigger is replaced by a new trigger that seeds the Finishes categories + the `Finish` template + the default finish specs into a new studio.

### `/finishes` page

The standalone `/finishes` route stays — it's a useful filtered view — but becomes a thin wrapper over the spec library, scoped to `category.source_type = 'contractor'`. CRUD goes through the existing spec actions instead of `studio_materials` actions.

### Integration points (no new code paths)

Once finishes are specs, every existing integration just works:

- **Project Options** — finishes can be added via `project_options` like any spec. The Project Options page surfaces them in their own visual section (filtered by `source_type = 'contractor'`) so contractor-sourced and supplier-sourced items aren't mixed.
- **Canvas** — finishes appear in `LibraryPickerModal` and drop as `SpecCardShape` like any other spec. No new shape.
- **3D Studio** — finishes appear in the per-mesh spec picker; assignments use the existing `studio_models.assignments` shape.
- **Specifications schedule** — finishes flow through `project_specs` and get an automatic schedule code (e.g. `WD1`, `MT1`) like any other spec.

### Future contractor entity

When contractors are added (planned), they mirror suppliers:

- `contractors` table (parallel to `suppliers`)
- `spec_contractors` junction (parallel to `spec_suppliers`)
- The same `source_type` flag drives which picker shows on the spec detail

No structural rework needed — just add the new tables and wire the picker.

## Consequences

### Wins

- One data model for "things specified into a project". One picker, one card, one schedule, one canvas shape.
- Finishes inherit every spec feature for free: tags, cost ranges, the Ida AI skills, codes, schedule slots, canvas, 3D.
- Future contractor work is symmetric to existing supplier work — no new patterns invented.
- Deletes the parallel `studio_materials` + `default_finishes` tables, the `material-images` bucket, the `copy_default_finishes_to_new_studio` trigger, and the `seed_default_studio_materials` function.

### Costs

- One-shot data migration. Risk: any currently-in-flight UI that touches `studio_materials` will break until rewritten — must do the migration and the UI cut-over in the same release.
- `studio_models.assignments` may currently reference `studio_materials.id` in some flows (3D Studio v1 was built before this merge). Audit and rewrite to reference `specs.id` as part of the migration.
- Storage: existing `material-images` URLs are referenced by `studio_materials.image_url`. Either (a) leave the bucket in place and copy URLs verbatim onto the new spec rows, or (b) re-upload into `spec-images`. Option (a) is simpler and was chosen — the bucket stays public, the new spec rows just point at the existing URLs. The bucket can be renamed/removed in a later cleanup once everything is verified.
- The Admin → Default Finishes page (ADR 028) is rewritten to manage default *specs* in the contractor-sourced categories, rather than rows in a separate `default_finishes` table.

### Out of scope

- Contractor entity itself (deferred — `source_type = 'contractor'` is set up to receive it, but no `contractors` table is introduced here).
- Renaming the `material-images` storage bucket (low priority, bucket name doesn't surface in the UI).
- Backfilling `Finish` template fields (e.g. material type, sheen) — kept minimal for v1; can be extended later without schema change.
