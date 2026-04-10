-- Migration 005: projects
-- A project represents a single interior design engagement for a client.
-- Projects contain drawings and specifications.

-- Enum for project lifecycle stages
create type project_status as enum ('active', 'on_hold', 'completed', 'archived');

create table projects (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  -- Deleting a client is blocked if they have projects (on delete restrict).
  -- This prevents accidental data loss — archive or reassign projects first.
  client_id uuid not null references clients(id) on delete restrict,
  name text not null,
  -- code is a human-readable reference number e.g. "IDA-2024-001"
  code text,
  status project_status not null default 'active',
  site_address text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "Studio members can manage their projects"
  on projects for all
  using (
    exists (
      select 1 from studio_members
      where studio_id = projects.studio_id and user_id = auth.uid()
    )
  );
