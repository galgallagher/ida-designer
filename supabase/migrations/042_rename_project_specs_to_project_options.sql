-- Migration 042: Drop orphaned tables, clean up dead columns, rename project_specs → project_options
--
-- Drawings and the schedule feature have been removed from the app.
-- This migration removes all database infrastructure that supported them.

-- ── Drop orphaned tables ───────────────────────────────────────────────────────
-- Order matters: child tables (FKs) before parents.

DROP TABLE IF EXISTS drawing_hotspots CASCADE;
DROP TABLE IF EXISTS drawing_finishes CASCADE;
DROP TABLE IF EXISTS drawings CASCADE;
DROP TABLE IF EXISTS project_schedule_preferences CASCADE;
DROP TABLE IF EXISTS studio_spec_preferences CASCADE;
DROP TABLE IF EXISTS studio_finishes CASCADE;

-- ── Drop dead columns from project_specs ──────────────────────────────────────
-- item_type and project_code were used by the schedule feature (now removed).

ALTER TABLE project_specs DROP COLUMN IF EXISTS item_type;
ALTER TABLE project_specs DROP COLUMN IF EXISTS project_code;

-- ── Rename project_specs → project_options ────────────────────────────────────
-- A "project option" is a spec from the studio library added to a project.
-- RLS policies and indexes on the table are renamed automatically by Postgres.

ALTER TABLE project_specs RENAME TO project_options;
