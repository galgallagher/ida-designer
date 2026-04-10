-- 018_contact_categories.sql
--
-- Creates the contact_categories hierarchical tree.
-- Same shape as spec_categories minus template_id and abbreviation.
-- Studios can customise; defaults are seeded on first visit to /contacts.

CREATE TABLE contact_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES contact_categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  icon        text,          -- lucide icon name: users, package, hammer, etc.
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage contact categories"
  ON contact_categories FOR ALL
  USING (studio_id = ANY(SELECT auth_user_studio_ids()));

-- ── Default category seed function ────────────────────────────────────────────
-- Idempotent: skips studios that already have contact categories.
-- Called from the app on first visit to /contacts.

CREATE OR REPLACE FUNCTION seed_default_contact_categories(p_studio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cat_clients     uuid;
  cat_suppliers   uuid;
  cat_contractors uuid;
  cat_consultants uuid;
  cat_architects  uuid;
  cat_artists     uuid;
  cat_press       uuid;
  cat_freelancers uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM contact_categories WHERE studio_id = p_studio_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Clients', 'users', 10) RETURNING id INTO cat_clients;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Suppliers', 'package', 20) RETURNING id INTO cat_suppliers;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Contractors', 'hammer', 30) RETURNING id INTO cat_contractors;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Consultants', 'briefcase', 40) RETURNING id INTO cat_consultants;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Architects', 'building', 50) RETURNING id INTO cat_architects;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Artists & Makers', 'palette', 60) RETURNING id INTO cat_artists;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Press & Media', 'camera', 70) RETURNING id INTO cat_press;

  INSERT INTO contact_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Freelancers', 'zap', 80) RETURNING id INTO cat_freelancers;

  -- Contractors sub-categories
  INSERT INTO contact_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_contractors, 'General Contractor',    10),
    (p_studio_id, cat_contractors, 'Joinery & Carpentry',   20),
    (p_studio_id, cat_contractors, 'Fit-out',               30),
    (p_studio_id, cat_contractors, 'Electrical',            40),
    (p_studio_id, cat_contractors, 'Plumbing',              50),
    (p_studio_id, cat_contractors, 'Decorators & Painters', 60),
    (p_studio_id, cat_contractors, 'Flooring Installer',    70);

  -- Consultants sub-categories
  INSERT INTO contact_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_consultants, 'Lighting Designer',   10),
    (p_studio_id, cat_consultants, 'Structural Engineer', 20),
    (p_studio_id, cat_consultants, 'M&E Engineer',        30),
    (p_studio_id, cat_consultants, 'Acoustic Consultant', 40),
    (p_studio_id, cat_consultants, 'Art Consultant',      50),
    (p_studio_id, cat_consultants, 'Kitchen Designer',    60);

  -- Freelancers sub-categories
  INSERT INTO contact_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_freelancers, 'Photographer',        10),
    (p_studio_id, cat_freelancers, 'Stylist',             20),
    (p_studio_id, cat_freelancers, '3D Visualiser / CGI', 30),
    (p_studio_id, cat_freelancers, 'Graphic Designer',    40),
    (p_studio_id, cat_freelancers, 'Copywriter',          50),
    (p_studio_id, cat_freelancers, 'Project Manager',     60);
END;
$$;
