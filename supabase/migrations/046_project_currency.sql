-- Per-project currency. Drives money formatting (e.g. on the schedule total).
-- ISO 4217 three-letter codes; default GBP.

ALTER TABLE projects
  ADD COLUMN currency text NOT NULL DEFAULT 'GBP'
  CHECK (currency ~ '^[A-Z]{3}$');
