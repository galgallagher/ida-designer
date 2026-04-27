-- Migration 039: project spec codes
--
-- Adds a project-scoped code to each spec in a project, e.g. "FB-01".
-- The code is derived from the spec's category abbreviation + the lowest
-- available sequential number for that prefix in the project.
--
-- Codes are allocated in application code (addSpecToProject server action)
-- using a gap-filling algorithm: if FB-01 is removed, the next fabric added
-- gets FB-01 again. Numbers never shift.
--
-- The unique constraint on (project_id, project_code) prevents duplicates
-- and acts as a safety net against race conditions.

ALTER TABLE project_specs ADD COLUMN project_code TEXT;

ALTER TABLE project_specs
  ADD CONSTRAINT project_specs_project_code_unique
  UNIQUE (project_id, project_code);
