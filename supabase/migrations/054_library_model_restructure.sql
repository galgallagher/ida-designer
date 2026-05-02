-- Migration 054: Library / Product / Sourcing model restructure
--
-- See ADR 031 for full design rationale.
--
-- Summary of changes:
--   1. Rename `global_specs*` → `product_library*`        (the canonical product cache)
--   2. Rename `specs*` and `spec_*` → `library_items*` and `library_*` (the studio's library)
--   3. Rename FK columns: `global_spec_id` → `product_library_id`
--                         `spec_id`        → `library_item_id`
--   4. Add nullable override columns to `library_items` so studios can customise
--      a sourced product locally (name, image, description, cost) without forking
--      the canonical row.
--
-- What this migration does NOT do:
--   - Does not drop `studio_materials` or `default_finishes` (Release 3 cleanup).
--   - Does not migrate storage buckets (Release 3 cleanup).
--   - Does not backfill or canonicalise existing data — server actions written
--     in the next release will read from product_library when product_library_id
--     is set, and read from library_items columns when it's null. Legacy rows
--     have duplicated data on library_items; that's harmless.
--
-- Read model after this migration:
--   library_items.product_library_id IS NULL     → finish: read name/image/etc
--                                                   from library_items columns
--   library_items.product_library_id IS NOT NULL → sourced: read from
--                                                   product_library, override
--                                                   from library_items.*_override

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop policies whose names we want to rename. The USING clauses still
--    reference the right columns post-rename, but the names are domain-stale.
--    Recreate with new names at the end.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read global specs"        ON global_specs;
DROP POLICY IF EXISTS "Service role can manage global specs"             ON global_specs;
DROP POLICY IF EXISTS "Authenticated users can read global spec fields"  ON global_spec_fields;
DROP POLICY IF EXISTS "Service role can manage global spec fields"       ON global_spec_fields;
DROP POLICY IF EXISTS "Authenticated users can read global spec tags"    ON global_spec_tags;
DROP POLICY IF EXISTS "Service role can manage global spec tags"         ON global_spec_tags;

DROP POLICY IF EXISTS "Studio members can manage their specs"            ON specs;
DROP POLICY IF EXISTS "Studio members can manage spec values"            ON spec_field_values;
DROP POLICY IF EXISTS "Studio members can manage spec tags"              ON spec_tags;
DROP POLICY IF EXISTS "Studio members can manage spec suppliers"         ON spec_suppliers;
DROP POLICY IF EXISTS "Studio members can manage their categories"       ON spec_categories;
DROP POLICY IF EXISTS "Studio members can manage their templates"        ON spec_templates;
DROP POLICY IF EXISTS "Studio members can manage template fields"        ON spec_template_fields;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop seed functions that reference table names we're about to rename.
--    Recreated at the end with updated bodies. (Nothing in app code calls them
--    today — they are invoked by migration files only.)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS seed_default_spec_categories(uuid);
DROP FUNCTION IF EXISTS seed_category_templates(uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rename product cache (formerly "global specs")
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE global_specs        RENAME TO product_library;
ALTER TABLE global_spec_fields  RENAME TO product_library_fields;
ALTER TABLE global_spec_tags    RENAME TO product_library_tags;

-- Rename FK columns on dependent tables
ALTER TABLE product_library_fields RENAME COLUMN global_spec_id TO product_library_id;
ALTER TABLE product_library_tags   RENAME COLUMN global_spec_id TO product_library_id;

-- Rename indexes (PK indexes auto-renamed by ALTER TABLE; named indexes are not)
ALTER INDEX idx_global_specs_source_url      RENAME TO idx_product_library_source_url;
ALTER INDEX idx_global_specs_brand_domain    RENAME TO idx_product_library_brand_domain;
ALTER INDEX idx_global_spec_fields_spec_id   RENAME TO idx_product_library_fields_product_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rename studio library (formerly "specs")
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE specs              RENAME TO library_items;
ALTER TABLE spec_field_values  RENAME TO library_item_field_values;
ALTER TABLE spec_tags          RENAME TO library_item_tags;
ALTER TABLE spec_suppliers     RENAME TO library_item_suppliers;
ALTER TABLE spec_categories    RENAME TO library_categories;
ALTER TABLE spec_templates     RENAME TO library_templates;
ALTER TABLE spec_template_fields RENAME TO library_template_fields;

-- Rename FK column on library_items
ALTER TABLE library_items RENAME COLUMN global_spec_id TO product_library_id;

-- Rename FK columns on dependent tables
ALTER TABLE library_item_field_values RENAME COLUMN spec_id TO library_item_id;
ALTER TABLE library_item_tags         RENAME COLUMN spec_id TO library_item_id;
ALTER TABLE library_item_suppliers    RENAME COLUMN spec_id TO library_item_id;

-- Rename indexes on library_items
ALTER INDEX idx_specs_global_spec_id      RENAME TO idx_library_items_product_library_id;
ALTER INDEX idx_specs_studio_global_unique RENAME TO idx_library_items_studio_product_unique;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Rename FK columns on project tables that point into the library
--    project_options.spec_id   → library_item_id
--    project_specs.spec_id     → library_item_id
--    (target tables already renamed above)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_options RENAME COLUMN spec_id TO library_item_id;
ALTER TABLE project_specs   RENAME COLUMN spec_id TO library_item_id;

-- Rename project_specs index that named the old column
ALTER INDEX project_specs_spec_id_idx RENAME TO project_specs_library_item_id_idx;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Add override columns to library_items
--    These are only meaningful when product_library_id IS NOT NULL.
--    NULL = use canonical value from product_library.
--    Set  = use studio's local override.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE library_items
  ADD COLUMN IF NOT EXISTS name_override        text,
  ADD COLUMN IF NOT EXISTS description_override text,
  ADD COLUMN IF NOT EXISTS image_url_override   text,
  ADD COLUMN IF NOT EXISTS image_path_override  text,
  ADD COLUMN IF NOT EXISTS cost_from_override   numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_to_override     numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_unit_override   text;

COMMENT ON COLUMN library_items.product_library_id IS
  'FK to canonical product. NULL = studio finish (data lives on this row); SET = sourced product (read canonical from product_library, fall back to *_override here).';

COMMENT ON COLUMN library_items.name_override IS
  'When product_library_id is set, overrides product_library.name for this studio. NULL = use canonical.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Recreate RLS policies with new names that match the new domain language
-- ─────────────────────────────────────────────────────────────────────────────

-- product_library (cross-studio readable, service-role write)
CREATE POLICY "Authenticated users can read product library"
  ON product_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage product library"
  ON product_library FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read product library fields"
  ON product_library_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage product library fields"
  ON product_library_fields FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read product library tags"
  ON product_library_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage product library tags"
  ON product_library_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- library_items (studio-scoped)
CREATE POLICY "Studio members can manage their library items"
  ON library_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = library_items.studio_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage library item field values"
  ON library_item_field_values FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM library_items li
      JOIN studio_members sm ON sm.studio_id = li.studio_id
      WHERE li.id = library_item_field_values.library_item_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage library item tags"
  ON library_item_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM library_items li
      JOIN studio_members sm ON sm.studio_id = li.studio_id
      WHERE li.id = library_item_tags.library_item_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage library item suppliers"
  ON library_item_suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM library_items li
      JOIN studio_members sm ON sm.studio_id = li.studio_id
      WHERE li.id = library_item_suppliers.library_item_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage their library categories"
  ON library_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = library_categories.studio_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage their library templates"
  ON library_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = library_templates.studio_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Studio members can manage library template fields"
  ON library_template_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM library_templates lt
      JOIN studio_members sm ON sm.studio_id = lt.studio_id
      WHERE lt.id = library_template_fields.template_id AND sm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Recreate seed functions with updated bodies (and updated names for clarity).
--    These are not called from app code; they exist for seeding and future use.
--    Bodies are identical to the originals except the table names.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_default_library_categories(p_studio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Flooring',       'layers',     10) RETURNING id INTO cat_flooring;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Wall Coverings', 'square',     20) RETURNING id INTO cat_walls;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Lighting',       'lightbulb',  30) RETURNING id INTO cat_lighting;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Furniture',      'armchair',   40) RETURNING id INTO cat_furniture;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Fabric & Upholstery', 'scissors', 50) RETURNING id INTO cat_fabric;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Stone & Tile',   'grid',       60) RETURNING id INTO cat_stone_tile;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Joinery',        'hammer',     70) RETURNING id INTO cat_joinery;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Paint & Finishes', 'paintbrush', 80) RETURNING id INTO cat_paint;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Sanitaryware',   'droplets',   90) RETURNING id INTO cat_sanitaryware;
  INSERT INTO library_categories (studio_id, name, icon, sort_order)
    VALUES (p_studio_id, 'Door Hardware',  'key',       100) RETURNING id INTO cat_hardware;

  INSERT INTO library_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_flooring, 'Carpet & Rugs', 10),
    (p_studio_id, cat_flooring, 'Hard Flooring', 20),
    (p_studio_id, cat_flooring, 'Vinyl & LVT',   30);

  INSERT INTO library_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_walls, 'Wallpaper',           10),
    (p_studio_id, cat_walls, 'Fabric Wall Covering', 20),
    (p_studio_id, cat_walls, 'Panelling',            30);

  INSERT INTO library_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_lighting, 'Pendant',    10),
    (p_studio_id, cat_lighting, 'Recessed',   20),
    (p_studio_id, cat_lighting, 'Wall Light', 30),
    (p_studio_id, cat_lighting, 'Floor Lamp', 40),
    (p_studio_id, cat_lighting, 'Table Lamp', 50);

  INSERT INTO library_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_furniture, 'Seating', 10),
    (p_studio_id, cat_furniture, 'Tables',  20),
    (p_studio_id, cat_furniture, 'Storage', 30),
    (p_studio_id, cat_furniture, 'Beds',    40);

  INSERT INTO library_categories (studio_id, parent_id, name, sort_order) VALUES
    (p_studio_id, cat_stone_tile, 'Wall Tile',     10),
    (p_studio_id, cat_stone_tile, 'Floor Tile',    20),
    (p_studio_id, cat_stone_tile, 'Natural Stone', 30),
    (p_studio_id, cat_stone_tile, 'Mosaic',        40);
