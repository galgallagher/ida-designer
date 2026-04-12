-- Migration 026: add global_spec_id to specs
--
-- Links a studio spec back to its global source.
-- Nullable — existing specs are unaffected (global_spec_id = null).
-- ON DELETE SET NULL — if a global spec is removed, the studio spec
-- becomes standalone rather than disappearing.
--
-- A studio can only pin a given global spec once (partial unique index).

alter table specs
  add column if not exists global_spec_id uuid
  references global_specs(id) on delete set null;

create index idx_specs_global_spec_id on specs(global_spec_id);

-- Prevent a studio pinning the same global spec twice
create unique index idx_specs_studio_global_unique
  on specs(studio_id, global_spec_id)
  where global_spec_id is not null;
