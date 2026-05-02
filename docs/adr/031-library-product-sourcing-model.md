# ADR 031 — Library, Product, and Project Sourcing Model

**Status:** Accepted
**Date:** 2026-05-02
**Supersedes:** ADR 030

## Context

The codebase has grown three parallel "spec-like" tables and the terminology no longer matches what they actually do:

| Table (old name) | What it actually is |
|---|---|
| `global_specs` | Platform-wide canonical product cache. One row per unique scraped URL. Cross-studio readable. |
| `specs` | A studio's curated library — items they've added (scraped or manual). Currently stores a *full copy* of canonical data even when linked to `global_specs`. |
| `studio_materials` | Separate finishes palette (wood/stone/metal/glass/concrete). Empty in production (0 rows). |
| `default_finishes` | Platform defaults for `studio_materials`. Also empty. |
| `project_options` | Junction: a library item assigned to a project. Has qty/notes/status. |
| `project_specs` | Committed schedule slots with auto-generated codes (FB01, WD02). |

Three problems:

1. **Confusing names.** "Global specs" sounds like a kind of spec; it's really a product cache. "Specs" are studio library items, not project specifications. The mental model should be **Library → Project Option → Project Spec**.
2. **Data duplication on scrape.** When two studios scrape the same Farrow & Ball URL, `global_specs` correctly stores one row — but each studio's `specs` row still has a full copy of the name, image, description, cost. The `global_spec_id` FK is just a breadcrumb, not a live link. This works against the long-term marketplace vision (Ida pre-loads canonical product data; studios *source* from a shared catalogue).
3. **Finishes don't fit either model cleanly.** A "Calacatta Oro" finish a studio uploads with just a name + image is conceptually different from a sourced product (Calacatta Oro from Stone Theatre). Finishes have no URL, no canonical equivalent, no marketplace value. But they share every downstream path with sourced products: project options, schedule slots, canvas, 3D mesh assignments.

## Decision

### Rename to match the new mental model

| Old name | New name | Notes |
|---|---|---|
| `global_specs` | `product_library` | The canonical product catalogue |
| `global_spec_fields` | `product_library_fields` | |
| `global_spec_tags` | `product_library_tags` | |
| `specs` | `library_items` | A studio's library entry |
| `spec_field_values` | `library_item_field_values` | |
| `spec_tags` | `library_item_tags` | |
| `spec_suppliers` | `library_item_suppliers` | |
| `spec_categories` | `library_categories` | |
| `spec_templates` | `library_templates` | |
| `spec_template_fields` | `library_template_fields` | |
| `project_options` | `project_options` | Unchanged — already the right name |
| `project_specs` | `project_specs` | Unchanged — these are the schedule slots |

FK column renames:

| Old column | New column | On table |
|---|---|---|
| `global_spec_id` | `product_library_id` | `library_items`, `product_library_fields`, `product_library_tags` |
| `spec_id` | `library_item_id` | `library_item_field_values`, `library_item_tags`, `library_item_suppliers`, `project_options`, `project_specs` |

### Canonical / override pattern for sourced products

`library_items` keeps `product_library_id` as a **nullable** FK to `product_library`. Two modes:

**Sourced (`product_library_id` IS NOT NULL)** — the canonical name/image/description/cost lives in `product_library`. The studio's `library_items` row is a thin pointer with optional **override columns**:

```
library_items
  + name_override         text
  + description_override  text
  + image_url_override    text
  + image_path_override   text
  + cost_from_override    numeric
  + cost_to_override      numeric
  + cost_unit_override    text
```

Reads do `COALESCE(library_items.name_override, product_library.name)`. NULL override = use canonical. Set override = use studio's local value. "Reset to source" clears the override.

When the canonical row updates (price change, new image, supplier amends a marketplace listing), every studio's library reflects the change automatically — except where they've explicitly overridden.

**Finish (`product_library_id` IS NULL)** — there is no canonical row. The data lives directly on `library_items.name`, `image_url`, `description`, `cost_from`, etc. Manually added finishes (a studio uploads "Calacatta Oro" with their own photo) take this path. No global dedup happens; each studio's "Calacatta Oro" is its own row, which is correct because they're studio-private descriptions, not products.

### One library table for both modes

