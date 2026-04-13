-- Migration 034: custom schedule types
--
-- Widens item_type from enum to text on both project_specs and
-- studio_spec_preferences, enabling studios to create their own schedule
-- types alongside the system-defined ones.
--
-- System types keep their existing string values ('ffe', 'joinery', etc.).
-- Custom types use a UUID as their key (generated server-side at insert time).
-- Validation shifts from the DB enum constraint to the application layer —
-- intentional, since custom values are by definition open-ended.
--
-- studio_spec_preferences gains is_custom boolean to distinguish rows.

-- 1. Widen project_specs.item_type
alter table project_specs alter column item_type type text;

-- 2. Widen studio_spec_preferences.item_type
alter table studio_spec_preferences alter column item_type type text;

-- 3. Mark custom vs system rows
alter table studio_spec_preferences
  add column if not exists is_custom boolean not null default false;

-- 4. The spec_item_type enum itself is no longer used as a column type but
--    is kept to avoid breaking any existing database functions or policies
--    that reference it. It can be dropped in a future cleanup migration once
--    confirmed nothing references it.
