-- Migration 006: drawings
-- A drawing is a floor plan, elevation, or other design document uploaded to a project.
-- Files are stored in Supabase Storage; file_path is the storage path,
-- file_url is the public URL for display.

create table drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  -- file_url: the CDN-accessible URL for displaying the image
  file_url text,
  -- file_path: the internal Supabase Storage path (used for deletion, signed URLs)
  file_path text,
  -- category groups drawings by type for display (not enforced by a constraint
  -- so studios can define their own categories)
  category text, -- e.g. "Architecture", "FF&E", "Joinery"
  -- order_index controls the display order within a project
  order_index integer not null default 0,
  -- canvas dimensions are stored to correctly position hotspot percentage coordinates
  canvas_width integer,
  canvas_height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table drawings enable row level security;

-- Access is checked via the parent project's studio membership.
-- This join pattern is slightly slower but avoids denormalising studio_id here.
create policy "Studio members can manage drawings via project"
  on drawings for all
  using (
    exists (
      select 1 from projects p
      join studio_members sm on sm.studio_id = p.studio_id
      where p.id = drawings.project_id and sm.user_id = auth.uid()
    )
  );
