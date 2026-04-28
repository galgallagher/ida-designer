# 024 — Project Specifications (the schedule)

**Status:** Accepted (updated 2026-04-28 — budget fallback, zero-padded codes, "code" terminology, canvas integration)
**Date:** 2026-04-27

## Context

A project has two distinct collections of specs:

- **Project Options** — the deliberation pool. A designer adds 10–20 fabrics they're considering. May or may not be used.
- **Project Specifications** — the committed schedule. The list of items that will actually appear in the project deliverable, each with a code (e.g. `FB1`), a quantity, and a project-specific price.

Interior designers work this way in practice. They know upfront they need 5 fabrics on a project, so they create slots `FB1`–`FB5` and place those codes on drawings (chairs, sofas etc.) before they've decided which actual fabric goes where. Once the fabric is chosen, the slot is "filled" — but the code on the drawing never moves.

If we coupled drawing references to the spec ID directly, every reassignment would mean editing drawings. That's expensive, error-prone, and fights the way designers actually work.

## Decision

Introduce a new table `project_specs` (the schedule) alongside the existing `project_options` (the deliberation pool). They're complementary, not redundant.

### Schema (migration 045)

```
project_specs
├── id              uuid pk
├── project_id      uuid fk → projects (cascade)
├── studio_id       uuid fk → studios (cascade)
├── category_id     uuid fk → spec_categories (restrict)
├── code            text         — e.g. "FB1", unique per project
├── sequence        integer      — the numeric portion (1, 2, 3…)
├── quantity        numeric      — default 1
├── price           numeric      — nullable, project-specific override
├── spec_id         uuid fk      — nullable, the assigned spec; SET NULL on delete
├── notes           text         — nullable
└── created_at / updated_at timestamptz
```

Constraints: `(project_id, code)` unique; `(project_id, category_id, sequence)` unique; RLS via `auth_user_studio_ids()`.

### Code generation

Codes are auto-generated, never user-edited:

1. Walk the category chain (deepest first) and use the first non-null `abbreviation`. Subcategory wins over its parent.
2. Find the highest existing `sequence` for `(project_id, category_id)` and add 1.
3. Compose `{ABBREVIATION}{SEQUENCE}` (e.g. `FB01`, `LIN03`). The numeric portion is zero-padded to 2 digits (migration 049 backfilled existing codes).

If no abbreviation exists anywhere on the chain, fall back to the first two letters of the deepest category name uppercased.

### Terminology: "code", not "slot"

Internally and in the UI we use **code** — the user-visible identifier `FB01`. "Slot" was the original implementation name and is retained only where unavoidable (e.g. property accessors like `slot.code` where renaming would collide with the `code` string itself). Exported server-action names use `code` (`createSpecCode`, `assignSpecToCode`, `unassignCode`, etc.).

### Decoupling drawings from products

Drawings reference the slot **code** (a string like `FB1`), not the slot ID and not the assigned `spec_id`. Reassigning which fabric fills `FB1` is therefore a one-row update that no drawing ever sees.

### Slots can be empty

`spec_id` is nullable. Designers can pre-create `FB1`–`FB5` before assigning anything. Multiple slots may share the same assigned spec (the same fabric used in two places).

### Adding from Project Options

The "Add to schedule" action on a Project Options card opens a picker dialog so the choice is explicit:

- Lists every empty code eligible for the spec's category (the spec's category and all its ancestors — e.g. a Linen spec fits a Fabric code).
- A yellow **Create new code** button below always creates a fresh code in the spec's own category.

The same dialog is reused on the canvas: the clipboard button on a `SpecCardShape` dispatches `canvas:add-to-schedule`; `ProjectCanvasClient` listens, fetches eligible codes via `getScheduleContextForSpec`, and renders the same picker — including an "Already assigned to" panel showing existing codes for that spec.

Adding a spec from the studio library directly (not via Options) also inserts a row into `project_options`, keeping Options as the source of truth for "what's in play" on the project.

### Budget vs price (migrations 047, 048)

Each `project_specs` row has both `price` (the agreed project price) and `budget` (an early estimate). The total reported in the UI uses `price` if set, otherwise `budget`, and shows a small "Budget" pill so the figure isn't mistaken for confirmed.

For reporting, the schema includes two PostgreSQL **generated columns** (migration 048):

```
effective_unit_cost numeric  GENERATED ALWAYS AS (COALESCE(price, budget)) STORED
is_budgeted         boolean  GENERATED ALWAYS AS (price IS NULL AND budget IS NOT NULL) STORED
```

A partial index on `is_budgeted = true` lets the budget reporting suite cheaply find every still-unconfirmed line. Generated columns mean the flag can never drift from the underlying data.

`Insertable<ProjectSpecRow>` excludes both generated columns so client code never tries to write them.

### Inline edit in SpecDetailModal

A separate `updateSpecInline` server action (in `src/app/specs/actions.ts`) updates only the fields exposed in the modal — name, code, description, cost, and template field values — and returns `{error}` rather than calling `redirect()`. The full `updateSpec` action remains for the dedicated edit page (which handles image upload, tags, and supplier wiring).

This split is intentional: `redirect()` inside a server action breaks inline UX; building a no-redirect mirror is cheaper than refactoring the existing edit form to support both flows.

## Consequences

### Positive

- Drawings are insulated from product reassignment — the central design goal.
- The schedule is a clean tabular artefact, suitable for export to PDF/Excel later.
- Codes are deterministic and generated server-side.
- Options vs Specifications is a clean split: deliberation vs commitment.

### Negative / risks

- Two tables that look similar (`project_options`, `project_specs`). The naming is load-bearing — must stay clear in UI labels.
- If a category's `abbreviation` changes after slots exist, existing codes won't auto-update. That's deliberate — codes are stable identifiers — but worth flagging in admin UI later.
- Deleting a category with slots is blocked by `ON DELETE RESTRICT`. Forces deliberate cleanup; adds a small admin friction.

### Out of scope (for later)

- **Revisions.** A formal "issue" of the schedule will eventually snapshot the rows into a `project_spec_revisions` table. Not built yet — but the current schema has no revision-bound fields, so adding it later is additive.
- **Drawing hotspot wiring.** Hotspots currently pin specs by ID. Migrating them to reference `project_specs.code` is a separate piece of work, deferred until the schedule UI is solid.
- **Custom code overrides.** Codes are auto-generated only. If users later want to override (e.g. `FB-LINEN`), that's an additive feature.
