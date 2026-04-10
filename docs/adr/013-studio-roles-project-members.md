# ADR 013 — Studio Roles and Project Members

**Status:** Accepted  
**Date:** 2026-04-10

---

## Context

The studio needs to track two related but distinct concepts:

1. **Who is in the studio** — already existed via `studio_members` with access-control roles (owner/admin/designer/viewer).
2. **What their job title is** — e.g. Senior Designer, Middleweight, Junior. Different studios use different titles and there is no universal hierarchy, so these must be configurable per studio.
3. **Who is working on which project** — a project team assignment so work can be scoped and eventually reported on.

The key insight was that **access control** and **job title** are separate concerns and should live in separate columns/tables. A Junior and a Senior Designer might both have `designer` access level — their title is organisational information, not a permission boundary.

---

## Decision

### `studio_roles` table — configurable job titles

A new table stores the job title labels a studio defines for themselves:

```
studio_roles(id, studio_id, name, sort_order, created_at)
```

- Scoped per studio — each studio defines its own titles
- No hierarchy or rate information yet (kept simple for phase 1)
- Unique constraint on `(studio_id, name)` to prevent duplicates
- RLS: all studio members can read; only owner/admin can write

### `studio_members.studio_role_id` — nullable FK

The existing `studio_members` table gains a nullable `studio_role_id` column pointing at `studio_roles`. ON DELETE SET NULL means deleting a role un-assigns it from all members without deleting the members themselves.

The existing `role` column (owner/admin/designer/viewer) is unchanged and remains the access-control boundary.

### `project_members` table — project team assignment

A join table links studio members to projects:

```
project_members(id, project_id, studio_member_id, created_at)
UNIQUE(project_id, studio_member_id)
```

- RLS: studio members can read project members for their studio's projects; only owner/admin can write
- Cascades on both project and studio_member deletion

---

## Settings UI

- `/settings/roles` — CRUD for job title labels, with reordering
- `/settings/members` — lists all studio members; admin can change access role and job title via dropdowns

## Project UI

- `/projects/[id]/team` — shows assigned members; admin can add from a dropdown of studio members not yet on the project

---

## Consequences

**Positive:**
- Clean separation of concerns: job title (display) vs access role (permissions)
- Studios can name roles however they want — no forced hierarchy
- Easy to add rates to `studio_roles` in a future migration without schema upheaval
- Project team is now trackable and visible in the project overview stat tile

**Trade-offs:**
- Two "role" concepts may confuse users at first — mitigated by clear UI labelling ("Job title" vs "Access level")
- No invite flow yet — members must be added to the system externally; this is intentional for phase 1

**Future:**
- Add `hourly_rate` / `day_rate` to `studio_roles` when billing/reporting is built
- Invite by email via Supabase Auth admin API (ADR TBD)
- Project-level access control (e.g. restrict viewer to only see projects they're assigned to)
