# ADR 028 — Platform Admin section

**Status:** Accepted
**Date:** 2026-04-29

## Context

The platform owner (super_admin role, set on `profiles.platform_role`) needs to manage cross-studio concerns: viewing every studio on the platform, curating defaults that get seeded into new studios, and (in the future) managing the global product library and billing.

The existing app (`AppShell` + `SidebarNav`) is studio-context aware — it loads the current studio, its clients, its projects, and its members. Embedding admin pages inside that shell mixed two scopes (platform vs. studio) and felt wrong.

There was also a hardcoded SQL function `seed_default_studio_materials(studio_id)` that nothing called from the app. Even if it were called, it would require a schema migration to change the seed list — not workable for an evolving curated default set.

## Decision

### Separate shell

Add `AdminShell` + `AdminSidebar` (`src/components/admin/`) — a dedicated chrome with a dark sidebar, no studio switcher, no project sub-list. Routes under `/admin/*` use this shell exclusively. The `/admin/layout.tsx` redirects non-super-admins to `/projects` before any page renders.

The admin sidebar nav: **Overview** · **Studios** · **Default Finishes** · **Global Library** (Soon). Bottom: "← Exit admin" (returns to `/projects`) + Sign out.

### Routes

- `/admin` — landing with cards linking to each section.
- `/admin/studios` — table of every studio with member count, project count, and subscription status badge.
- `/admin/studios/[id]` — detail: header card, members list with role badges, billing placeholder (Stripe not yet wired), projects grid.
- `/admin/default-finishes` — CRUD for platform defaults (see below).

### Default Finishes — data-driven seeding

New table `default_finishes` (migration 052) — same shape as `studio_materials` minus `studio_id`:

- RLS: super-admins write, all authenticated users read.
- Storage: existing `material-images` bucket with `_defaults/` path prefix; super-admin-only writes.
- A trigger `trg_seed_default_finishes` on `INSERT INTO studios` automatically copies every row from `default_finishes` → `studio_materials` for the new studio. This replaces the dead-code `seed_default_studio_materials()` SQL function.

Existing studios are not auto-updated when defaults change. A "Copy to all studios" button on the admin page runs an additive bulk copy as a one-shot.

The original `seed_default_studio_materials()` function is left in place for now (no caller, no harm). It can be dropped in a follow-up cleanup.

### Auth

Three-prop pattern in nav components: `isAdmin` (studio admin/owner OR super-admin) and `isSuperAdmin` (super_admin only). The Admin nav item appears only when `isSuperAdmin` is true. `AppShell`, `SidebarNav`, `IconRail`, and the project layout were all updated to thread these through.

## Consequences

- Adding a new admin section is now a 1-page exercise (route under `/admin/*`, the layout handles auth + chrome).
- New studios get the latest curated default-finishes set automatically — no migration needed to change the defaults.
- Existing studios miss out on default-set changes unless explicitly synced via the "Copy to all studios" button. Acceptable: existing studios already have their own materials, and silently injecting new ones into a working studio would be invasive.
- The dead SQL function `seed_default_studio_materials()` should be dropped in a future cleanup migration (low priority).
- Billing UI is a placeholder; the data model (`studios.subscription_status`) is in place, Stripe integration is not.
