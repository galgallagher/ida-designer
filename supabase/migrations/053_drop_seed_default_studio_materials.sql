-- Drop the unused seed_default_studio_materials() function.
-- It was never called from app code; default-finishes seeding is now handled by
-- trg_seed_default_finishes (migration 052), which copies rows from the
-- data-driven default_finishes table on studio creation. See ADR 028.

DROP FUNCTION IF EXISTS seed_default_studio_materials(uuid);
