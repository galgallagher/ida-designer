-- Migration 041: Remove project_options feature
--
-- project_options was dormant infrastructure for a future "design alternatives"
-- feature (Option A vs Option B). It was never surfaced in the UI beyond
-- auto-creating a silent default. Removing it simplifies the schema — drawings
-- and project_specs are now queried directly by project_id.

-- Drop foreign key columns first
ALTER TABLE project_specs DROP COLUMN IF EXISTS project_option_id;
ALTER TABLE drawings DROP COLUMN IF EXISTS project_option_id;

-- Drop the table (RLS policies drop automatically with the table)
DROP TABLE IF EXISTS project_options CASCADE;
