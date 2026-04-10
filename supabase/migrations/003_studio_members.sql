-- Migration 003: studio_members
-- The join table that links users (profiles) to studios.
-- A user can belong to multiple studios with different roles in each.

create table studio_members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- role controls what the member can do within the studio:
  --   owner    = full control, can delete the studio
  --   admin    = manage members and all content
  --   designer = create and edit content
  --   viewer   = read-only
  role text not null default 'designer'
    check (role in ('owner', 'admin', 'designer', 'viewer')),
  created_at timestamptz not null default now(),
  -- A user can only be a member of a studio once
  unique(studio_id, user_id)
);

alter table studio_members enable row level security;

-- A user can always see their own membership rows (non-recursive).
create policy "Users can view their own memberships"
  on studio_members for select
  using (user_id = auth.uid());

-- A user can see all members of studios they belong to.
-- Uses a subquery rather than a self-join to avoid infinite recursion.
create policy "Members can view studio colleagues"
  on studio_members for select
  using (
    studio_id in (
      select studio_id from studio_members where user_id = auth.uid()
    )
  );

-- Only owners and admins can add, update, or remove members.
create policy "Studio admins can manage members"
  on studio_members for all
  using (
    studio_id in (
      select studio_id from studio_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Now that studio_members exists, add the cross-reference policy on studios.
-- (Defined here rather than in 002_studios.sql to avoid a forward-reference error.)
create policy "Studio members can view their studio"
  on studios for select
  using (
    exists (
      select 1 from studio_members
      where studio_id = studios.id and user_id = auth.uid()
    )
  );
