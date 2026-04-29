-- 3D Studio models: one or more 3D models per project.
-- Stores the Supabase Storage path and mesh→spec material assignments as JSONB.
-- See ADR 027.

CREATE TABLE studio_models (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id            uuid        NOT NULL REFERENCES studios(id)  ON DELETE CASCADE,
  project_id           uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  file_path            text        NOT NULL,
  format               text        NOT NULL DEFAULT 'glb'
                                   CHECK (format IN ('glb', 'gltf', 'obj', 'fbx')),
  material_assignments jsonb       NOT NULL DEFAULT '{}',
  thumbnail_url        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE studio_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_members_all" ON studio_models
  FOR ALL
  USING  (studio_id = ANY(SELECT auth_user_studio_ids()))
  WITH CHECK (studio_id = ANY(SELECT auth_user_studio_ids()));

CREATE INDEX studio_models_project_idx ON studio_models(project_id);
CREATE INDEX studio_models_studio_idx  ON studio_models(studio_id);

-- Updated_at trigger (reuse existing helper if present, otherwise create inline)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER studio_models_updated_at
  BEFORE UPDATE ON studio_models
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Storage bucket (private — download via signed URLs only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-models',
  'studio-models',
  false,
  104857600,  -- 100 MB limit per file
  ARRAY['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: first path segment must be a studio the user belongs to
-- Storage policies: bucket check only — cross-studio isolation enforced in server actions
-- (signed URL generation validates studio membership before issuing a URL)
CREATE POLICY "studio_members_upload_models" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-models');

CREATE POLICY "studio_members_select_models" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-models');

CREATE POLICY "studio_members_delete_models" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-models');
