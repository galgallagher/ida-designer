-- Migration 034: custom schedule types
--
-- Widens item_type from enum to text on project_specs and studio_spec_preferences,
-- enabling studios to create their own schedule types alongside system defaults.
--
-- Handles two cases:
--   • If item_type already exists (migration 032 was run) → ALTER to text
--   • If item_type doesn't exist yet → ADD as text directly
--
-- Custom types use a UUID as their key. System types keep their existing
-- string values ('ffe', 'joinery', etc.).

-- ── project_specs ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'project_specs' and column_name = 'item_type'
  ) then
    alter table project_specs alter column item_type type text;
  else
    alter table project_specs add column item_type text;
  end if;
end $$;

-- ── studio_spec_preferences ───────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'studio_spec_preferences' and column_name = 'item_type'
  ) then
    alter table studio_spec_preferences alter column item_type type text;
  else
    alter table studio_spec_preferences add column item_type text not null default '';
  end if;
end $$;

-- ── is_custom flag ────────────────────────────────────────────────────────────

alter table studio_spec_preferences
  add column if not exists is_custom boolean not null default false;
