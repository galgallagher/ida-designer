-- 019_contacts_crm.sql
--
-- Replaces the suppliers / supplier_contacts tables with a unified CRM model:
--   contact_companies  — company/organisation records (replaces suppliers)
--   contact_people     — individuals at a company (replaces supplier_contacts)
--   contact_tags       — free-form tags on companies (cross-studio tag vocabulary)
--
-- spec_suppliers is dropped and recreated pointing at contact_companies.
-- Clean slate — all dummy data removed.

-- ── 1. Drop old tables (cascade removes dependent FKs) ────────────────────────

DROP TABLE IF EXISTS spec_suppliers    CASCADE;
DROP TABLE IF EXISTS supplier_contacts CASCADE;
DROP TABLE IF EXISTS suppliers         CASCADE;

-- ── 2. contact_companies ──────────────────────────────────────────────────────

CREATE TABLE contact_companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  category_id uuid REFERENCES contact_categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  website     text,
  email       text,
  phone       text,
  street      text,
  city        text,
  country     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage contact companies"
  ON contact_companies FOR ALL
  USING (studio_id = ANY(SELECT auth_user_studio_ids()));

-- ── 3. contact_people ─────────────────────────────────────────────────────────

CREATE TABLE contact_people (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES contact_companies(id) ON DELETE CASCADE,
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage contact people"
  ON contact_people FOR ALL
  USING (studio_id = ANY(SELECT auth_user_studio_ids()));

-- ── 4. contact_tags ───────────────────────────────────────────────────────────

CREATE TABLE contact_tags (
  company_id  uuid NOT NULL REFERENCES contact_companies(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  PRIMARY KEY (company_id, tag)
);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can manage contact tags"
  ON contact_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contact_companies cc
      WHERE cc.id = contact_tags.company_id
        AND cc.studio_id = ANY(SELECT auth_user_studio_ids())
    )
  );

-- ── 5. spec_suppliers — recreated pointing at contact_companies ───────────────

CREATE TABLE spec_suppliers (
  spec_id        uuid NOT NULL REFERENCES specs(id)             ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES contact_companies(id) ON DELETE CASCADE,
  supplier_code  text,
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

-- ── 6. updated_at auto-trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_companies_updated_at
  BEFORE UPDATE ON contact_companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contact_people_updated_at
  BEFORE UPDATE ON contact_people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
