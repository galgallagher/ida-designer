-- Per-slot budget — an aspirational target separate from the price.
-- Budgets are typically set at project kickoff; price is the actual cost
-- once a spec is chosen.

ALTER TABLE project_specs
  ADD COLUMN budget numeric CHECK (budget IS NULL OR budget >= 0);
