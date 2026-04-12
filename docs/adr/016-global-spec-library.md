# ADR 016 — Global Spec Library & idcircuit v2 Project Model

**Status:** Accepted  
**Date:** 2026-04-12

---

## Context

Two problems needed solving simultaneously:

**Problem 1 — Duplicate scraping.** Every studio was isolated. If Studio A scraped `https://johnlewis.com/product/xyz` and Studio B scraped the same URL, two separate Firecrawl/Haiku calls were made and two isolated spec records were created. As the platform grows to multiple studios, this wastes API cost and loses any network effect of shared product data.

**Problem 2 — Flat project model.** The existing project model was `Studio → Project → Drawings + Specs`. It couldn't express parallel design directions (Option A/B/C), enforce drawing types, or represent finish codes as a first-class studio entity. This made it impossible to build proper finish schedules and specification documents.

---

## Decision

### Part 1 — Global Spec Library (migrations 025–026)

Add a platform-level `global_specs` table (no `studio_id`) as a product data cache. Extend `specs` with a nullable `global_spec_id` FK.

**Scrape flow:**
1. Check `global_specs.source_url` first. If found and this studio hasn't pinned it yet → return global data immediately, no network call.
2. If found and studio already pinned it → return `already_exists`.
3. If not in global library → scrape normally, then write to `global_specs` (service_role, non-blocking) before returning.

**Pin flow:** When saving a global-sourced spec, load `global_spec_fields`, fuzzy-map them to the studio's template fields (via `match-fields.ts`), copy global tags, resolve supplier from `brand_domain`. The studio gets a fully-formed `specs` row with `global_spec_id` set.

**Edit behaviour:** `global_spec_id` is NEVER automatically nulled. The studio's `specs` row is their own copy; edits only affect it. The global link is preserved for provenance and future "Refresh from source" (deferred). A studio can explicitly detach later.

**Global write security:** All writes to `global_specs`, `global_spec_fields`, `global_spec_tags` use `createAdminClient()` (service_role key, server-only). RLS on these tables: authenticated SELECT, service_role ALL.

### Part 2 — idcircuit v2 Project Model (migrations 027–032)

Introduce `project_options` as a layer between `Project` and `Drawings`/`Spec Items`:

```
Studio
├── Library (global_specs → studio specs)
└── Project
    └── Project Options (A, B, C…)
        ├── Drawings (drawing_type: arch_id | joinery | ffe)
        │   └── Studio Finishes assigned via drawing_finishes junction
        └── Spec Items (item_type: ffe | ironmongery | sanitaryware | joinery | arch_id_finishes | joinery_finishes)
            └── optional link to a Drawing

Studio Finishes (flat, studio-scoped — WD-01, FB-03, MT-07)
└── optional FK → global_specs (Global Material Library)

Studio Spec Preferences (UX-only field visibility per studio)
```

Key decisions:
- `studio_id` is denormalised onto `project_options`, `drawings`, and `project_specs` for direct RLS checks (consistent with ADR 002).
- `drawings.project_id` and `project_specs.project_id` are KEPT as legacy columns during transition; dropped in migration 033 once all app code is updated.
- Every new project auto-creates a default "Option A" in `createProject` server action.
- Migration 032 backfills all existing `project_specs` to point to a newly-created Option A per project.
- `drawing_finishes` uses CASCADE on both sides — deleting either a drawing or a finish removes the assignment, never the entities themselves.

---

## Consequences

### Positive
- Firecrawl + Haiku API cost saved for every URL already in the global cache.
- Second-studio scrape returns in milliseconds (DB query only, no network call).
- `global_spec_id` link enables a future "Refresh from source" button and supplier self-service.
- Project model now supports Option A/B/C design directions natively.
- Finish codes (WD-01, FB-03) are first-class studio entities, assignable to any drawing type.
- `spec_item_type` enum enables proper schedule generation (FF&E schedule, ironmongery schedule, etc.).
- Zero breaking changes to existing spec library queries — `global_spec_id` is nullable and additive.

### Trade-offs
- Global spec data quality depends on the first scrape. No curation UI in v1. Studios can always edit their own spec row.
- Field mapping at pin time uses the same fuzzy matching as today — imperfect for unusual label formats.
- `project_id` legacy columns on `drawings` and `project_specs` must be cleaned up (migration 033) after app code is updated. Tracked in known technical debt.
- `createAdminClient()` must never be used client-side. Enforced by server-only placement and no `NEXT_PUBLIC_` prefix on `SUPABASE_SERVICE_ROLE_KEY`.

### Deferred
- Field-level diff/override between studio spec and global record (Phase 2, when suppliers manage global records).
- "Refresh from source" button in spec detail.
- Supplier self-service portal for populating `global_specs` directly.
- Migration 033 (drop `project_id` legacy columns) — after all app code has been verified.
- `studio_spec_preferences` UI — table exists, no frontend built yet.
- Project options UI — schema and `createProject` wiring complete; `/projects/[id]/options` page deferred.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/025–032` | New tables: global_specs, studio_finishes, project_options, etc. |
| `src/types/database.ts` | New Row types, enums, Insert types |
| `src/lib/supabase/server-admin.ts` | New — service_role client for global writes |
| `src/lib/ida/match-fields.ts` | New — extracted fuzzy field-matching utility |
| `src/lib/ida/skills/scrape-spec.ts` | Global check before scrape, global write after |
| `src/app/api/ida/save/route.ts` | Pin flow (global_spec_id, from_global) |
| `src/lib/ida/skills/save-spec.ts` | Pass global_spec_id through |
| `src/app/specs/actions.ts` | Add global_spec_id to SpecDetailData |
| `src/app/specs/SpecDetailModal.tsx` | "Shared library" badge |
| `src/app/projects/actions.ts` | Auto-create Option A on project creation |
| `src/app/projects/[id]/page.tsx` | Count queries via project_options |