END;
$$;

-- The full seed_category_templates body is large (~250 lines of INSERTs).
-- To keep this migration reviewable we recreate it as a thin wrapper that
-- references the renamed tables. The INSERT statements are identical to the
-- original in migration 015 — only the table names changed.

CREATE OR REPLACE FUNCTION seed_default_library_templates(p_studio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tmpl_flooring   uuid;
  tmpl_walls      uuid;
  tmpl_lighting   uuid;
  tmpl_furniture  uuid;
  tmpl_fabric     uuid;
  tmpl_stone      uuid;
  tmpl_joinery    uuid;
  tmpl_paint      uuid;
  tmpl_sanitary   uuid;
  tmpl_hardware   uuid;
BEGIN
  -- Flooring
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Flooring', true) RETURNING id INTO tmpl_flooring;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_flooring, 'Material',       'text',   true,  1, 'Primary flooring material, e.g. oak, wool, porcelain, LVT'),
    (tmpl_flooring, 'Width',          'text',   false, 2, 'Roll or board width, e.g. 4m, 190mm'),
    (tmpl_flooring, 'Thickness',      'text',   false, 3, 'Overall thickness including underlay if stated, e.g. 12mm'),
    (tmpl_flooring, 'Finish',         'text',   false, 4, 'Surface finish, e.g. brushed, lacquered, oiled, polished'),
    (tmpl_flooring, 'Fire Rating',    'select', false, 5, 'Fire/flame spread classification for the flooring product'),
    (tmpl_flooring, 'Slip Rating',    'select', false, 6, 'Slip resistance rating — R-value or Pendulum Test Value'),
    (tmpl_flooring, 'Install Method', 'text',   false, 7, 'Installation method, e.g. glue-down, loose-lay, floating'),
    (tmpl_flooring, 'Warranty',       'text',   false, 8, 'Manufacturer warranty period and conditions');
  UPDATE library_template_fields SET options = '["Class 1","Class 2","Class 3","Cfl-s1","Bfl-s1","Afl"]'::jsonb
    WHERE template_id = tmpl_flooring AND name = 'Fire Rating';
  UPDATE library_template_fields SET options = '["R9","R10","R11","R12","R13","PTV 36+","PTV 45+"]'::jsonb
    WHERE template_id = tmpl_flooring AND name = 'Slip Rating';
  UPDATE library_categories SET template_id = tmpl_flooring
    WHERE studio_id = p_studio_id AND name = 'Flooring' AND parent_id IS NULL;

  -- Wall Coverings
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Wall Coverings', true) RETURNING id INTO tmpl_walls;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_walls, 'Material',       'text',     true,  1, 'Base substrate, e.g. non-woven, grasscloth, vinyl, silk'),
    (tmpl_walls, 'Width',          'text',     false, 2, 'Roll width, typically in cm or inches, e.g. 53cm'),
    (tmpl_walls, 'Pattern Repeat', 'text',     false, 3, 'Vertical and horizontal repeat dimensions, e.g. 64cm straight'),
    (tmpl_walls, 'Fire Rating',    'select',   false, 4, 'Surface spread of flame classification for wall application'),
    (tmpl_walls, 'Application',    'text',     false, 5, 'Where it can be used, e.g. residential, contract, wet areas'),
    (tmpl_walls, 'Colourways',     'textarea', false, 6, 'Available colourway names or codes for this design');
  UPDATE library_template_fields SET options = '["Class A","Class B","Class 1","Class 0","BS EN 13501 B-s1","BS EN 13501 C-s2"]'::jsonb
    WHERE template_id = tmpl_walls AND name = 'Fire Rating';
  UPDATE library_categories SET template_id = tmpl_walls
    WHERE studio_id = p_studio_id AND name = 'Wall Coverings' AND parent_id IS NULL;

  -- Lighting
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Lighting', true) RETURNING id INTO tmpl_lighting;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_lighting, 'Fitting Type',       'text',    true,  1,  'Fitting category, e.g. pendant, recessed downlight, wall light'),
    (tmpl_lighting, 'Light Source',       'select',  false, 2,  'Lamp or light source technology type'),
    (tmpl_lighting, 'Wattage',            'text',    false, 3,  'Power consumption in watts, e.g. 9W, 2×26W'),
    (tmpl_lighting, 'Colour Temperature', 'select',  false, 4,  'Colour temperature in Kelvin — look for K or CCT values'),
    (tmpl_lighting, 'CRI',                'text',    false, 5,  'Colour Rendering Index value, e.g. CRI 90, Ra >80'),
    (tmpl_lighting, 'IP Rating',          'select',  false, 6,  'Ingress protection rating for dust and moisture'),
    (tmpl_lighting, 'Dimmable',           'boolean', false, 7,  'Whether the fitting is compatible with dimmer controls'),
    (tmpl_lighting, 'Voltage',            'text',    false, 8,  'Supply voltage, e.g. 230V, 12V DC, 24V DC'),
    (tmpl_lighting, 'Finish',             'text',    false, 9,  'Housing or body finish, e.g. brushed brass, matte black'),
    (tmpl_lighting, 'Dimensions',         'text',    false, 10, 'Overall dimensions H×W×D or diameter, e.g. Ø300mm'),
    (tmpl_lighting, 'Cable/Drop',         'text',    false, 11, 'Supplied cable or drop length, e.g. 2m cable, adjustable to 3m');
  UPDATE library_template_fields SET options = '["LED","Fluorescent","Halogen","Incandescent","Metal Halide","OLED","Fibre Optic"]'::jsonb
    WHERE template_id = tmpl_lighting AND name = 'Light Source';
  UPDATE library_template_fields SET options = '["2700K Warm White","3000K Warm White","3500K Neutral White","4000K Cool White","5000K Daylight","Tuneable White"]'::jsonb
    WHERE template_id = tmpl_lighting AND name = 'Colour Temperature';
  UPDATE library_template_fields SET options = '["IP20","IP44","IP54","IP65","IP67","IP68"]'::jsonb
    WHERE template_id = tmpl_lighting AND name = 'IP Rating';
  UPDATE library_categories SET template_id = tmpl_lighting
    WHERE studio_id = p_studio_id AND name = 'Lighting' AND parent_id IS NULL;

  -- Furniture
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Furniture', true) RETURNING id INTO tmpl_furniture;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_furniture, 'Material',          'text',    true,  1, 'Primary material, e.g. solid oak, steel frame, moulded foam'),
    (tmpl_furniture, 'Finish/Upholstery', 'text',    false, 2, 'Surface finish or fabric applied — colour, grade, or reference'),
    (tmpl_furniture, 'Dimensions',        'text',    false, 3, 'Overall H×W×D, e.g. H800 × W1200 × D600mm'),
    (tmpl_furniture, 'Seat Height',       'text',    false, 4, 'Seat height from floor, e.g. 450mm'),
    (tmpl_furniture, 'COM/COL',           'boolean', false, 5, 'Whether item accepts Customer''s Own Material or Leather'),
    (tmpl_furniture, 'Lead Time',         'text',    false, 6, 'Manufacturing and delivery lead time, e.g. 14–16 weeks ex-works'),
    (tmpl_furniture, 'Outdoor Suitable',  'boolean', false, 7, 'Whether the piece is rated for exterior or semi-outdoor use'),
    (tmpl_furniture, 'Warranty',          'text',    false, 8, 'Warranty period and scope, e.g. 5 year frame, 2 year upholstery');
  UPDATE library_categories SET template_id = tmpl_furniture
    WHERE studio_id = p_studio_id AND name = 'Furniture' AND parent_id IS NULL;

  -- Fabric & Upholstery
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Fabric & Upholstery', true) RETURNING id INTO tmpl_fabric;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_fabric, 'Composition',    'text',     true,  1, 'Fibre content by percentage, e.g. 60% wool 40% nylon'),
    (tmpl_fabric, 'Weight',         'text',     false, 2, 'Fabric weight in g/m², e.g. 380 g/m²'),
    (tmpl_fabric, 'Width',          'text',     false, 3, 'Fabric roll width, e.g. 140cm'),
    (tmpl_fabric, 'Martindale',     'number',   false, 4, 'Martindale abrasion rub count — look for a plain number'),
    (tmpl_fabric, 'Pattern Repeat', 'text',     false, 5, 'H and V pattern repeat dimensions, e.g. H32 × V28cm'),
    (tmpl_fabric, 'Fire Rating',    'select',   false, 6, 'Fire performance standard met by the fabric'),
    (tmpl_fabric, 'Cleaning Code',  'select',   false, 7, 'Manufacturer recommended cleaning method code'),
    (tmpl_fabric, 'Colourways',     'textarea', false, 8, 'Available colourway names or codes for the fabric'),
    (tmpl_fabric, 'Application',    'select',   false, 9, 'Intended end-use application for the fabric');
  UPDATE library_template_fields SET options = '["BS 5852 Crib 5","BS 5852 Crib 7","IMO A.652(16)","California TB117","EN 1021-1","EN 1021-2","Inherently FR"]'::jsonb
    WHERE template_id = tmpl_fabric AND name = 'Fire Rating';
  UPDATE library_template_fields SET options = '["W — Water-based","S — Solvent-based","WS — Water or Solvent","X — Vacuum Only","Dry Clean Only"]'::jsonb
    WHERE template_id = tmpl_fabric AND name = 'Cleaning Code';
  UPDATE library_template_fields SET options = '["Upholstery","Drapery","Dual Purpose","Bedding","Outdoor","Wall Covering"]'::jsonb
    WHERE template_id = tmpl_fabric AND name = 'Application';
  UPDATE library_categories SET template_id = tmpl_fabric
    WHERE studio_id = p_studio_id AND name = 'Fabric & Upholstery' AND parent_id IS NULL;

  -- Stone & Tile
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Stone & Tile', true) RETURNING id INTO tmpl_stone;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_stone, 'Material',         'text',    true,  1, 'Stone or tile type, e.g. Carrara marble, porcelain, travertine'),
    (tmpl_stone, 'Size',             'text',    true,  2, 'Tile or slab format, e.g. 600×600mm, 1200×600mm, slab'),
    (tmpl_stone, 'Thickness',        'text',    false, 3, 'Material thickness, e.g. 10mm, 20mm for external'),
    (tmpl_stone, 'Finish',           'select',  false, 4, 'Surface finish treatment applied to the stone or tile'),
    (tmpl_stone, 'Slip Rating',      'select',  false, 5, 'Slip resistance rating — R-value, PTV, or DCOF class'),
    (tmpl_stone, 'Water Absorption', 'select',  false, 6, 'ISO 10545 water absorption classification group'),
    (tmpl_stone, 'Application',      'select',  false, 7, 'Intended installation location and use'),
    (tmpl_stone, 'Frost Resistant',  'boolean', false, 8, 'Whether the tile or stone is rated frost-resistant'),
    (tmpl_stone, 'Joint Width',      'text',    false, 9, 'Recommended grout joint width, e.g. 2mm, 5mm');
  UPDATE library_template_fields SET options = '["Polished","Honed","Brushed","Tumbled","Sandblasted","Flamed","Bush Hammered","Matt Glazed","Gloss Glazed","Lappato"]'::jsonb
    WHERE template_id = tmpl_stone AND name = 'Finish';
  UPDATE library_template_fields SET options = '["R9","R10","R11","R12","R13","PTV 36+","PTV 45+","A","B","C"]'::jsonb
    WHERE template_id = tmpl_stone AND name = 'Slip Rating';
  UPDATE library_template_fields SET options = '["BIa — ≤0.5% (Porcelain)","BIb — 0.5–3%","BIIa — 3–6%","BIIb — 6–10%","BIII — >10%"]'::jsonb
    WHERE template_id = tmpl_stone AND name = 'Water Absorption';
  UPDATE library_template_fields SET options = '["Internal Floor","Internal Wall","External Floor","External Wall","Wet Area","Pool Surround","Facade"]'::jsonb
    WHERE template_id = tmpl_stone AND name = 'Application';
  UPDATE library_categories SET template_id = tmpl_stone
    WHERE studio_id = p_studio_id AND name = 'Stone & Tile' AND parent_id IS NULL;

  -- Joinery
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Joinery', true) RETURNING id INTO tmpl_joinery;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_joinery, 'Timber Species',    'text',    false, 1, 'Timber species or veneer, e.g. American walnut, European oak'),
    (tmpl_joinery, 'Core Construction', 'text',    false, 2, 'Core substrate, e.g. MDF, moisture-resistant MDF, plywood'),
    (tmpl_joinery, 'Finish',            'text',    true,  3, 'Applied finish, e.g. lacquer RAL 9016, open-pore oil, stained'),
    (tmpl_joinery, 'Edge Profile',      'text',    false, 4, 'Edge detail applied, e.g. pencil round, shadow gap, lipped'),
    (tmpl_joinery, 'Hardware Finish',   'text',    false, 5, 'Specified ironmongery finish, e.g. brushed satin brass'),
    (tmpl_joinery, 'Bespoke',           'boolean', false, 6, 'Whether this item is bespoke or custom-made to order'),
    (tmpl_joinery, 'Lead Time',         'text',    false, 7, 'Workshop lead time from sign-off, e.g. 8–10 weeks'),
    (tmpl_joinery, 'Fire Door',         'boolean', false, 8, 'Whether the door leaf is fire-rated (FD30, FD60, etc.)');
  UPDATE library_categories SET template_id = tmpl_joinery
    WHERE studio_id = p_studio_id AND name = 'Joinery' AND parent_id IS NULL;

  -- Paint & Finishes
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Paint & Finishes', true) RETURNING id INTO tmpl_paint;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_paint, 'Finish',             'select',   true,  1, 'Paint sheen level or finish type'),
    (tmpl_paint, 'Coverage',           'text',     false, 2, 'Theoretical coverage in m² per litre per coat'),
    (tmpl_paint, 'VOC Level',          'select',   false, 3, 'Volatile organic compound content classification'),
    (tmpl_paint, 'Application Method', 'select',   false, 4, 'Recommended application method for this product'),
    (tmpl_paint, 'Drying Time',        'text',     false, 5, 'Touch dry and recoat times, e.g. touch dry 2h, recoat 4h'),
    (tmpl_paint, 'Number of Coats',    'number',   false, 6, 'Recommended number of coats for full coverage'),
    (tmpl_paint, 'Colour Reference',   'textarea', false, 7, 'Full colour reference(s), bespoke mix formulas, or codes');
  UPDATE library_template_fields SET options = '["Matt","Flat Matt","Eggshell","Satin","Semi-Gloss","Gloss","Soft Sheen","Dead Flat","Limewash"]'::jsonb
    WHERE template_id = tmpl_paint AND name = 'Finish';
  UPDATE library_template_fields SET options = '["Zero VOC","Low VOC (<10 g/L)","Medium VOC (10–100 g/L)","High VOC (>100 g/L)","Exempt Compound"]'::jsonb
    WHERE template_id = tmpl_paint AND name = 'VOC Level';
  UPDATE library_template_fields SET options = '["Brush","Roller","Spray","Brush & Roller","Airless Spray","HVLP Spray"]'::jsonb
    WHERE template_id = tmpl_paint AND name = 'Application Method';
  UPDATE library_categories SET template_id = tmpl_paint
    WHERE studio_id = p_studio_id AND name = 'Paint & Finishes' AND parent_id IS NULL;

  -- Sanitaryware
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Sanitaryware', true) RETURNING id INTO tmpl_sanitary;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_sanitary, 'Type',             'select', true,  1, 'Sanitaryware product type or fixture category'),
    (tmpl_sanitary, 'Material',         'select', false, 2, 'Primary material the fixture is manufactured from'),
    (tmpl_sanitary, 'Dimensions',       'text',   false, 3, 'Overall dimensions L×W×H, e.g. 600×450×850mm'),
    (tmpl_sanitary, 'Outlet Size',      'text',   false, 4, 'Waste outlet size, e.g. 32mm, 40mm, 1½" BSP'),
    (tmpl_sanitary, 'Fixing Type',      'select', false, 5, 'How the fixture is mounted or fixed to the structure'),
    (tmpl_sanitary, 'Water Efficiency', 'text',   false, 6, 'Flush volume or flow rate, e.g. 4/2.6L dual flush'),
    (tmpl_sanitary, 'Finish',           'text',   false, 7, 'Exterior glaze or surface finish, e.g. white gloss'),
    (tmpl_sanitary, 'Compatible Waste', 'text',   false, 8, 'Recommended or compatible waste product reference');
  UPDATE library_template_fields SET options = '["Basin","WC","Bath","Shower Tray","Bidet","Urinal","Sink","Butler Sink"]'::jsonb
    WHERE template_id = tmpl_sanitary AND name = 'Type';
  UPDATE library_template_fields SET options = '["Vitreous China","Fireclay","Acrylic","Cast Iron","Solid Surface","Stainless Steel","Resin","Stone Resin"]'::jsonb
    WHERE template_id = tmpl_sanitary AND name = 'Material';
  UPDATE library_template_fields SET options = '["Floor Standing","Wall Hung","Semi-Recessed","Countertop","Under-Counter","Inset","Freestanding"]'::jsonb
    WHERE template_id = tmpl_sanitary AND name = 'Fixing Type';
  UPDATE library_categories SET template_id = tmpl_sanitary
    WHERE studio_id = p_studio_id AND name = 'Sanitaryware' AND parent_id IS NULL;

  -- Door Hardware
  INSERT INTO library_templates (studio_id, name, is_active)
    VALUES (p_studio_id, 'Door Hardware', true) RETURNING id INTO tmpl_hardware;
  INSERT INTO library_template_fields (template_id, name, field_type, is_required, order_index, ai_hint) VALUES
    (tmpl_hardware, 'Type',            'select',  true,  1, 'Hardware item type or ironmongery category'),
    (tmpl_hardware, 'Material',        'text',    false, 2, 'Base material, e.g. solid brass, stainless steel, zinc alloy'),
    (tmpl_hardware, 'Finish',          'select',  true,  3, 'Applied surface finish or plating on the hardware'),
    (tmpl_hardware, 'Backset',         'text',    false, 4, 'Latch backset dimension, e.g. 44mm, 57mm, 72mm'),
    (tmpl_hardware, 'Rose/Escutcheon', 'select',  false, 5, 'Rose plate or escutcheon shape accompanying the handle'),
    (tmpl_hardware, 'Fire Rated',      'boolean', false, 6, 'Whether the hardware is certified for fire-rated doors'),
    (tmpl_hardware, 'Pack Quantity',   'text',    false, 7, 'Units supplied per pack, e.g. sold as pair, pack of 3');
  UPDATE library_template_fields SET options = '["Lever Handle","Pull Handle","Knob","Flush Pull","Cylinder","Lock","Hinge","Closer","Overhead Stop","Floor Spring","Letter Box","Numerals"]'::jsonb
    WHERE template_id = tmpl_hardware AND name = 'Type';
  UPDATE library_template_fields SET options = '["Polished Brass","Satin Brass","Aged Brass","Brushed Nickel","Polished Nickel","Satin Chrome","Polished Chrome","Matt Black","Antique Bronze","PVD Gold","Satin Stainless"]'::jsonb
    WHERE template_id = tmpl_hardware AND name = 'Finish';
  UPDATE library_template_fields SET options = '["Round Rose","Square Rose","Oval Rose","Bathroom Turn & Release","Keyhole Escutcheon","None"]'::jsonb
    WHERE template_id = tmpl_hardware AND name = 'Rose/Escutcheon';
  UPDATE library_categories SET template_id = tmpl_hardware
    WHERE studio_id = p_studio_id AND name = 'Door Hardware' AND parent_id IS NULL;
END;
$$;
