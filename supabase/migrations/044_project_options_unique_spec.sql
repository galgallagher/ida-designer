-- Enforce one entry per spec per project in project_options.
-- Deduplicate any existing rows first (keep the oldest).

DELETE FROM project_options
WHERE id NOT IN (
  SELECT DISTINCT ON (project_id, spec_id) id
  FROM project_options
  WHERE spec_id IS NOT NULL
  ORDER BY project_id, spec_id, created_at ASC
);

ALTER TABLE project_options
  ADD CONSTRAINT project_options_project_spec_unique
  UNIQUE (project_id, spec_id);
