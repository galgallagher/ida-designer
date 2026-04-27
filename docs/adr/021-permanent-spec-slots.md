# ADR 021 — Permanent Spec Slots

**Status:** Superseded by ADR 022  
**Date:** 2026-04-27

## Context

When a spec is assigned to a project schedule, a project code is allocated (e.g. `FB01`). Later in a project's life, a spec may need to be swapped out or removed entirely. The question is: what happens to the row in `project_specs` and the code that was allocated?

Interior design projects use formal delivery revisions (Revision A, Revision B, etc.). If `FB01` was on Revision A and then removed before Revision B goes out, `FB01` should still appear on any Revision A document. An empty `FB01` slot on Revision B is legitimate — it indicates the item was superseded, not that it never existed.

## Decision

Once a `project_code` is allocated to a `project_specs` row, that row is **permanent**. "Removing" a spec means detaching it from the slot (`spec_id → null`), not deleting the row. The slot retains its `project_code` and `item_type` and appears as an "Empty slot" on the Schedules page.

Only rows that have never been assigned a code (still in the Project Library, `project_code = null`) can be deleted outright.

The `spec_id` column is made nullable (migration 040) to support this.

**Reassignment:** An empty slot can be reassigned to a different spec without allocating a new code. The existing `FB01` code is reused.

## Consequences

- Revision documents will always be consistent with the database state at the time they were issued.
- Empty slot cards appear on the Schedules page in a muted dashed style with the label "Empty slot" and the code badge.
- Empty slots do **not** appear in the Project Library table — it only shows rows with an attached spec.
- The gap-filling code allocator (`allocateProjectSpecCode`) naturally skips used codes whether the slot is occupied or empty.
- `project_price`, `quantity`, `unit`, and `notes` are retained on empty slots (they were project-specific data, not spec data).
