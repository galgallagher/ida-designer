/**
 * seed-material-images.ts
 *
 * Fetches material texture thumbnails from Poly Haven (polyhaven.com — CC0)
 * and for materials Poly Haven doesn't cover well (warm metals, glass) falls
 * back to Unsplash source search URLs. All images are downloaded and uploaded
 * to Supabase Storage so there's no runtime dependency on external CDNs.
 *
 * Run with:  npx tsx scripts/seed-material-images.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Safe to re-run — skips rows that already have an image_url.
 */

import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// ── Poly Haven category mapping ───────────────────────────────────────────────
// "stone" maps to "rock" — that's the actual Poly Haven category name.

const CATEGORY_MAP: Record<string, string> = {
  wood:     "wood",
  stone:    "rock",
  metal:    "metal",
  concrete: "concrete",
  glass:    "",    // no glass in Poly Haven — use UNSPLASH_FALLBACKS
};

// ── Verified Poly Haven slugs per material ────────────────────────────────────
// Confirmed against the live catalogue (April 2026).

const SLUG_OVERRIDES: Record<string, string> = {
  // ── Wood ──────────────────────────────────────────────────────────────────
  "White Oak":                "oak_veneer_01",
  "Natural Oak":              "oak_veneer_01",
  "Limed Oak":                "plank_flooring_04",
  "Smoked Oak":               "dark_wood",
  "Walnut":                   "wood_table_001",
  "Ash":                      "fine_grained_wood",
  "Birch":                    "plywood",
  "Pine":                     "stained_pine",
  "Iroko":                    "dark_planks",
  "Accoya":                   "plank_flooring",
  "Cherry":                   "rosewood_veneer1",
  "Cedar":                    "brown_planks_05",
  // ── Stone & Marble ────────────────────────────────────────────────────────
  "Carrara Marble":           "marble_cliff_01",
  "Calacatta Marble":         "marble_cliff_01",
  "Calacatta Gold":           "marble_cliff_01",
  "Nero Marquina":            "castle_wall_slates",
  "Classic Travertine":       "monastery_stone_floor",
  "Silver Travertine":        "slab_tiles",
  "Slate Grey":               "slate_floor_02",
  "Black Slate":              "castle_wall_slates",
  "Portland Limestone":       "stone_tiles_02",
  "Jerusalem Limestone":      "stone_floor",
  "Granite Black":            "rock_tile_floor",
  "Granite White":            "granite_tile_03",
  "Honey Onyx":               "marble_cliff_01",
  // ── Metal — Poly Haven covers plate/grate well, not warm finishes ─────────
  "Brushed Stainless Steel":  "metal_plate_02",
  "Polished Stainless Steel": "metal_plate",
  "Bronze":                   "rust_coarse_01",
  "Polished Chrome":          "metal_plate",
  "Raw Steel":                "metal_grate_rusty",
  "Powder-coated Black":      "black_painted_planks",
  "Powder-coated White":      "painted_concrete_02",
  // ── Concrete & Plaster ────────────────────────────────────────────────────
  "Polished Concrete":        "smooth_concrete_floor",
  "Raw Concrete":             "concrete_wall_008",
  "Warm Grey Microcement":    "concrete_floor_02",
  "Cool Grey Microcement":    "brushed_concrete_2",
  "Venetian Plaster":         "plastered_wall_02",
  "Lime Plaster":             "white_plaster_rough_01",
  "Microtopping":             "smooth_concrete_floor",
};

// ── Unsplash fallbacks — warm metals + all glass ──────────────────────────────
// source.unsplash.com resolves to a real image at download time; that image is
// then uploaded to Supabase Storage so no external URL dependency at runtime.

