-- Migration 012: contacts
--
-- A contact is a person at a client company.
-- One client (company) can have many contacts.
-- This gives studios a mini-CRM: track who to call at Hilton, Virgin, etc.
--
-- The studio_id is stored directly (denormalised from clients) so that
-- RLS can be enforced without a join — avoiding any recursive policy risk.

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  studio_id uuid not null references studios(id) on delete cascade,
  first_name text not null,
  last_name text,
  role text,           -- job title / role at the client company
  email text,
  phone text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contacts enable row level security;

-- Studio members can manage contacts belonging to their studio
create policy "Studio members can manage contacts"
  on contacts for all
  using (
    exists (
      select 1 from studio_members
      where studio_id = contacts.studio_id and user_id = auth.uid()
    )
  );

-- Super admins can see and manage everything
create policy "Super admins can manage all contacts"
  on contacts for all
  using (is_super_admin());
