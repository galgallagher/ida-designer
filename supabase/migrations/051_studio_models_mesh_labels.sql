-- Per-mesh display labels (user-defined names override the file's mesh names).
-- Stored as JSONB: { [originalMeshName]: displayName }.
-- See ADR 027.

ALTER TABLE studio_models
  ADD COLUMN IF NOT EXISTS mesh_labels jsonb NOT NULL DEFAULT '{}'::jsonb;
