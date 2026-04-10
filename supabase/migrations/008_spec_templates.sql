-- Migration 008: spec_templates and spec_template_fields
-- A spec template defines a category of specification (e.g. Fabric, Light Fixture).
-- It contains a set of field definitions that every spec of that type will fill in.
-- Studios create their own templates — there are no platform-wide defaults in v1.

create table spec_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  -- name is the category label, e.g. "Fabric", "Light Fixture", "Flooring"
  name text not null,
  description text,
  -- is_active = false hides the template from the UI without deleting it.
  -- Useful if a studio stops using a category but has existing specs.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table spec_templates enable row level security;

create policy "Studio members can manage their templates"
  on spec_templates for all
  using (
    exists (
      select 1 from studio_members
      where studio_id = spec_templates.studio_id and user_id = auth.uid()
    )
  );

-- ── Spec template fields ───────────────────────────────────────────────────

-- Enum for the type of data a field holds
create type field_type as enum (
  'text',      -- short text
  'textarea',  -- multi-line text
  'number',    -- numeric
  'currency',  -- money value (stored as text to preserve formatting)
  'url',       -- web address
  'select',    -- dropdown — options stored in the `options` jsonb column
  'boolean'    -- yes/no
);

create table spec_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references spec_templates(id) on delete cascade,
  -- name is the label shown on the spec form, e.g. "Fire Rating", "Composition"
  name text not null,
  field_type field_type not null default 'text',
  -- options is only used for field_type = 'select'.
  -- Stored as jsonb array: ["Option A", "Option B", "Option C"]
  options jsonb,
  is_required boolean not null default false,
  -- order_index controls the display order of fields on the spec form
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table spec_template_fields enable row level security;

create policy "Studio members can manage template fields"
  on spec_template_fields for all
  using (
    exists (
      select 1 from spec_templates st
      join studio_members sm on sm.studio_id = st.studio_id
      where st.id = spec_template_fields.template_id and sm.user_id = auth.uid()
    )
  );
