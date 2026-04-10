-- Migration 002: studios
-- A studio is the top-level tenant — a single interior design business.
-- All data (clients, projects, specs) belongs to a studio.

create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- slug is used in URLs: app.idadesigner.com/s/studio-name
  slug text not null unique,
  logo_url text,
  -- subscription_status controls platform access:
  --   trial      = newly created, limited access
  --   active     = paying customer
  --   past_due   = payment failed, grace period
  --   cancelled  = no longer active
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table studios enable row level security;

-- NOTE: The "Studio members can view their studio" policy references the studio_members
-- table, which is created in 003_studio_members.sql. That policy is therefore defined
-- at the bottom of 003_studio_members.sql to avoid a forward-reference error.

-- Super admins can do anything to any studio.
create policy "Super admins can manage all studios"
  on studios for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and platform_role = 'super_admin'
    )
  );
