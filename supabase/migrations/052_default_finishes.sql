-- Platform-level defaults for the Finishes Library.
-- Super-admins curate this list; rows are copied into a new studio's
-- studio_materials table on studio creation.
--
-- Replaces the hardcoded seed_default_studio_materials() function with a
-- data-driven approach so the platform owner can manage defaults visually.

create table default_finishes (
  id          uuid        primary key default gen_random_uuid(),
  category    text        not null check (category in ('wood','stone','metal','glass','concrete')),
  name        text        not null,
  description text,
  image_url   text,
  image_path  text,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table default_finishes enable row level security;

create index idx_default_finishes_category on default_finishes(category, sort_order);

-- Super-admins can manage defaults; everyone authenticated can read.
create policy "Super-admins manage default finishes"
  on default_finishes for all
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and platform_role = 'super_admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and platform_role = 'super_admin')
  );

create policy "Authenticated users can read default finishes"
  on default_finishes for select
  to authenticated
  using (true);

-- Trigger function: copy default_finishes → studio_materials on studio insert
create or replace function copy_default_finishes_to_new_studio()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into studio_materials (studio_id, category, name, description, image_url, image_path, sort_order)
  select new.id, category, name, description, image_url, image_path, sort_order
  from   default_finishes;
  return new;
end;
$$;

drop trigger if exists trg_seed_default_finishes on studios;
create trigger trg_seed_default_finishes
  after insert on studios
  for each row
  execute function copy_default_finishes_to_new_studio();

-- Storage: re-use the existing public material-images bucket.
-- Defaults live under "_defaults/" path prefix to avoid collisions with studios.
create policy "Super-admins manage default material images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'material-images'
    and (storage.foldername(name))[1] = '_defaults'
    and exists (select 1 from profiles where id = auth.uid() and platform_role = 'super_admin')
  )
  with check (
    bucket_id = 'material-images'
    and (storage.foldername(name))[1] = '_defaults'
    and exists (select 1 from profiles where id = auth.uid() and platform_role = 'super_admin')
  );
