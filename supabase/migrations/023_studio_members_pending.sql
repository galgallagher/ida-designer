-- ── Migration 023: Pending studio members ────────────────────────────────────
--
-- Allows adding people to the studio roster before they have a Supabase
-- auth account (i.e. before they've been invited).
--
-- user_id becomes nullable:
--   NOT NULL  → active member (has logged in)
--   NULL      → pending member (added by admin, not yet invited/signed up)
--
-- email, first_name, last_name are stored directly for pending members.
-- For active members these come from auth/profiles instead.
--
-- When a pending member is invited and accepts, user_id gets filled in.

ALTER TABLE studio_members
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN email      text,
  ADD COLUMN first_name text,
  ADD COLUMN last_name  text;

-- Prevent the same email being added to the same studio twice
CREATE UNIQUE INDEX studio_members_studio_email_unique
  ON studio_members (studio_id, email)
  WHERE email IS NOT NULL;
