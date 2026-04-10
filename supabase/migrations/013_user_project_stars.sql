-- Migration 013: User project stars
-- Allows individual users to star/favourite projects so they appear at the top
-- of their sidebar and project lists. Stars are per-user, not per-studio.

CREATE TABLE IF NOT EXISTS user_project_stars (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE user_project_stars ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own stars
CREATE POLICY "Users manage their own stars"
  ON user_project_stars
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
