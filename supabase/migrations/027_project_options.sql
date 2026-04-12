-- Migration 027: project_options
--
-- A project option is a parallel design direction within a project.
-- Examples: Option A (contemporary), Option B (traditional), Option C (budget).
-- All drawings and spec items belong to a project option, not directly to a project.
--
-- Every project gets a default "Option A" created automatically at project
-- creation time (in application code) and backfilled for existing projects
-- in migration 032.
--
-- studio_id is denormalised here (copied from projects.studio_id) so RLS
-- can use a direct column check rather than a two-hop join — per ADR 002.

create table project_options (
  id          uuid        primary key default gen_random_uuid(),
  studio_id   uuid        not null references studios(id) on delete cascade,
  project_id  uuid        not null references projects(id) on delete cascade,
  name        text        not null default 'Option A',
  -- label: single character for compact tab display — "A", "B", "C"
  -- char(1) intentionally not a fixed enum; studios may need D, E, etc.
  label       char(1)     not null default 'A',
  description text,
  sort_order  integer     not null default 0,
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- one label per project (can't have two "Option A" on the same project)
  unique (project_id, label)
);

alter table project_options enable row level security;

create index idx_project_options_project_id on project_options(project_id);
create index idx_project_options_studio_id  on project_options(studio_id);

create policy "Studio members can manage project options"
  on project_options for all
  using  (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));
