-- Backfill: pad numeric suffix in project_specs.code to 2 digits.
-- e.g. FB1 -> FB01, FB12 stays FB12. Idempotent.

UPDATE project_specs
SET code = regexp_replace(code, '\d+$', '')
        || lpad(regexp_replace(code, '^\D+', ''), 2, '0')
WHERE code ~ '^[A-Z]+\d$';
