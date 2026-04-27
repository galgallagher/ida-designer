# ADR 020 — Project Spec Codes

**Status:** Superseded by ADR 022  
**Date:** 2026-04-26

## Context

Interior design studios reference specs on drawings and schedules using short codes like `FB-01` or `ST-03`. These codes need to be:

- Unique within a project
- Grouped by material category (prefix = category abbreviation)
- Sequential but gap-filling — removing a spec frees its number; the next addition of that category fills the lowest gap rather than incrementing to the next highest

## Decision

Add a `project_code TEXT` column to `project_specs` (migration 039). A unique constraint on `(project_id, project_code)` enforces uniqueness at the database level.

**Code format:** `{ABBREVIATION}-{NN}` where NN is zero-padded to two digits (e.g. `FB-01`, `ST-12`).

**Abbreviation resolution** (in `addSpecToProject` server action):
1. Look up the spec's `category_id`
2. If the category has an `abbreviation`, use it (sub-category takes priority)
3. If not, walk up to `parent_id` and use the parent's abbreviation
4. If no abbreviation at either level, `project_code` stays `null`

**Gap-filling allocation:** query all `project_code` values in the project matching the prefix, parse numbers, find the lowest missing integer starting from 1.

**On removal:** the `project_specs` row is deleted. The code slot is implicitly freed — the allocator naturally finds it as the lowest gap on the next insertion.

## Consequences

- Existing project specs have `project_code = null`. No backfill — they gain a code only when re-added.
- Race condition risk is low (design tool, not high-concurrency). The unique constraint acts as a safety net and will surface a clear error if two simultaneous adds somehow collide.
- Sub-categories without their own abbreviation inherit from their parent — consistent with how template resolution already works (`resolveTemplateId`).
- No UI for manually overriding a code yet.
