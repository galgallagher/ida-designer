# ADR 003 — Client ownership model: studio-scoped now, optional grouping later

**Status:** Accepted  
**Date:** 2026-04-08

## Context

When designing the `clients` table, two models were considered:

**Option A — Studio-scoped clients (chosen)**  
Each studio creates and fully owns its own client records. Studio A's "Hilton UK" is a completely separate record from Studio B's "Hilton UK". Studios can only ever see their own clients.

**Option B — Shared top-level clients**  
A client like "Hilton" exists once in the database and multiple studios link to it via a join table.

Option B was initially considered but rejected for the following reasons:

1. **Entity ambiguity.** "Hilton UK" and "Hilton International" are genuinely different legal entities with different contacts, billing addresses, and decision-makers. Treating them as the same client would be incorrect.

2. **Studio autonomy.** Studios need to fully own and control their client records. They should not have to coordinate with other studios on shared data, and they should have no visibility into who else is working with a given client.

3. **Premature complexity.** The shared model requires a join table, more complex RLS policies, and application-level logic to handle atomic writes to two tables. This overhead is not justified until there is a real product need for cross-studio client visibility.

## Decision

`clients` is **studio-scoped**. `studio_id` is a non-nullable column on `clients`. A studio creates and owns its clients; they are invisible to all other studios. RLS enforces this at the database level.

## Future: optional client organisations

When the product matures to the point where clients (e.g. Hilton) want to log in and see all design studios working on their various projects, a separate `client_organisations` table will be introduced. This will be an **additive, opt-in layer** — individual client records can optionally link to a parent organisation, which is what client-side users would authenticate against.

This future addition does not require changing the `clients` table structure. It is a new table with a nullable FK back to `clients`, added when there is validated demand for it.

## Consequences

- Studios have complete autonomy over their client data — no shared state to reason about
- Simple, fast RLS: a single `studio_id` check
- No cross-studio client deduplication needed yet
- When a client like Hilton works with multiple studios, each studio maintains its own record — this is correct for now, as each relationship (Hilton UK with Studio A, Hilton International with Studio B) is independently managed