const UNSPLASH_FALLBACKS: Record<string, string> = {
  "Satin Brass":         "https://source.unsplash.com/600x600/?brushed+brass+metal+texture",
  "Polished Brass":      "https://source.unsplash.com/600x600/?polished+brass+metal",
  "Antique Brass":       "https://source.unsplash.com/600x600/?antique+brass+aged+metal",
  "Brushed Nickel":      "https://source.unsplash.com/600x600/?brushed+nickel+metal+texture",
  "Copper":              "https://source.unsplash.com/600x600/?copper+metal+texture",
  "Clear Float Glass":   "https://source.unsplash.com/600x600/?clear+glass+texture",
  "Frosted Glass":       "https://source.unsplash.com/600x600/?frosted+glass+texture",
  "Acid-etched Glass":   "https://source.unsplash.com/600x600/?etched+glass+matte",
  "Bronze Tinted Glass": "https://source.unsplash.com/600x600/?bronze+tinted+glass+building",
  "Smoked Glass":        "https://source.unsplash.com/600x600/?smoked+dark+glass",
  "Mirror":              "https://source.unsplash.com/600x600/?mirror+reflective+surface",
  "Fluted Glass":        "https://source.unsplash.com/600x600/?fluted+ribbed+glass+texture",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function downloadBuffer(url: string, maxRedirects = 5): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

type PhAsset  = { name: string; categories: string[] };
type PhAssets = Record<string, PhAsset>;

async function fetchPolyHavenAssets(): Promise<PhAssets> {
  const res = await fetch("https://api.polyhaven.com/assets?type=textures");
  if (!res.ok) throw new Error(`Poly Haven API error: ${res.status}`);
  return res.json();
}

function thumbUrl(slug: string): string {
  return `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png?width=600`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎨  Seeding material images…\n");

  const { data: rows, error } = await supabase
    .from("studio_materials")
    .select("id, name, category, image_url")
    .is("image_url", null);

  if (error) {
    console.error("❌  Failed to fetch studio_materials:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("✅  All materials already have images. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} materials without images.\n`);

  console.log("📡  Fetching Poly Haven catalogue…");
  const phAssets = await fetchPolyHavenAssets();
  console.log(`  ${Object.keys(phAssets).length} textures available.\n`);

  const uniqueNames = [...new Set(rows.map((r) => r.name))];
  const imageCache  = new Map<string, string>(); // name → Supabase public URL

  for (const name of uniqueNames) {
    const category = rows.find((r) => r.name === name)!.category;
    const slug     = SLUG_OVERRIDES[name];
    const fallback = UNSPLASH_FALLBACKS[name];

    // Determine image source
    let sourceUrl: string | null = null;
    let sourceLabel = "";

    if (slug && phAssets[slug]) {
      sourceUrl   = thumbUrl(slug);
      sourceLabel = `Poly Haven "${slug}"`;
    } else if (fallback) {
      sourceUrl   = fallback;
      sourceLabel = "Unsplash fallback";
    } else {
      console.warn(`  ⚠  No source for "${name}" — skipping`);
      continue;
    }

    console.log(`🔍  "${name}" → ${sourceLabel}`);

    let buffer: Buffer;
    try {
      buffer = await downloadBuffer(sourceUrl);
    } catch (err) {
      console.warn(`  ⚠  Download failed:`, (err as Error).message);
      continue;
    }

    const ext         = fallback ? "jpg" : "png";
    const storagePath = `_defaults/${slugify(name)}.${ext}`;
    const contentType = fallback ? "image/jpeg" : "image/png";

    const { error: uploadError } = await supabase.storage
      .from("material-images")
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.warn(`  ⚠  Upload failed:`, uploadError.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from("material-images").getPublicUrl(storagePath);
    imageCache.set(name, urlData.publicUrl);
    console.log(`  ✓  Uploaded → ${storagePath}`);
  }

  console.log("\n💾  Updating database rows…");
  let updated = 0;

  for (const row of rows) {
    const url = imageCache.get(row.name);
    if (!url) continue;

    const ext         = UNSPLASH_FALLBACKS[row.name] ? "jpg" : "png";
    const imagePath   = `_defaults/${slugify(row.name)}.${ext}`;

    const { error: updateError } = await supabase
      .from("studio_materials")
      .update({ image_url: url, image_path: imagePath })
      .eq("id", row.id);

    if (updateError) {
      console.warn(`  ⚠  Failed to update "${row.name}":`, updateError.message);
    } else {
      updated++;
    }
  }

  console.log(`\n✅  Done. Updated ${updated} of ${rows.length} rows.`);
  console.log(`   ${imageCache.size} unique images uploaded to Supabase Storage.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
