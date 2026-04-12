-- Migration 030: spec_item_type enum + studio_spec_preferences
--
-- spec_item_type: the project-level classification of what a spec item IS
-- in the context of a project schedule. Separate from spec_categories
-- (which is the library taxonomy) — these drive which schedule tab a spec
-- item appears on in the project view.
--
--   ffe             — FF&E (furniture, fixtures and equipment)
--   ironmongery     — Door hardware and ironmongery schedules
--   sanitaryware    — Sanitaryware schedules
--   joinery         — Joinery item schedules
--   arch_id_finishes — Architectural ID finish items
--   joinery_finishes — Joinery-specific finish items
--
-- studio_spec_preferences: UX-only config controlling which schedule types
-- are visible per studio and in what order. Does not affect data integrity.
-- Studios can also rename schedule types using display_name.

create type spec_item_type as enum (
  'ffe',
  'ironmongery',
  'sanitaryware',
  'joinery',
  'arch_id_finishes',
  'joinery_finishes'
);

create table studio_spec_preferences (
  id           uuid           primary key default gen_random_uuid(),
  studio_id    uuid           not null references studios(id) on delete cascade,
  item_type    spec_item_type not null,
  is_visible   boolean        not null default true,
  -- display_name: optional studio label override,
  -- e.g. "Loose Furniture" instead of the default "FF&E"
  display_name text,
  sort_order   integer        not null default 0,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now(),
  unique (studio_id, item_type)
);

alter table studio_spec_preferences enable row level security;

create index idx_studio_spec_preferences_studio_id on studio_spec_preferences(studio_id);

-- All studio members can read preferences (they affect UI for everyone)
create policy "Studio members can view spec preferences"
  on studio_spec_preferences for select
  using (studio_id = any(select auth_user_studio_ids()));

-- Only admins can change preferences
create policy "Studio admins can manage spec preferences"
  on studio_spec_preferences for insert, update, delete
  using  (studio_id = any(select auth_user_admin_studio_ids()))
  with check (studio_id = any(select auth_user_admin_studio_ids()));
