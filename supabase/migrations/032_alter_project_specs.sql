-- Migration 032: alter project_specs + backfill for idcircuit v2
--
-- Adds project_option_id, item_type, and studio_id to project_specs.
-- Backfills existing data atomically:
--   1. Creates default "Option A" for every existing project
--   2. Sets project_option_id on all existing project_specs rows
--   3. Sets studio_id on project_specs and drawings rows
--
-- project_id is intentionally KEPT on project_specs as a legacy column —
-- it will be dropped in migration 033 after all app code has been updated.
-- This prevents breaking the live count queries in projects/[id]/page.tsx
-- during the deployment window.
--
-- spec_item_type uses the enum created in migration 030.

-- ── Add new columns ────────────────────────────────────────────────────────────

alter table project_specs
  add column if not exists project_option_id uuid references project_options(id) on delete cascade;

alter table project_specs
  add column if not exists item_type spec_item_type;

alter table project_specs
  add column if not exists studio_id uuid references studios(id) on delete cascade;

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index idx_project_specs_project_option_id on project_specs(project_option_id);
create index idx_project_specs_studio_id         on project_specs(studio_id);

-- ── Backfill: create default "Option A" for every existing project ─────────────
-- ON CONFLICT DO NOTHING — idempotent; safe to re-run

insert into project_options (studio_id, project_id, name, label, sort_order, is_default)
select
  p.studio_id,
  p.id          as project_id,
  'Option A'    as name,
  'A'           as label,
  0             as sort_order,
  true          as is_default
from projects p
on conflict (project_id, label) do nothing;

-- ── Backfill: set project_option_id on existing project_specs rows ─────────────
-- Joins to the default Option A we just created (or one that already existed)

update project_specs ps
set project_option_id = po.id
from project_options po
where po.project_id = ps.project_id
  and po.label = 'A'
  and ps.project_option_id is null;

-- ── Backfill: set studio_id on project_specs from parent project ───────────────

update project_specs ps
set studio_id = p.studio_id
from projects p
where p.id = ps.project_id
  and ps.studio_id is null;

-- ── Backfill: set studio_id on drawings from parent project ───────────────────
-- (drawings have no production data but belt-and-braces for future safety)

update drawings d
set studio_id = p.studio_id
from projects p
where p.id = d.project_id
  and d.studio_id is null;

-- ── RLS: switch project_specs to direct studio_id check ───────────────────────

drop policy if exists "Studio members can manage project specs" on project_specs;
drop policy if exists "Studio members can manage their project specs" on project_specs;

create policy "Studio members can manage project specs"
  on project_specs for all
  using  (
    studio_id is null  -- allow rows not yet backfilled (transition safety)
    or studio_id = any(select auth_user_studio_ids())
  )
  with check (studio_id = any(select auth_user_studio_ids()));
