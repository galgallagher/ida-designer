-- Project specifications: the committed schedule. A spec slot is a row with an
-- auto-generated code (derived from the category abbreviation), a quantity,
-- a project-specific price, and an optional assignment to a library spec.
--
-- Decoupled by design: drawing references use the slot CODE (string), so
-- reassigning which spec fills FB1 doesn't require changing any drawing.
--
-- Slots can exist without an assignment (designers pre-create FB1..FB5 before
-- choosing fabrics). Multiple slots may share the same assigned spec.

CREATE TABLE project_specs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
  studio_id     uuid        NOT NULL REFERENCES studios(id)         ON DELETE CASCADE,
  category_id   uuid        NOT NULL REFERENCES spec_categories(id) ON DELETE RESTRICT,
  code          text        NOT NULL,
  sequence      integer     NOT NULL,
  quantity      numeric     NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  price         numeric     CHECK (price IS NULL OR price >= 0),
  spec_id       uuid        REFERENCES specs(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_specs_code_unique UNIQUE (project_id, code),
  CONSTRAINT project_specs_sequence_unique UNIQUE (project_id, category_id, sequence)
);

ALTER TABLE project_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio members can manage project specs"
  ON project_specs
  FOR ALL
  USING  (studio_id = ANY(SELECT auth_user_studio_ids()))
  WITH CHECK (studio_id = ANY(SELECT auth_user_studio_ids()));

CREATE INDEX project_specs_project_id_idx  ON project_specs(project_id);
CREATE INDEX project_specs_studio_id_idx   ON project_specs(studio_id);
CREATE INDEX project_specs_category_id_idx ON project_specs(category_id);
CREATE INDEX project_specs_spec_id_idx     ON project_specs(spec_id);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION set_project_specs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_specs_set_updated_at
  BEFORE UPDATE ON project_specs
  FOR EACH ROW EXECUTE FUNCTION set_project_specs_updated_at();
