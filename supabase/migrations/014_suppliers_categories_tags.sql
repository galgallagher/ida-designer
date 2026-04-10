-- Migration 014: suppliers, spec_categories, spec_tags, cost fields on specs
--
-- Adds:
--   suppliers           — company-level supplier records per studio
--   supplier_contacts   — people at a supplier company
--   spec_categories     — hierarchical taxonomy (parent/child), studio-editable
--                         seeded with platform defaults that studios can extend
--   spec_tags           — freeform tags on library specs
--   spec_suppliers      — many-to-many: spec ↔ supplier (with supplier code + unit cost)
--
-- Alters:
--   specs               — adds category_id, cost_from, cost_to, cost_unit

-- ── Suppliers ─────────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name        text NOT NULL,
  website     text,
  address     text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage their suppliers"
  ON suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = suppliers.studio_id AND user_id = auth.uid()
    )
  );

-- ── Supplier contacts ─────────────────────────────────────────────────────────

CREATE TABLE supplier_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  studio_id    uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  first_name   text NOT NULL,
  last_name    text,
  role         text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage supplier contacts"
  ON supplier_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = supplier_contacts.studio_id AND user_id = auth.uid()
    )
  );

-- ── Spec categories ───────────────────────────────────────────────────────────
-- Hierarchical — parent_id is null for top-level categories.
-- is_default = true means it was seeded by the platform; studios can still edit/
-- rename/hide these, or add their own (is_default = false).
-- studio_id = null on default rows means they're available to all studios —
-- we'll copy them per-studio on first use, OR we handle in app logic.
-- Simpler approach: one row per studio. We seed via a function below.

CREATE TABLE spec_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES spec_categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  icon        text,          -- lucide icon name e.g. "layers", "lightbulb"
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spec_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage their categories"
  ON spec_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = spec_categories.studio_id AND user_id = auth.uid()
    )
  );

-- ── Spec tags ─────────────────────────────────────────────────────────────────

CREATE TABLE spec_tags (
  spec_id  uuid NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  tag      text NOT NULL,
  PRIMARY KEY (spec_id, tag)
);

ALTER TABLE spec_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage spec tags"
  ON spec_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM specs s
      JOIN studio_members sm ON sm.studio_id = s.studio_id
      WHERE s.id = spec_tags.spec_id AND sm.user_id = auth.uid()
    )
  );

-- ── Spec ↔ Supplier junction ──────────────────────────────────────────────────

CREATE TABLE spec_suppliers (
  spec_id        uuid NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_code  text,       -- supplier's own product/SKU code
  unit_cost      numeric(12,2),
  PRIMARY KEY (spec_id, supplier_id)
);

ALTER TABLE spec_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage spec suppliers"
  ON spec_suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM specs s
      JOIN studio_members sm ON sm.studio_id = s.studio_id
      WHERE s.id = spec_suppliers.spec_id AND sm.user_id = auth.uid()
    )
  );

-- ── Extend specs table ────────────────────────────────────────────────────────

ALTER TABLE specs
  ADD COLUMN IF NOT EXISTS category_id  uuid REFERENCES spec_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_from    numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_to      numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_unit    text;  -- e.g. "per m²", "per unit", "per linear m"

-- ── Seed default categories function ─────────────────────────────────────────
-- Call seed_default_spec_categories(studio_id) when a new studio is created,
-- or manually for existing studios.

CREATE OR REPLACE FUNCTION seed_default_spec_categories(p_studio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- parent IDs
  cat_flooring      uuid;
  cat_walls         uuid;
  cat_lighting      uuid;
  cat_furniture     uuid;
  cat_fabric        uuid;
  cat_stone_tile    uuid;
  cat_joinery       uuid;
  cat_paint         uuid;
  cat_sanitaryware  uuid;
  cat_hardware      uuid;
BEGIN
  -- Top-level categories
  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Flooring',       'layers',          10)
    RETURNING id INTO cat_flooring;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Wall Coverings', 'square',          20)
    RETURNING id INTO cat_walls;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Lighting',       'lightbulb',       30)
    RETURNING id INTO cat_lighting;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Furniture',      'armchair',        40)
    RETURNING id INTO cat_furniture;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Fabric & Upholstery', 'scissors',   50)
    RETURNING id INTO cat_fabric;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Stone & Tile',   'grid',            60)
    RETURNING id INTO cat_stone_tile;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Joinery',        'hammer',          70)
    RETURNING id INTO cat_joinery;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Paint & Finishes', 'paintbrush',    80)
    RETURNING id INTO cat_paint;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Sanitaryware',   'droplets',        90)
    RETURNING id INTO cat_sanitaryware;

  INSERT INTO spec_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Door Hardware',  'key',            100)
    RETURNING id INTO cat_hardware;

  -- Flooring sub-categories
  INSERT INTO spec_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_flooring, 'Carpet & Rugs',   10),
    (p_studio_id, cat_flooring, 'Hard Flooring',   20),
    (p_studio_id, cat_flooring, 'Vinyl & LVT',     30);

  -- Wall Coverings sub-categories
  INSERT INTO spec_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_walls, 'Wallpaper',           10),
    (p_studio_id, cat_walls, 'Fabric Wall Covering', 20),
    (p_studio_id, cat_walls, 'Panelling',            30);

  -- Lighting sub-categories
  INSERT INTO spec_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_lighting, 'Pendant',          10),
    (p_studio_id, cat_lighting, 'Recessed',         20),
    (p_studio_id, cat_lighting, 'Wall Light',       30),
    (p_studio_id, cat_lighting, 'Floor Lamp',       40),
    (p_studio_id, cat_lighting, 'Table Lamp',       50);

  -- Furniture sub-categories
  INSERT INTO spec_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_furniture, 'Seating',         10),
    (p_studio_id, cat_furniture, 'Tables',          20),
    (p_studio_id, cat_furniture, 'Storage',         30),
    (p_studio_id, cat_furniture, 'Beds',            40);

  -- Stone & Tile sub-categories
  INSERT INTO spec_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_stone_tile, 'Wall Tile',      10),
    (p_studio_id, cat_stone_tile, 'Floor Tile',     20),
    (p_studio_id, cat_stone_tile, 'Natural Stone',  30),
    (p_studio_id, cat_stone_tile, 'Mosaic',         40);

END;
$$;