Sourced products and finishes share `library_items`. The presence/absence of `product_library_id` distinguishes them. This was a real design decision (see "Considered alternatives") — the case for splitting into two tables is real, but it would force every downstream system (project_options, schedule, canvas picker, 3D mesh assignments, Ida AI skills) to handle both. One table with a nullable canonical link keeps the surface area small.

The picker UI can still cleanly group items as "Sourced products" / "Finishes" — that's a presentation concern, not a schema one.

### Future: project-level supplier/contractor sourcing

When a library item is assigned to a project (`project_options`), the studio decides for *this project* who's actually sourcing it. The library item's primary supplier is a default; the project may use a different distributor, or specify it to a contractor instead.

This is implemented in **Release 2** (separate ADR / migration), adding nullable `supplier_id` and `sourced_by` (`'supplier' | 'contractor' | null`) to `project_options`. Not part of Release 1.

## Consequences

### Wins

- Terminology matches the mental model: Library → Project Option → Project Spec.
- Canonical data lives in one place. Scraping the same URL twice never produces duplicate canonical data, only a new `library_items` pointer.
- Foundation laid for the marketplace: Ida pre-populates `product_library`; studios "add to library" creates a thin pointer; eventually suppliers maintain their own canonical rows.
- Finishes coexist with sourced products in one table — no parallel paths through the schedule, canvas, 3D Studio, or AI skills.
- Override pattern lets studios personalise (rename, custom photo) without forking the canonical row.

### Costs

- One large rename migration (054) touches ~10 tables and ~25–30 code files. Mitigated by: only one studio (Test Studio) has real data — 16 library items — so the data risk is minimal.
- The override pattern adds 7 nullable columns to `library_items`. Mild schema noise in exchange for a clean read path.
- The `library_items.name`, `image_url`, etc columns have ambiguous meaning depending on `product_library_id`. Documented via column comments; server actions resolve via `COALESCE`.
- Existing rows have duplicated data (because the old code copied canonical fields onto `specs`). This is harmless — server actions written against the new pattern just ignore the duplicated data when `product_library_id IS NOT NULL`. A future cleanup migration could null those columns out.

### Considered alternatives

**A — Two separate tables (`library_items` + `studio_finishes`).** Conceptually cleaner: a finish is a *description*, a library item is a *product*. Rejected because every downstream system would need polymorphic FKs or duplicate columns on `project_options`, `project_specs`, canvas picker, 3D mesh assignments, AI skills. The maintenance cost outweighs the conceptual neatness. A studio that starts with a finish and later decides to source it from a specific supplier should be able to *edit* the library item, not delete-and-recreate.

**B — Required `product_library_id` (always create a canonical row).** Cleaner read path (always join), but means a "product_library" entry exists for every private studio finish, with `source_url = NULL` to bypass the unique constraint. Pollutes the canonical catalogue with private data. Rejected.

**C — `source_type` flag on categories (ADR 030's original design).** Treated finishes as a category-level concept, with a hardcoded `Finishes` category tree per studio. Rejected because (i) studios should define their own categories — paint might be supplier-sourced or contractor-sourced depending on the studio's preference; (ii) the real distinction is at the spec level, not the category level. ADR 030 is superseded.

### Out of scope (Release 2 / Release 3)

- Project-level sourcing (`project_options.supplier_id` and `sourced_by`) — Release 2.
- Dropping `studio_materials` and `default_finishes` — Release 3 cleanup.
- Storage bucket consolidation (`material-images`, `spec-images` → `product-library-images`) — Release 3.
- Marketplace ingestion (Ida or suppliers populating `product_library` directly) — future work.
- Data backfill that nulls the duplicated columns on existing `library_items` rows — future cleanup.

## Migration

See `supabase/migrations/054_library_model_restructure.sql`. The migration:

1. Drops domain-stale RLS policies (recreated with new names at the end).
2. Drops the two seed functions that reference renamed tables (recreated with updated bodies and renamed: `seed_default_library_categories`, `seed_default_library_templates`).
3. Renames all tables and FK columns.
4. Adds the seven `*_override` columns to `library_items`.
5. Recreates RLS policies with new names that match the new domain.
6. Recreates seed functions with updated bodies.

The migration does **not** backfill or canonicalise existing data. Server actions written in the next code release will read `product_library` when `product_library_id IS NOT NULL`, and read directly from `library_items` columns when it is `NULL`. Legacy rows with duplicated canonical data on `library_items` are harmless — the new read path ignores those columns when the canonical is present.
