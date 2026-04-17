-- ============================================================
-- Ida Designer — Seed Data
-- ============================================================
-- Run via psql (supply your own DB password via the PGPASSWORD env var;
-- do not commit real credentials):
--   PGPASSWORD='<your-db-password>' psql \
--     "postgresql://postgres@db.<your-project-ref>.supabase.co:5432/postgres" \
--     -f supabase/seed.sql
--
-- This inserts two studios, links the developer as owner of both,
-- adds 6 clients and 6 projects with fictional demo data.
--
-- All client names, emails (.example TLD), and project details below are
-- fictional placeholders used for local development only — they do not
-- represent real customers.
-- ============================================================

-- Developer user ID (fetch with: SELECT id FROM auth.users LIMIT 1).
-- Swap in your own auth.users.id before running this seed against a
-- fresh environment.
\set gal_id '8809d913-3132-4b8f-8724-478d77cd1b82'

-- ── Clean up any previous seed data ─────────────────────────
-- This makes the seed idempotent (safe to run multiple times)
DELETE FROM projects WHERE code IN ('IDA-182','IDA-201','IDA-198','IDA-210','IDA-195','IDA-203');
DELETE FROM clients WHERE email IN (
  'design@acmehotels.example',
  'projects@harbourhotels.example',
  'interiors@fenwick.example',
  'hello@gardenclub.example',
  'contact@privateresidence.example',
  'projects@emberdining.example'
);
DELETE FROM studio_members WHERE user_id = :'gal_id';
DELETE FROM studios WHERE slug IN ('fabled-studio', 'noir-interiors');

-- ── 1. Insert studios ────────────────────────────────────────
INSERT INTO studios (id, name, slug, subscription_status)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Fabled Studio',  'fabled-studio',  'active'),
  ('11111111-0000-0000-0000-000000000002', 'Noir Interiors', 'noir-interiors',  'trial');

-- ── 1b. Ensure the developer's profile exists ───────────────
-- The auth trigger normally creates this, but if the trigger wasn't set up
-- when the account was created, we need to insert it manually.
INSERT INTO profiles (id, first_name, last_name, platform_role)
VALUES (:'gal_id', 'Demo', 'Admin', 'super_admin')
ON CONFLICT (id) DO UPDATE SET platform_role = 'super_admin';

-- ── 2. Link the developer as owner of both studios ──────────
INSERT INTO studio_members (studio_id, user_id, role)
VALUES
  ('11111111-0000-0000-0000-000000000001', :'gal_id', 'owner'),
  ('11111111-0000-0000-0000-000000000002', :'gal_id', 'owner');

-- ── 3. Clients for Fabled Studio (fictional) ────────────────
INSERT INTO clients (id, studio_id, name, email, phone, company)
VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Acme Hotels',         'design@acmehotels.example',      '+44 20 7000 0001', 'Acme Hotels Group'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'Harbour Hotels',      'projects@harbourhotels.example', '+44 20 7000 0002', 'Harbour Hotels Ltd'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   'Fenwick Residences',  'interiors@fenwick.example',      '+44 20 7000 0003', 'Fenwick Residences'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'The Garden Club',     'hello@gardenclub.example',       NULL,               'The Garden Club');

-- ── 4. Clients for Noir Interiors (fictional) ───────────────
INSERT INTO clients (id, studio_id, name, email, phone, company)
VALUES
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002',
   'Private Residence', 'contact@privateresidence.example', NULL, NULL),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002',
   'Ember Dining',        'projects@emberdining.example',   NULL,               'Ember Dining Group');

-- ── 5. Projects for Acme Hotels ─────────────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'The Library Bar', 'IDA-182', 'active',
   'Example Terrace, Dublin',
   'Full FF&E specification and drawing package for a flagship hotel bar redesign.'),

  ('33333333-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'The Rooftop Bar', 'IDA-201', 'on_hold',
   'Example Riverside, London',
   NULL),

  ('33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   'Spa & Wellness Suite', 'IDA-198', 'active',
   'Example Crescent, Edinburgh',
   NULL);

-- ── 6. Projects for Harbour Hotels ──────────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   'Harbour Hotels Edinburgh', 'IDA-210', 'active',
   'Example Street, Edinburgh',
   NULL);

-- ── 7. Projects for Fenwick Residences ──────────────────────
INSERT INTO projects (id, studio_id, client_id, name, code, status, site_address, description)
VALUES
  ('33333333-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003',
   'Private Members Lounge', 'IDA-195', 'completed',
   'Example Square, London',
   NULL),

  ('33333333-0000-0000-0000-000000000006',
   '11111111-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003',
   'The Vault Bar', 'IDA-203', 'active',
   'Example Square, London',
   NULL);

-- ── Confirmation ─────────────────────────────────────────────
SELECT 'Studios:' AS entity, COUNT(*) FROM studios WHERE slug IN ('fabled-studio','noir-interiors')
UNION ALL
SELECT 'Studio members:', COUNT(*) FROM studio_members WHERE user_id = :'gal_id'
UNION ALL
SELECT 'Clients:', COUNT(*) FROM clients WHERE studio_id IN ('11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002')
UNION ALL
SELECT 'Projects:', COUNT(*) FROM projects WHERE studio_id = '11111111-0000-0000-0000-000000000001';
