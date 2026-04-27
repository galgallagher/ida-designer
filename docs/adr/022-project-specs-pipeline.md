# ADR 022 — Project Specs Pipeline

**Status:** Accepted  
**Date:** 2026-04-27  
**Supersedes:** ADR 020 (project spec codes), ADR 021 (permanent spec slots)

## Context

A project involves three distinct levels of spec management that are easy to conflate but must remain architecturally separate:

1. A global product database shared by the studio
2. A consideration list for a specific project
3. A formal, committed spec document with codes and project-specific data

Getting these confused produces bugs (auto-adding items to the wrong stage, showing the wrong UI, allocating codes too early) and a confusing user experience.

This ADR defines the canonical architecture for all three stages and the rules that govern movement between them. It supersedes ADRs 020 and 021.

---

## The Three Stages

### Stage 1 — Studio Library (`/specs`)

**Table:** `specs`  
**What it is:** The studio's global product database. Every material, fabric, tile, fixture, or product the studio has ever documented. Independent of any project.  
**UI:** Card grid with category sidebar. Search and filter by category.  
**Who manages it:** The studio — via manual entry or the Ida AI scraper.  
**Key rule:** Nothing in the studio library knows about projects. It has no project-specific data.

---

### Stage 2 — Project Library (`/projects/[id]/specs`)

**Table:** `project_specs` WHERE `item_type IS NULL`  
**What it is:** A consideration list — items the designer is *thinking about* for this project. Could be hundreds of items. Nothing is committed. No project code is allocated.  
**UI:** Card grid. Visual and loose — built for browsing and quick addition. Each card has an "Add to schedule" dropdown that promotes the item to Stage 3.  
**How items get here:** Designer clicks "Add to library" and picks from the studio library (Stage 1). One row is inserted into `project_specs` with `item_type = null` and `project_code = null`.  
**Key rules:**
- No project code is allocated at this stage.
- Items here can be fully deleted (the `project_specs` row is removed entirely).
- Items that have been promoted to Stage 3 still appear here with a code badge and their schedule label — they are not removed from the library when assigned. The library shows everything (`spec_id IS NOT NULL`).
- The picker prevents adding a spec that is already in the project at any stage.

---

### Stage 3 — Specs / Schedule (`/projects/[id]/specs/schedule`)

**Table:** `project_specs` WHERE `item_type IS NOT NULL`  
**What it is:** The working spec document. Items here are formally committed to the project. Each has a project code (e.g. `FB01`) and is assigned to a schedule type (e.g. Lighting, FFE, Joinery). This is the document that goes to contractors and gets published in project revisions.  
**UI:** Table view grouped by schedule type. Each row has a small thumbnail. Editable columns: Project Price, Quantity, Unit, Notes. These are project-specific — they never affect the global spec in Stage 1.  
**How items get here:** From the Stage 2 "Add to schedule" dropdown. `item_type` is set and a project code is allocated.  
**Key rules:**
- A project code is allocated **only** at this stage (on first assignment to a schedule).
- "Removing" a spec from the schedule clears `item_type` and `project_code` and returns the row to Stage 2 (the library). `spec_id` is **never** nulled on a remove-from-schedule action.
- The row is only ever deleted via an explicit "Remove from project" action in Stage 2.
- A freed row (back in Stage 2) can be reassigned to a schedule — a new code will be allocated at that point.

---

## Project Code Format and Allocation

**Format:** `{ABBREVIATION}{NN}` — no hyphen, two-digit zero-padded number. Example: `FB01`, `ST03`, `LT12`.

**Abbreviation resolution:**
1. Look up the spec's `category_id` in `spec_categories`
2. If the category has an `abbreviation`, use it
3. If not, walk up to `parent_id` and use the parent's abbreviation
4. If no abbreviation at either level, `project_code` remains `null`

Sub-category abbreviation takes priority over parent — this allows `FB` (Fabric) to live under `FU` (Fabric & Upholstery) without inheriting the parent prefix.

**Gap-filling allocation:** Query all `project_code` values in the project matching the prefix. Parse numbers. Find the lowest missing integer starting at 1. Format with zero-padding. Empty slots count as occupied — their code is not recycled until the slot itself is explicitly voided (not yet implemented).

**Uniqueness:** A `UNIQUE(project_id, project_code)` constraint at the database level (migration 039).

---

---

## Data Model Summary

```
specs                          project_specs
─────────────────              ──────────────────────────────────────────────
id                             id
studio_id                      studio_id
name                           project_id
category_id           ──────▶  spec_id (nullable — null = empty slot)
image_url                      item_type (null = Stage 2, set = Stage 3)
cost_from / cost_to            project_code (null until Stage 3 assignment)
cost_unit                      project_price (project-specific, Stage 3)
...                            quantity / unit (project-specific)
                               notes (project-specific)
                               status
                               created_at / updated_at
```

---

## What NOT to do

- **Do not allocate a project code in Stage 2.** Codes are allocated only when `item_type` is set.
- **Do not auto-add to `project_specs` from the canvas or Ida widget.** The canvas is a freeform inspiration space (ADR 018). Ida scraping saves to the studio library (Stage 1). The designer explicitly promotes items through the stages.
- **Do not null `spec_id` when removing from schedule.** Clear `item_type` and `project_code` instead — the row returns to Stage 2.
- **Do not show empty slots or "detached" rows.** There are no empty slots — every row either has a spec or is deleted.
- **Do not use Stage 3's table view in Stage 2.** The Project Library is a visual card browser. The Specs page is a working document table.
