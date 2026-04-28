-- Generated columns to make budget reporting queryable.
-- effective_unit_cost = price if set, else budget (the figure used for totals)
-- is_budgeted = true when no real price yet but a budget is set
-- Both are STORED so they can be indexed and aggregated efficiently.

ALTER TABLE project_specs
  ADD COLUMN effective_unit_cost numeric
    GENERATED ALWAYS AS (COALESCE(price, budget)) STORED,
  ADD COLUMN is_budgeted boolean
    GENERATED ALWAYS AS (price IS NULL AND budget IS NOT NULL) STORED;

CREATE INDEX project_specs_is_budgeted_idx
  ON project_specs (project_id, is_budgeted)
  WHERE is_budgeted = true;
