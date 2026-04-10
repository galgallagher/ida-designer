-- Migration 007: drawing_hotspots
-- Hotspots are clickable pins placed on a drawing at a percentage-based position.
-- Two types exist:
--   drawing_link — navigates the user to another drawing when clicked
--   spec_pin     — shows a specification popup when clicked
--
-- Note: the FK to project_specs is added in migration 010, after that table exists.

create type hotspot_type as enum ('drawing_link', 'spec_pin');

create table drawing_hotspots (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  hotspot_type hotspot_type not null,
  -- target_drawing_id: only used when hotspot_type = 'drawing_link'
  target_drawing_id uuid references drawings(id) on delete set null,
  -- project_spec_id: only used when hotspot_type = 'spec_pin'
  -- The FK constraint is added in 010_project_specs.sql to avoid circular deps.
  project_spec_id uuid,
  -- x, y: position on the drawing as a percentage (0–100), e.g. x=45.50 y=32.10
  -- Using percentage means positions survive if the canvas is resized.
  x decimal(5,2) not null,
  y decimal(5,2) not null,
  label text,
  created_at timestamptz not null default now()
);

alter table drawing_hotspots enable row level security;

create policy "Studio members can manage hotspots via drawing"
  on drawing_hotspots for all
  using (
    exists (
      select 1 from drawings d
      join projects p on p.id = d.project_id
      join studio_members sm on sm.studio_id = p.studio_id
      where d.id = drawing_hotspots.drawing_id and sm.user_id = auth.uid()
    )
  );
