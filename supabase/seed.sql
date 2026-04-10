-- ============================================================
-- Ida Designer — Seed Data
-- ============================================================
-- Run via psql:
--   PGPASSWORD='REDACTED' psql "postgresql://postgres@db.tsvehxlvmzumcrmstceo.supabase.co:5432/postgres" -f supabase/seed.sql
--
-- This inserts two studios, links Gal as owner of both,
-- adds 6 clients and 6 projects with realistic data.
-- ============================================================

-- Gal's user ID (fetched via: SELECT id FROM auth.users LIMIT 1)
-- We store it in a variable so the rest of the script stays readable.
\set gal_id '8809d913-3132-4b8f-8724-478d77cd1b82'

-- ── Clean up any previous seed data ─────────────────────────
-- This makes the seed idempotent (safe to run multiple times)
DELETE FROM projects WHERE code IN ('IDA-182','IDA-201','IDA-198','IDA-210','IDA-195','IDA-203');
DELETE FROM clients WHERE email IN (
  'design@hilton.com',
  'projects@virginhotels.com',
  'interiors@thened.com',
  'design@sohohouse.com',
  'contact@privateresidence.com',
  'projects@sketch.london'
);
DELETE FROM studio_members WHERE user_id = :'gal_id';
DELETE FROM studios WHERE slug IN ('fabled-studio', 'noir-interiors');

-- ── 1. Insert studios ────────────────────────────────────────
INSERT INTO studios (id, name, slug, subscription_status)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Fabled Studio',  'fabled-studio',  'active'),
  ('11111111-0000-0000-0000-000000000002', 'Noir Interiors', 'noir-interiors',  'trial');

-- ── 1b. Ensure Gal's profile exists ─────────────────────────
-- The auth trigger normally creates this, but if the trigger wasn't set up
-- when the account was created, we need to insert it manually.
INSERT INTO profiles (id, first_name, last_name, platform_role)
VALUES (:'gal_id', 'Gal', 'Admin', 'super_admin')
ON CONFLICT (id) DO UPDATE SET platform_role = 'super_admin';

-- ── 2. Link Gal as owner of both studios ─────────────────────
INSERT INTO studio_members (studio_id, user_id, role)
VALUES
  ('11111111-0000-0000-0000-000000000001', :'gal_id', 'owner'),
  ('11111111-0000-0000-0000-000000000002', :'gal_id', 'owner');

-- ── 3. Clients for Fabled Studio ────────────────────────────
INSERT INTO clients (id, studio_id, name, email, phone, company)
VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Hilton Hotels',       'design@hilton.com',          '+44 20 7123 4567', 'Hilton Hotels Group'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'Virgin Hotels',       'projects@virginhotels.com',  '+44 20 8901 2345', 'Virgin Hotels Ltd'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   'The Ned',             'interiors@thened.com',        '+44 20 7826 8000', 'The Ned London'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'Soho House',          'design@sohohouse.com',        NULL,               'Soho House Group');

-- ── 4. Clients for Noir Interiors ────────────────────────────
INSERT INTO clients (id, studio_id, name, email, phone, company)
VALUES
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002',
   'Private Residence - Mayfair', 'contact@privateresidence.com', NULL, NULL),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002',
   'Sketch London',       'projects@sketch.london',      NULL,               'Sketch London Ltd');

-- ── 5. Projects for Hilton Hotels ────────────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'Lemuel''s Bar', 'IDA-182', 'active',
   'Earlsfort Terrace, Dublin 2',
   'Full FF&E specification and drawing package for the redesign of Lemuel''s Bar at the Conrad Dublin.'),

  ('33333333-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'The Rooftop Bar', 'IDA-201', 'on_hold',
   'Bankside, London SE1',
   NULL),

  ('33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'Spa & Wellness Suite', 'IDA-198', 'active',
   'Edinburgh EH2',
   NULL);

-- ── 6. Projects for Virgin Hotels ────────────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   'Virgin Hotels Edinburgh', 'IDA-210', 'active',
   '10 India St, Edinburgh',
   NULL);

-- ── 7. Projects for The Ned ───────────────────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003',
   'Private Members Lounge', 'IDA-195', 'completed',
   '27 Poultry, London EC2R',
   NULL),

  ('33333333-0000-0000-0000-000000000006',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003',
   'The Vault Bar', 'IDA-203', 'active',
   '27 Poultry, London EC2R',
   NULL);

-- ── Confirmation ─────────────────────────────────────────────
SELECT 'Studios:' AS entity, COUNT(*) FROM studios WHERE slug IN ('fabled-studio','noir-interiors')
UNION ALL
SELECT 'Studio members:', COUNT(*) FROM studio_members WHERE user_id = :'gal_id'
UNION ALL
SELECT 'Clients:', COUNT(*) FROM clients WHERE studio_id IN ('11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002')
UNION ALL
SELECT 'Projects:', COUNT(*) FROM projects WHERE studio_id = '11111111-0000-0000-0000-000000000001';
