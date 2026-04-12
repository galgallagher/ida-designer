-- Migration 024: add source_url column to specs
--
-- Stores the original product page URL (UTM-stripped) so we can:
--   1. Show a "View product page" button in the spec detail modal
--   2. Do reliable duplicate detection without relying on spec_tags
--
-- Backfills existing rows from the source: tag where present.

ALTER TABLE specs ADD COLUMN IF NOT EXISTS source_url text;

-- Backfill from existing spec_tags
UPDATE specs s
SET source_url = REPLACE(st.tag, 'source:', '')
FROM spec_tags st
WHERE st.spec_id = s.id
  AND st.tag LIKE 'source:%'
  AND s.source_url IS NULL;
