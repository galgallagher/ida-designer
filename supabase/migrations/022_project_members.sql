-- ── Migration 022: Project members ───────────────────────────────────────────
--
-- Associates studio members with specific projects so you can track who is
-- working on what. A studio member can be on multiple projects; a project can
-- have multiple members.
--
-- Access control:
--   - Any studio member can VIEW who is on a project (within their studio).
--   - Only studio owners/admins can ADD or REMOVE members from a project.

CREATE TABLE project_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  studio_member_id  uuid        NOT NULL REFERENCES studio_members(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, studio_member_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Studio members can view project members for projects that belong to their studio
CREATE POLICY "Studio members can view project members"
  ON project_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE studio_id = ANY(SELECT auth_user_studio_ids())
    )
  );

-- Only owners/admins can add or remove project members
CREATE POLICY "Studio admins can manage project members"
  ON project_members FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE studio_id = ANY(SELECT auth_user_admin_studio_ids())
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE studio_id = ANY(SELECT auth_user_admin_studio_ids())
    )
  );
