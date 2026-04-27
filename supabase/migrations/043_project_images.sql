-- Project images: photos, sketches, and inspiration shots uploaded to a
-- project's canvas or images section.

CREATE TABLE project_images (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  studio_id     uuid        NOT NULL REFERENCES studios(id)  ON DELETE CASCADE,
  canvas_id     uuid        REFERENCES project_canvases(id)  ON DELETE SET NULL,
  storage_path  text        NOT NULL,
  url           text        NOT NULL,
  type          text        NOT NULL DEFAULT 'inspiration'
                            CHECK (type IN ('inspiration', 'sketch')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio members can manage project images"
  ON project_images
  FOR ALL
  USING  (studio_id = ANY(SELECT auth_user_studio_ids()))
  WITH CHECK (studio_id = ANY(SELECT auth_user_studio_ids()));

CREATE INDEX project_images_project_id_idx ON project_images(project_id);
CREATE INDEX project_images_studio_id_idx  ON project_images(studio_id);
CREATE INDEX project_images_canvas_id_idx  ON project_images(canvas_id);
