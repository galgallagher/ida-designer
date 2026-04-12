-- Migration 025: global_specs, global_spec_fields, global_spec_tags
--
-- The Global Material Library — a platform-level product cache.
-- When a studio scrapes a URL, the raw product data is written here first.
-- Subsequent studios scraping the same URL reuse this data without re-scraping.
--
-- No studio_id — this is platform-owned, read by all authenticated users.
-- Only service_role can write (all writes go through server-side code).

-- ── global_specs ──────────────────────────────────────────────────────────────

create table global_specs (
  id           uuid        primary key default gen_random_uuid(),
  -- source_url is the dedup key — UTM-stripped canonical URL
  source_url   text        not null unique,
  name         text        not null,
  brand_name   text,
  -- brand_domain: hostname without www, e.g. "johnlewis.com"
  -- Used for domain-matching when a studio links a finish to a global spec
  brand_domain text,
  description  text,
  image_url    text,
  cost_from    numeric(12,2),
  cost_to      numeric(12,2),
  cost_unit    text,
  -- category_hint: Haiku's category_suggestion — informational only
  -- Studios assign their own category when pinning
  category_hint text,
  scraped_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table global_specs enable row level security;

-- All authenticated users can read (cross-studio sharing is the point)
create policy "Authenticated users can read global specs"
  on global_specs for select
  to authenticated
  using (true);

-- Only service_role can write — all inserts go through server-side code
-- that has access to SUPABASE_SERVICE_ROLE_KEY, never from the browser
create policy "Service role can manage global specs"
  on global_specs for all
  to service_role
  using (true)
  with check (true);

create unique index idx_global_specs_source_url on global_specs(source_url);
create index idx_global_specs_brand_domain on global_specs(brand_domain);

-- ── global_spec_fields ────────────────────────────────────────────────────────
-- Freeform key-value pairs per global spec.
-- Raw Haiku extraction — no studio template, so labels are free-text strings.
-- When a studio pins a global spec, these labels are fuzzy-matched against
-- the studio's template fields to populate spec_field_values.

create table global_spec_fields (
  id             uuid        primary key default gen_random_uuid(),
  global_spec_id uuid        not null references global_specs(id) on delete cascade,
  label          text        not null,   -- e.g. "Martindale", "Width", "Composition"
  value          text        not null,
  sort_order     integer     not null default 0,
  unique(global_spec_id, label)          -- one value per label per spec
);

alter table global_spec_fields enable row level security;

create policy "Authenticated users can read global spec fields"
  on global_spec_fields for select
  to authenticated
  using (true);

create policy "Service role can manage global spec fields"
  on global_spec_fields for all
  to service_role
  using (true)
  with check (true);

create index idx_global_spec_fields_spec_id on global_spec_fields(global_spec_id);

-- ── global_spec_tags ─────────────────────────────────────────────────────────
-- Same invisible-search-index role as spec_tags, but for the global level.
-- Includes visual tags extracted by Haiku vision and AI-extracted keywords.

create table global_spec_tags (
  global_spec_id uuid not null references global_specs(id) on delete cascade,
  tag            text not null,
  primary key (global_spec_id, tag)
);

alter table global_spec_tags enable row level security;

create policy "Authenticated users can read global spec tags"
  on global_spec_tags for select
  to authenticated
  using (true);

create policy "Service role can manage global spec tags"
  on global_spec_tags for all
  to service_role
  using (true)
  with check (true);
