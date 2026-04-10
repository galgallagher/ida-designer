# ADR 009 — Spec Library Architecture

**Status:** Accepted (updated 2026-04-10 — supplier model replaced, detail modal added)
**Date:** 2026-04-08

## Context

Interior design studios need to maintain a library of material/product specifications — fabrics, tiles, furniture, lighting, etc. Each item needs:
- Categorisation (e.g. "Flooring → Hard Flooring")
- Structured fields that vary by category (e.g. fabric has "weight", tile has "slip resistance")
- Supplier linkage with per-item codes and pricing
- Tags for cross-cutting search
- Images
- The ability to reuse specs across multiple projects

We reviewed programa.design and two GitHub repos (iD-Circuit Front/Back) for prior art.

## Decision

### 1. Category tree (self-join)

`spec_categories` has a `parent_id` FK to itself, allowing a two-level hierarchy (top-level + sub-categories). Kept to two levels for UI simplicity — deep trees are hard to navigate. Studios can edit their categories via `/settings/categories`.

Default categories are seeded per studio via `seed_default_spec_categories(p_studio_id uuid)` — a SQL function that inserts 10 top-level categories with sub-categories.

**Important constraint:** Top-level categories act as containers only — specs must be assigned to a sub-category, not a top-level category directly. The UI enforces this in the category picker step. The spec library sidebar collapses top-level categories whose specs would be zero.

Current default tree (as seeded):
```
Flooring          → Carpet & Rugs, Hard Flooring, Vinyl & LVT
Furniture         → Seating, Tables, Beds, Storage
Lighting          → Pendant, Recessed, Wall Light, Floor Lamp, Table Lamp
Stone & Tile      → Floor Tile, Wall Tile, Natural Stone, Mosaic
Wall Coverings    → Wallpaper, Fabric Wall Covering, Panelling
Fabric & Upholstery  (top-level only, no sub-cats)
Joinery              (top-level only)
Paint & Finishes     (top-level only)
Sanitaryware         (top-level only)
Door Hardware        (top-level only)
```

### 2. Template-driven fields

A `spec_templates` table defines a named template (e.g. "Standard Spec"). `spec_template_fields` defines the fields for each template (name, type, options, order, required flag). Supported field types: `text`, `textarea`, `number`, `currency`, `url`, `select`, `boolean`.

Each spec stores field values in `spec_field_values` (one row per field per spec), keeping the `specs` table lean regardless of how many custom fields exist.

The template approach (vs. fixed columns) was chosen because:
- Different studios will want different fields
- Field sets vary significantly by category
- Adding new field types doesn't require schema migrations

Currently one "Standard Spec" template is shared across all categories. Future: map templates to categories more tightly.

### 3. Suppliers via Contacts CRM (updated)

The original `suppliers` and `supplier_contacts` tables were **dropped in migration 019**. Supplier linkage now uses `contact_companies` from the Contacts CRM (see ADR 008).

`spec_suppliers` (junction table) links `specs.id` → `contact_companies.id` with additional data: `supplier_code`, `unit_cost`. A spec can have multiple suppliers.

This means:
- Every supplier in the spec library is a full contact record visible in `/contacts`
- Studios build their supplier directory automatically as they create specs
- No more duplicated supplier data — one record, visible in both places

### 4. Tags via dedicated table

`spec_tags` (spec_id, tag) rather than an array column — enables efficient filtering across the full library without full-table scans.

Tags are **free-form strings** — no predefined vocabulary. Autocomplete in the spec editor is planned to pull from existing `spec_tags` for the studio. See ADR 011 for the shared tags decision.

### 5. Create/edit/view flow

**View:** Click a spec card in the library → `SpecDetailModal` overlay opens. The modal calls `getSpecDetail(id)` server action on open. No page navigation required. The standalone `/specs/[id]` page still exists for direct URL access.

**Create:** 2-step form. Step 1: category picker (sub-categories only). Step 2: spec details (name, template fields, cost, tags, supplier). Server Action inserts all related rows and redirects to the spec library.

**Edit:** Separate page `/specs/[id]/edit` — pre-filled form. On save, replaces field values, tags, and supplier links (delete-then-insert). Server Action redirects back to spec library.

**Delete:** Inline confirmation in the edit page (not a separate modal).

### 6. Spec library UI — breadcrumb and category labels

When a category is selected in the sidebar:
- The header shows a muted breadcrumb above the main heading: "Spec Library · Flooring"
- The heading reads the sub-category name: "Hard Flooring"
- Cards show the full path label: "FLOORING · CARPET & RUGS" (via `getCategoryLabel()` utility in `SpecLibraryClient.tsx`)

### 7. Images

`image_url` and `image_path` columns on `specs`. Image upload via Supabase Storage is **deferred** — the UI shows a placeholder until implemented.

## Consequences

- Studios must seed default categories on studio creation (currently handled lazily on first page visit — should move to studio onboarding)
- The delete-then-insert pattern for field values on edit is not atomic; if the insert fails, values are lost — acceptable for now, revisit if data integrity issues arise
- `getCategoryLabel()` in `SpecLibraryClient.tsx` runs a map lookup on every card render — acceptable at current data sizes, revisit if spec libraries grow to 1000+ items
- "Add from URL" (AI scraping of supplier pages) is explicitly deferred
