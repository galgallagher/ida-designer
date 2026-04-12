-- Migration 031: alter drawings for idcircuit v2
--
-- Adds project_option_id (FK to project_options), drawing_type, and studio_id.
-- project_id is intentionally KEPT as a legacy column during transition —
-- it will be dropped in migration 033 after all app code has been updated.
--
-- studio_id is denormalised here so RLS can use a direct column check
-- rather than a multi-hop join through project_options → projects → studio_members.
--
-- drawing_type uses the enum created in migration 029.

-- ── Add new columns ────────────────────────────────────────────────────────────

alter table drawings
  add column if not exists project_option_id uuid references project_options(id) on delete cascade;

alter table drawings
  add column if not exists drawing_type drawing_type;

alter table drawings
  add column if not exists studio_id uuid references studios(id) on delete cascade;

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index idx_drawings_project_option_id on drawings(project_option_id);
create index idx_drawings_studio_id         on drawings(studio_id);

-- ── RLS: switch from project_id join to direct studio_id check ─────────────────
-- The old policy walked: drawing → project → studio_members (3 hops)
-- New policy: direct studio_id column check (1 hop, faster, consistent with ADR 002)
-- NOTE: the old policy name may vary depending on prior migrations.
-- Drop by name if it exists; the new policy covers all operations.

drop policy if exists "Studio members can manage their drawings" on drawings;
drop policy if exists "Studio members can manage drawings via project" on drawings;
drop policy if exists "Project members can view drawings" on drawings;

create policy "Studio members can manage drawings"
  on drawings for all
  using  (
    studio_id is null  -- allow rows not yet backfilled (transition safety)
    or studio_id = any(select auth_user_studio_ids())
  )
  with check (studio_id = any(select auth_user_studio_ids()));

-- ── Update drawing_hotspots RLS ────────────────────────────────────────────────
-- The old policy walked: hotspot → drawing → project → studio_members
-- New policy walks: hotspot → drawing (uses drawing.studio_id)

drop policy if exists "Studio members can manage hotspots via drawing" on drawing_hotspots;
drop policy if exists "Project members can view hotspots" on drawing_hotspots;

create policy "Studio members can manage hotspots via drawing"
  on drawing_hotspots for all
  using (
    exists (
      select 1 from drawings d
      where d.id = drawing_hotspots.drawing_id
        and (
          d.studio_id is null  -- transition safety for un-backfilled rows
          or d.studio_id = any(select auth_user_studio_ids())
        )
    )
  );
