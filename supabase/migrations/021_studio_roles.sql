-- ── Migration 021: Studio roles ───────────────────────────────────────────────
--
-- Adds a configurable "studio_roles" table for job titles (e.g. Senior Designer,
-- Middleweight, Junior Designer). These are distinct from the access-control
-- roles on studio_members (owner/admin/designer/viewer) — they describe what
-- someone *is*, not what they can *do*.
--
-- Also adds a nullable studio_role_id FK on studio_members so each member can
-- be assigned a job title.

CREATE TABLE studio_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, name)
);

ALTER TABLE studio_roles ENABLE ROW LEVEL SECURITY;

-- All studio members can see their studio's roles
CREATE POLICY "Studio members can view roles"
  ON studio_roles FOR SELECT
  USING (studio_id = ANY(SELECT auth_user_studio_ids()));

-- Only owners/admins can create, update, or delete roles
CREATE POLICY "Studio admins can manage roles"
  ON studio_roles FOR ALL
  USING  (studio_id = ANY(SELECT auth_user_admin_studio_ids()))
  WITH CHECK (studio_id = ANY(SELECT auth_user_admin_studio_ids()));

-- ── Add studio_role_id to studio_members ─────────────────────────────────────
--
-- Nullable: a member doesn't have to have a job title assigned.
-- ON DELETE SET NULL: deleting a role un-assigns it from members, never
-- deletes the member.

ALTER TABLE studio_members
  ADD COLUMN studio_role_id uuid REFERENCES studio_roles(id) ON DELETE SET NULL;
