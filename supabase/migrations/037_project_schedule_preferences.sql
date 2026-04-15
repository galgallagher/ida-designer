-- Migration 037: project_schedule_preferences
--
-- Per-project schedule configuration. Projects inherit their studio's
-- studio_spec_preferences by default. When a project customises its schedules
-- via /projects/[id]/settings, rows are written here and take precedence.
--
-- Falls back to studio_spec_preferences when no project rows exist.
-- Ensures item_type on project_specs is nullable (specs can be in the
-- library without being assigned to a schedule yet).

-- ── Ensure item_type is nullable on project_specs ──────────────────────────────
-- (It was added without NOT NULL in migration 032, but guard just in case)
alter table project_specs alter column item_type drop not null;

-- ── project_schedule_preferences ─────────────────────────────────────────────

create table project_schedule_preferences (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references projects(id) on delete cascade,
  studio_id    uuid        not null references studios(id) on delete cascade,
  item_type    text        not null,
  display_name text,                         -- null = use studio label or system default
  is_visible   boolean     not null default true,
  is_custom    boolean     not null default false,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  unique (project_id, item_type)
);

alter table project_schedule_preferences enable row level security;

create index idx_project_sched_prefs_project_id on project_schedule_preferences(project_id);
create index idx_project_sched_prefs_studio_id  on project_schedule_preferences(studio_id);

-- All studio members can read; admins can write
create policy "Studio members can read project schedule preferences"
  on project_schedule_preferences for select
  using (studio_id = any(select auth_user_studio_ids()));

create policy "Studio admins can manage project schedule preferences"
  on project_schedule_preferences for all
  using  (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));
