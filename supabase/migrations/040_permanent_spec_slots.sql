-- Migration 040: Permanent spec slots
--
-- Once a project_code is allocated, the project_specs row is permanent.
-- "Removing" a spec detaches spec_id (sets it null) rather than deleting the row.
-- The slot (project_code + item_type) persists as an empty shell, ready for reassignment.
-- This enables revision history: a slot can be empty on Revision B having been on Revision A.
--
-- Also adds project_price for project-specific pricing (separate from global cost_from/cost_to).

-- Allow spec_id to be null (empty slot after detach)
ALTER TABLE project_specs
  ALTER COLUMN spec_id DROP NOT NULL;

-- Project-specific price override
ALTER TABLE project_specs
  ADD COLUMN IF NOT EXISTS project_price NUMERIC;
