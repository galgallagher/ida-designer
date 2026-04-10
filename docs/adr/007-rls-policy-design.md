# ADR 007 — RLS Policy Design: Avoiding Infinite Recursion

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Supabase enforces Row Level Security (RLS) on every table. Policies are SQL expressions evaluated per-row. Two classes of recursion bug emerged during development:

**Class 1 — Self-referential table policies.**  
The `studio_members` table originally had a policy "Members can view studio colleagues" with:
```sql
USING (studio_id IN (SELECT studio_id FROM studio_members WHERE user_id = auth.uid()))
```
This queries `studio_members` inside a policy *for* `studio_members`. Postgres detects this as infinite recursion and returns error `42P17`, even when another non-recursive policy would have been sufficient.

**Class 2 — Cross-table recursion through super_admin checks.**  
Multiple tables (clients, studios) had policies like:
```sql
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'super_admin'))
```
The `profiles` table itself had a "Super admins can view all profiles" policy that also queried `profiles`. When any of those outer queries triggered `profiles` RLS, the recursion loop fired: `clients` → `profiles` RLS → `profiles` query → `profiles` RLS → ...

## Decision

**Rule 1: Never query a table from within its own RLS policy.**  
The "Members can view studio colleagues" policy was dropped entirely — users only ever need to see their own membership rows, which the non-recursive `user_id = auth.uid()` policy covers.

**Rule 2: Use `SECURITY DEFINER` functions for all cross-table permission checks.**  
A `SECURITY DEFINER` function runs with the privileges of its definer (postgres), bypassing RLS on the tables it queries. This breaks the recursion chain.

Two functions created directly in Supabase (not in migration files — they depend on existing tables and policies):

```sql
-- Checks if the calling user is a platform super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'super_admin'
  );
$$;

-- Checks if the calling user is an owner/admin of a specific studio
CREATE OR REPLACE FUNCTION is_studio_admin(p_studio_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = p_studio_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;
```

All policies that previously queried `profiles` or `studio_members` directly in a recursive context now call these functions instead:
```sql
-- Example: clients table super admin policy
CREATE POLICY "Super admins can manage all clients"
  ON clients FOR ALL USING (is_super_admin());
```

## Consequences

- Zero recursive policy errors in production.
- All super_admin checks are centralised in one function — easy to audit.
- `STABLE` marking allows Postgres to cache the result within a query, improving performance.
- These functions were applied directly via Supabase SQL editor, not through migration files (migration files would have circular dependency issues at time of creation). Document any future changes to these functions carefully.
- **Rule for new tables:** Every new table with a super_admin bypass policy must use `is_super_admin()`. Every new policy that needs to check studio membership from another table should use `is_studio_admin()` or a direct `studio_id` check with `studio_members` (which is safe from non-studio_members tables).
