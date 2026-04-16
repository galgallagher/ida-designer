-- Migration 038: Project Canvases
-- Freeform visual canvas for project inspiration — images, sketches, product URLs.
-- Multiple named canvases per project. Canvas state stored as tldraw JSON snapshot.

-- ── Table ────────────────────────────────────────────────────────────────────

create table if not exists project_canvases (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null references studios(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null default 'Inspiration',
  content       jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  order_index   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast lookup by project
create index if not exists idx_project_canvases_project
  on project_canvases(project_id);

-- Index for studio-scoped queries (RLS)
create index if not exists idx_project_canvases_studio
  on project_canvases(studio_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table project_canvases enable row level security;

create policy "Studio members can view project canvases"
  on project_canvases for select
  using (studio_id = any(select auth_user_studio_ids()));

create policy "Studio members can insert project canvases"
  on project_canvases for insert
  with check (studio_id = any(select auth_user_studio_ids()));

create policy "Studio members can update project canvases"
  on project_canvases for update
  using (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));

create policy "Studio members can delete project canvases"
  on project_canvases for delete
  using (studio_id = any(select auth_user_studio_ids()));

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- canvas-images bucket for uploaded images/sketches.
-- Public read (same pattern as spec-images, material-images).

insert into storage.buckets (id, name, public)
values ('canvas-images', 'canvas-images', true)
on conflict (id) do nothing;

-- Storage policies: authenticated users can upload/read/delete their studio's files
create policy "Authenticated users can upload canvas images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'canvas-images');

create policy "Anyone can view canvas images"
  on storage.objects for select
  using (bucket_id = 'canvas-images');

create policy "Authenticated users can delete canvas images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'canvas-images');
