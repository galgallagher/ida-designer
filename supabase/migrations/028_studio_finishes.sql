-- Migration 028: studio_finishes
--
-- Studio finishes are the flat, studio-scoped finish code palette.
-- Examples: WD-01 (White Oak Veneer), FB-03 (Fabric Option 3), MT-07 (Matte Tile).
-- Codes are defined by the studio using their own naming convention.
-- A single finish code can be assigned to multiple drawings of any type
-- (Arch ID, Joinery, FF&E) via the drawing_finishes junction (migration 029).
--
-- global_spec_id: optional FK to the Global Material Library (migration 025).
-- This is the "dashed link" shown in the data model diagram.
-- ON DELETE SET NULL — deleting a global spec un-links it from studio finishes
-- without removing the finish itself.

create table studio_finishes (
  id             uuid        primary key default gen_random_uuid(),
  studio_id      uuid        not null references studios(id) on delete cascade,
  -- code: the short studio reference, e.g. "WD-01", "FB-03", "MT-07"
  -- Unique per studio — a studio can't have two WD-01 finishes
  code           text        not null,
  name           text        not null,   -- e.g. "White Oak Veneer"
  description    text,
  -- colour_hex: optional swatch for UI preview, e.g. "#C4A882"
  colour_hex     text,
  image_url      text,
  image_path     text,
  -- Optional link to the Global Material Library
  global_spec_id uuid        references global_specs(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (studio_id, code)
);

alter table studio_finishes enable row level security;

create index idx_studio_finishes_studio_id      on studio_finishes(studio_id);
create index idx_studio_finishes_global_spec_id on studio_finishes(global_spec_id);

create policy "Studio members can manage their finishes"
  on studio_finishes for all
  using  (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));
