-- Migration 035: studio_materials — Finishes Library
--
-- Each studio gets its own material reference library (wood, stone, metal,
-- glass, concrete & plaster). Pre-seeded with ~50 standard materials via
-- seed_default_studio_materials(). Studios can add, rename, and delete entries
-- and upload their own image for each material.
--
-- Intentionally separate from studio_finishes (migration 028), which stores
-- drawing finish codes (WD-01, MT-03 etc.) used in the drawings system.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table studio_materials (
  id          uuid        primary key default gen_random_uuid(),
  studio_id   uuid        not null references studios(id) on delete cascade,
  category    text        not null check (category in ('wood','stone','metal','glass','concrete')),
  name        text        not null,
  description text,
  image_url   text,
  image_path  text,       -- storage path for deletion, e.g. "{studio_id}/{material_id}"
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table studio_materials enable row level security;

create index idx_studio_materials_studio_id on studio_materials(studio_id);
create index idx_studio_materials_category  on studio_materials(studio_id, category);

create policy "Studio members can manage their materials"
  on studio_materials for all
  using  (studio_id = any(select auth_user_studio_ids()))
  with check (studio_id = any(select auth_user_studio_ids()));

-- ── Storage bucket ─────────────────────────────────────────────────────────────
-- Public bucket — images must load in the browser without auth tokens.
-- Path structure: {studio_id}/{material_id}

insert into storage.buckets (id, name, public)
values ('material-images', 'material-images', true)
on conflict (id) do nothing;

create policy "Studio members can manage material images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'material-images'
    and (storage.foldername(name))[1] = any (
      select studio_id::text from studio_members where user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'material-images'
    and (storage.foldername(name))[1] = any (
      select studio_id::text from studio_members where user_id = auth.uid()
    )
  );

create policy "Public can view material images"
  on storage.objects for select
  using (bucket_id = 'material-images');

-- ── Seed function ──────────────────────────────────────────────────────────────
-- Called once per new studio (same pattern as seed_default_spec_categories).
-- image_url starts null — studios populate via the UI or the seed-material-images script.

create or replace function seed_default_studio_materials(p_studio_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into studio_materials (studio_id, category, name, description, sort_order) values

  -- ── Wood ──────────────────────────────────────────────────────────────────
  (p_studio_id, 'wood', 'White Oak',
    'A light, fine-grained hardwood with pale cream tones. Versatile and widely used in joinery, flooring, and furniture.',
    1),
  (p_studio_id, 'wood', 'Natural Oak',
    'Mid-toned European oak with characteristic grain. The most common hardwood in residential interiors.',
    2),
  (p_studio_id, 'wood', 'Limed Oak',
    'Oak treated with a liming process to emphasise the grain and lighten the tone. Creates a bleached, coastal aesthetic.',
    3),
  (p_studio_id, 'wood', 'Smoked Oak',
    'Kiln-smoked oak with deep brown-grey tones throughout the timber. Rich, dramatic alternative to standard oak.',
    4),
  (p_studio_id, 'wood', 'Walnut',
    'Dark, rich hardwood with chocolate-brown tones and fine, even grain. Premium furniture and joinery material.',
    5),
  (p_studio_id, 'wood', 'Ash',
    'Light-coloured hardwood with a prominent, open grain. Similar to oak but with a slightly cooler, greyer tone.',
    6),
  (p_studio_id, 'wood', 'Birch',
    'Pale, close-grained hardwood with a subtle, uniform appearance. Often used for plywood and painted joinery.',
    7),
  (p_studio_id, 'wood', 'Pine',
    'Warm, knotty softwood with creamy tones. Traditional and cost-effective for flooring, cladding, and furniture.',
    8),
  (p_studio_id, 'wood', 'Iroko',
    'African hardwood with interlocked grain and warm brown-yellow tones. Used externally and for hardwearing interiors.',
    9),
  (p_studio_id, 'wood', 'Accoya',
    'Modified radiata pine with exceptional durability and stability. Ideal for windows, doors, and external cladding.',
    10),
  (p_studio_id, 'wood', 'Cherry',
    'Fine-grained hardwood that deepens to a rich reddish-brown with age. Traditional joinery and cabinet-making.',
    11),
  (p_studio_id, 'wood', 'Cedar',
    'Aromatic, lightweight softwood with warm reddish-brown tones. Naturally resistant to moisture and insects.',
    12),

  -- ── Stone & Marble ────────────────────────────────────────────────────────
  (p_studio_id, 'stone', 'Carrara Marble',
    'Classic Italian white marble with soft grey veining. The benchmark white marble for worktops, floors, and bathrooms.',
    1),
  (p_studio_id, 'stone', 'Calacatta Marble',
    'Premium Italian white marble with bold, dramatic grey and gold veining. More distinctive and rarer than Carrara.',
    2),
  (p_studio_id, 'stone', 'Calacatta Gold',
    'White marble with warm gold and amber veining. High-impact luxury stone for statement surfaces.',
    3),
  (p_studio_id, 'stone', 'Nero Marquina',
    'Deep black Spanish marble with fine white veining. Dramatic contrast material for floors, walls, and detailing.',
    4),
  (p_studio_id, 'stone', 'Classic Travertine',
    'Warm ivory-cream sedimentary stone with natural voids and linear texture. Widely used in bathrooms and flooring.',
    5),
  (p_studio_id, 'stone', 'Silver Travertine',
    'Cooler-toned travertine with silver-grey colouring. A refined alternative to classic warm travertine.',
    6),
  (p_studio_id, 'stone', 'Slate Grey',
    'Finely cleaved metamorphic stone with grey tones and a naturally riven surface. Robust flooring and wall cladding.',
    7),
  (p_studio_id, 'stone', 'Black Slate',
    'Deep charcoal-black slate with a layered, textural surface. Striking kitchen and bathroom material.',
    8),
  (p_studio_id, 'stone', 'Portland Limestone',
    'British oolitic limestone with a cool, cream-grey tone. Quintessential English material for floors and worktops.',
    9),
  (p_studio_id, 'stone', 'Jerusalem Limestone',
    'Warm, honey-cream limestone with fossil inclusions. Popular for flooring and wall cladding in warm-toned schemes.',
    10),
  (p_studio_id, 'stone', 'Granite Black',
    'Polished black granite with a mirror-like finish. Dense, hardwearing material for kitchen worktops and floors.',
    11),
  (p_studio_id, 'stone', 'Granite White',
    'Light-grey granite with a crystalline speckle. Durable stone for worktops, floors, and external paving.',
    12),
  (p_studio_id, 'stone', 'Honey Onyx',
    'Translucent golden-amber onyx with fine banding. Luxury backlit wall panels and feature surfaces.',
    13),

  -- ── Metal ─────────────────────────────────────────────────────────────────
  (p_studio_id, 'metal', 'Brushed Stainless Steel',
    'Satin-finished stainless with a linear grain. The standard kitchen and commercial interior metal.',
    1),
  (p_studio_id, 'metal', 'Polished Stainless Steel',
    'Mirror-polished stainless steel. High-sheen surface for appliances, trims, and feature elements.',
    2),
  (p_studio_id, 'metal', 'Satin Brass',
    'Warm gold-toned brass with a matte brushed finish. Contemporary alternative to polished brass fittings.',
    3),
  (p_studio_id, 'metal', 'Polished Brass',
    'Traditional bright-gold brass finish. Formal, classical detailing for ironmongery and light fittings.',
    4),
  (p_studio_id, 'metal', 'Antique Brass',
    'Aged, darkened brass with warm brown-gold tones. Heritage aesthetic for door furniture and fixtures.',
    5),
  (p_studio_id, 'metal', 'Bronze',
    'Dark, warm brown alloy with depth of tone. Traditional material for architectural ironmongery and fittings.',
    6),
  (p_studio_id, 'metal', 'Brushed Nickel',
    'Cool silver-toned nickel with a subtle brushed finish. A contemporary alternative to chrome.',
    7),
  (p_studio_id, 'metal', 'Polished Chrome',
    'Bright, reflective chrome finish. Conventional bathroom and kitchen fitting standard.',
    8),
  (p_studio_id, 'metal', 'Copper',
    'Warm red-orange metal that develops a verdigris patina over time. A distinctive feature material.',
    9),
  (p_studio_id, 'metal', 'Raw Steel',
    'Untreated mild steel with natural oxidation tones. Industrial aesthetic for structural features.',
    10),
  (p_studio_id, 'metal', 'Powder-coated Black',
    'Textured or smooth matte black coating on steel. Hard-wearing finish for frames, steelwork, and joinery.',
    11),
  (p_studio_id, 'metal', 'Powder-coated White',
    'Clean white powder-coat on steel. Fresh, contemporary finish for steelwork and architectural metalwork.',
    12),

  -- ── Glass ─────────────────────────────────────────────────────────────────
  (p_studio_id, 'glass', 'Clear Float Glass',
    'Standard clear glass. The baseline for windows, screens, balustrades, and glazed joinery.',
    1),
  (p_studio_id, 'glass', 'Frosted Glass',
    'Opaque white glass created by acid-etching or sandblasting. Standard privacy glazing for bathrooms and internal screens.',
    2),
  (p_studio_id, 'glass', 'Acid-etched Glass',
    'Fine-grained matte surface created by chemical treatment. More refined and consistent than sandblasted frosting.',
    3),
  (p_studio_id, 'glass', 'Bronze Tinted Glass',
    'Warm brown-tinted glass for solar control and privacy glazing with a warm aesthetic.',
    4),
  (p_studio_id, 'glass', 'Smoked Glass',
    'Dark grey-tinted glass with a moody, reflective quality. Feature screens, cabinet doors, and mirrors.',
    5),
  (p_studio_id, 'glass', 'Mirror',
    'Standard silver-backed mirror. Essential bathroom and dressing room finish.',
    6),
  (p_studio_id, 'glass', 'Fluted Glass',
    'Vertically ribbed glass with a refractive, decorative quality. Fashionable cabinet door and screen material.',
    7),

  -- ── Concrete & Plaster ────────────────────────────────────────────────────
  (p_studio_id, 'concrete', 'Polished Concrete',
    'Ground and polished in-situ concrete with a smooth, reflective surface. Industrial-luxury flooring.',
    1),
  (p_studio_id, 'concrete', 'Raw Concrete',
    'Untreated, textural concrete surface. Industrial aesthetic for walls, floors, and feature elements.',
    2),
  (p_studio_id, 'concrete', 'Warm Grey Microcement',
    'Ultra-thin cement coating in warm grey tones. Seamless wet room floors and walls.',
    3),
  (p_studio_id, 'concrete', 'Cool Grey Microcement',
    'Microcement with cool blue-grey tones. Clinical, Scandinavian aesthetic for bathrooms and kitchens.',
    4),
  (p_studio_id, 'concrete', 'Venetian Plaster',
    'Polished lime plaster with depth and translucency. Traditional Italian wall finish with a marble-like sheen.',
    5),
  (p_studio_id, 'concrete', 'Lime Plaster',
    'Traditional breathable plaster with a soft, slightly textural surface. Warm, natural wall finish.',
    6),
  (p_studio_id, 'concrete', 'Microtopping',
    'Thin-set cement finish applied over existing surfaces. Seamless, durable alternative to tiles.',
    7);
end;
$$;
