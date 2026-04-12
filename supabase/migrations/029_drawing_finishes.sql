-- Migration 029: drawing_type enum + drawing_finishes junction
--
-- drawing_type: enforces the three drawing types used in interior design schedules.
--   arch_id  — Architectural ID / finish plans (room-by-room finish assignments)
--   joinery  — Joinery elevations and detail drawings
--   ffe      — FF&E (furniture, fixtures and equipment) plans
--
-- drawing_finishes: assigns studio finish codes to drawings.
-- Drawings OWN the finish assignments — this is the source of truth for
-- "which finish codes appear on which drawing".
-- A finish like WD-01 can appear on multiple drawings of any type.
--
-- CASCADE on both sides of the junction:
--   drawing deleted → its finish assignments go with it (correct)
--   finish retired  → all its drawing assignments go with it (correct)

create type drawing_type as enum (
  'arch_id',  -- Architectural ID / finish plan
  'joinery',  -- Joinery elevations and details
  'ffe'       -- FF&E (furniture, fixtures and equipment) plans
);

create table drawing_finishes (
  drawing_id        uuid        not null references drawings(id) on delete cascade,
  studio_finish_id  uuid        not null references studio_finishes(id) on delete cascade,
  -- studio_id denormalised for direct RLS check without joins (ADR 002 pattern)
  studio_id         uuid        not null references studios(id) on delete cascade,
  -- order_index controls display order of finishes within a drawing's finish schedule
  order_index       integer     not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  primary key (drawing_id, studio_finish_id)
);

alter table drawing_finishes enable row level security;

create index idx_drawing_finishes_drawing_id       on drawing_finishes(drawing_id);
create index idx_drawing_finishes_studio_finish_id on drawing_finishes(studio_finish_id);
create index idx_drawing_finishes_studio_id        on drawing_finishes(studio_id);

create policy "Studio members can manage drawing finishes"
  on drawing_finishes for all
  using  (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));
