-- 016_category_abbreviation.sql
-- Adds a short abbreviation to spec categories (e.g. "FB" for Fabric & Upholstery)
-- Used to build project codes such as FB-001, FB-002…

ALTER TABLE spec_categories
  ADD COLUMN IF NOT EXISTS abbreviation text;
