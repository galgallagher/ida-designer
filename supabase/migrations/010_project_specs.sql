-- Migration 010: project_specs
-- A project_spec is an instance of a studio-library spec placed inside a specific project.
-- It adds project-specific data: quantity, unit, status, and optional drawing placement.
-- Example: "Voyage Fabric in Sage" (spec) used in "Smith Residence" (project),
--           2.5 m², status: ordered, placed on the "Living Room" drawing.

-- Enum for tracking where a spec is in the procurement lifecycle
create type spec_status as enum (
  'draft',      -- just added, not yet confirmed
  'specified',  -- confirmed in the design
  'approved',   -- client has signed off
  'ordered',    -- purchase order raised
  'delivered'   -- item received on site
);

create table project_specs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Deleting a spec from the library is blocked if it's used in any project.
  spec_id uuid not null references specs(id) on delete restrict,
  -- Optional: which drawing this spec appears on
  drawing_id uuid references drawings(id) on delete set null,
  quantity decimal(10,2),
  -- unit is free text so studios can use whatever makes sense for the product
  unit text, -- e.g. "m²", "units", "linear metres", "sets"
  notes text,
  status spec_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_specs enable row level security;

create policy "Studio members can manage project specs"
  on project_specs for all
  using (
    exists (
      select 1 from projects p
      join studio_members sm on sm.studio_id = p.studio_id
      where p.id = project_specs.project_id and sm.user_id = auth.uid()
    )
  );

-- ── Resolve the circular dependency from migration 007 ────────────────────
-- drawing_hotspots.project_spec_id needs to reference project_specs,
-- but drawing_hotspots was created before project_specs existed.
-- We add the FK constraint here now that project_specs exists.

alter table drawing_hotspots
  add constraint drawing_hotspots_project_spec_id_fkey
  foreign key (project_spec_id) references project_specs(id) on delete set null;
