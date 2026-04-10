-- Migration 004: clients
--
-- DESIGN DECISION (see docs/adr/003-shared-clients.md):
-- Clients are scoped to a studio. Studio A creates and owns their "Hilton UK" record;
-- Studio B creates and owns their own. They are separate records with no crossover.
--
-- This is intentional — a "Hilton UK" entity is genuinely different from "Hilton International",
-- and studios should have full control over their own client records without any shared data.
--
-- FUTURE: a client_organisations table will allow optional grouping across studios
-- (e.g. linking "Hilton UK" and "Hilton International" under a parent "Hilton Hotels" org).
-- That org record is what Hilton team members would log in to see the full cross-studio picture.
-- That is a separate, additive feature — it does not change this table's structure.

create table clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  -- company allows distinguishing entities: "Hilton UK Ltd" vs "Hilton International Inc"
  company text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients enable row level security;

-- Studio members can only see and manage their own studio's clients.
create policy "Studio members can manage their own clients"
  on clients for all
  using (
    exists (
      select 1 from studio_members
      where studio_id = clients.studio_id and user_id = auth.uid()
    )
  );

-- Super admins can see everything.
create policy "Super admins can manage all clients"
  on clients for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and platform_role = 'super_admin'
    )
  );
