-- Migration 009: specs and spec_field_values
-- A spec is a specific product or material in a studio's library.
-- Example: "Kirkby Design — Voyage Fabric in Sage" is a spec of type "Fabric".
-- Specs live at the studio level (not inside a project) so they can be reused
-- across multiple projects.

create table specs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  -- template_id links to the category this spec belongs to.
  -- Deleting a template is blocked if any specs reference it (on delete restrict).
  template_id uuid not null references spec_templates(id) on delete restrict,
  name text not null,
  description text,
  -- image_url: CDN URL for displaying the spec's product image
  image_url text,
  -- image_path: internal Supabase Storage path
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table specs enable row level security;

create policy "Studio members can manage their specs"
  on specs for all
  using (
    exists (
      select 1 from studio_members
      where studio_id = specs.studio_id and user_id = auth.uid()
    )
  );

-- ── Spec field values ─────────────────────────────────────────────────────
-- One row per field for each spec — stores the actual data.
-- Example: spec "Voyage Fabric in Sage", field "Fire Rating", value "Class 1"

create table spec_field_values (
  id uuid primary key default gen_random_uuid(),
  spec_id uuid not null references specs(id) on delete cascade,
  template_field_id uuid not null references spec_template_fields(id) on delete cascade,
  -- All values are stored as text regardless of field_type.
  -- The application layer interprets the value based on the field's type.
  value text,
  created_at timestamptz not null default now(),
  -- A spec can only have one value per field
  unique(spec_id, template_field_id)
);

alter table spec_field_values enable row level security;

create policy "Studio members can manage spec values"
  on spec_field_values for all
  using (
    exists (
      select 1 from specs s
      join studio_members sm on sm.studio_id = s.studio_id
      where s.id = spec_field_values.spec_id and sm.user_id = auth.uid()
    )
  );
