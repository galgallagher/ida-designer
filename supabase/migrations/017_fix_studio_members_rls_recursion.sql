-- 017_fix_studio_members_rls_recursion.sql
--
-- The original "Members can view studio colleagues" and "Studio admins can manage members"
-- policies on studio_members queried studio_members from within a studio_members policy,
-- causing infinite recursion (Postgres error: "infinite recursion detected in policy").
--
-- Fix: SECURITY DEFINER helper functions bypass RLS when called, breaking the loop.

CREATE OR REPLACE FUNCTION auth_user_studio_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT studio_id FROM studio_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_admin_studio_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT studio_id FROM studio_members
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin');
$$;

DROP POLICY IF EXISTS "Members can view studio colleagues" ON studio_members;
CREATE POLICY "Members can view studio colleagues"
  ON studio_members FOR SELECT
  USING (studio_id = ANY(SELECT auth_user_studio_ids()));

DROP POLICY IF EXISTS "Studio admins can manage members" ON studio_members;
CREATE POLICY "Studio admins can manage members"
  ON studio_members FOR ALL
  USING (studio_id = ANY(SELECT auth_user_admin_studio_ids()));
