-- Migration 001: profiles
-- Extends the built-in Supabase auth.users table with application-level data.
-- One row is created per user when they sign up (via a trigger in a future migration).

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  -- platform_role controls what the user can do at the platform level:
  --   studio_member  = a regular user belonging to one or more studios (default)
  --   super_admin    = Ida platform staff who can see everything
  platform_role text not null default 'studio_member'
    check (platform_role in ('super_admin', 'studio_member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: Row Level Security means Postgres checks a policy before returning any row.
-- Without policies, RLS blocks ALL access — which is safe but breaks the app.
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Super admins need to see all profiles (e.g. for a user management page).
-- The subquery is safe: it only returns true for your own row that happens to
-- have platform_role = 'super_admin'.
create policy "Super admins can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and platform_role = 'super_admin'
    )
  );
