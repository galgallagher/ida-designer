/**
 * POST /api/canvas/scrape-and-add
 *
 * Canvas URL paste flow:
 *  1. Scrape the product URL
 *  2. Save to studio library (global → studio)
 *
 * Does NOT add to project_specs — canvas is the "considering" stage.
 * Items only become project specs when assigned to a schedule.
 *
 * Body: { url: string, project_id: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { extractVisualTags } from "@/lib/ida/extract-visual-tags";
import { resolveTemplateId } from "@/lib/ida/resolve-template";
import { matchFieldsToTemplate } from "@/lib/ida/match-fields";
import { downloadAndStoreImage } from "@/lib/ida/download-image";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const studioId = await getCurrentStudioId();
  if (!studioId) return NextResponse.json({ error: "No studio context" }, { status: 400 });

  const body = await req.json() as { url?: string; project_id?: string };
  const { url, project_id } = body;

  if (!url || !project_id) {
    return NextResponse.json({ error: "url and project_id are required" }, { status: 400 });
  }

  // ── Step 1: Scrape the URL ──────────────────────────────────────────────────
  // We call the scrape-spec tool's execute function directly by importing it.
  // However, that function is tightly coupled to the AI SDK tool system.
  // Instead, we'll use a lighter-weight approach: call internal APIs via fetch.

  // Build the internal base URL for API calls
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3001";
  const baseUrl = `${proto}://${host}`;

  // Forward the cookie header so internal calls stay authenticated
  const cookieHeader = req.headers.get("cookie") ?? "";

  // ── 1a. Call scrape via the Ida chat API ────────────────────────────────────
  // We use a simplified approach: call the scrape-spec tool directly.
  // The scrape tool is invoked via the chat completions API with a forced tool call.
  // This is complex, so instead we'll use Firecrawl/Jina directly and Haiku extraction.

  // Actually, the simplest reliable approach: use fetch to call the existing
  // Firecrawl/Jina scrape + Haiku extraction pipeline as a server-side function.
  // Let's import and call the core scraping functions directly.

  let scrapeResult: ScrapeResult;
  try {
    scrapeResult = await scrapeUrl(url, studioId, supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[canvas/scrape-and-add] scrape failed:", message, err);
    return NextResponse.json({ error: `Scrape failed: ${message}` }, { status: 500 });
  }

  if (scrapeResult.already_exists) {
    // Already in the studio library — return spec data for the canvas card.
    const { data: fullSpec } = await supabase
      .from("specs")
      .select("code, category:spec_categories(name)")
      .eq("id", scrapeResult.spec_id ?? "")
      .single();

    const categoryName = Array.isArray(fullSpec?.category)
      ? fullSpec?.category[0]?.name ?? null
      : (fullSpec?.category as { name?: string } | null)?.name ?? null;

    // Add to project options (ignore if already there)
    await addToProjectOptions(supabase, scrapeResult.spec_id!, project_id, studioId);

    return NextResponse.json({
      spec_id: scrapeResult.spec_id,
      name: scrapeResult.spec_name,
      code: fullSpec?.code ?? null,
      category_name: categoryName,
      image_url: scrapeResult.image_url ?? null,
      source_url: url,
      already_existed: true,
    });
  }

  // ── Step 2: Save to library ─────────────────────────────────────────────────
  const saveRes = await fetch(`${baseUrl}/api/ida/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({
      name: scrapeResult.name,
      code: scrapeResult.code ?? null,
      description: scrapeResult.description ?? null,
      category_id: scrapeResult.category_id ?? null,
      image_url: scrapeResult.image_url ?? null,
      cost_from: scrapeResult.cost_from ?? null,
      cost_to: scrapeResult.cost_to ?? null,
      cost_unit: scrapeResult.cost_unit ?? null,
      tags: scrapeResult.tags ?? [],
      source_url: url,
      field_values: scrapeResult.field_values ?? [],
      supplier_id: scrapeResult.supplier_id ?? null,
      global_spec_id: scrapeResult.global_spec_id ?? null,
      from_global: scrapeResult.from_global ?? false,
      brand_domain: scrapeResult.brand_domain ?? null,
      variant_group_id: scrapeResult.variant_group_id ?? null,
    }),
  });

  if (!saveRes.ok) {
    const err = await saveRes.json();
    return NextResponse.json({ error: err.error ?? "Failed to save spec" }, { status: 500 });
  }

  const saved = await saveRes.json() as { id: string; name: string };

  // Add to project options (ignore if already there)
  await addToProjectOptions(supabase, saved.id, project_id, studioId);

  // Resolve category name for the canvas card display.
  let categoryName: string | null = null;
  if (scrapeResult.category_id) {
    const { data: cat } = await supabase
      .from("spec_categories")
      .select("name")
      .eq("id", scrapeResult.category_id)
      .maybeSingle();
    categoryName = cat?.name ?? null;
  }

  return NextResponse.json({
    spec_id: saved.id,
    name: saved.name,
    brand: scrapeResult.brand ?? null,
    code: scrapeResult.code ?? null,
    category_name: categoryName,
    image_url: scrapeResult.image_url ?? null,
    cost_from: scrapeResult.cost_from ?? null,
    cost_to: scrapeResult.cost_to ?? null,
    cost_unit: scrapeResult.cost_unit ?? null,
    source_url: url,
    already_existed: false,
  });
}

// ── Add to project options ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addToProjectOptions(supabase: any, specId: string, projectId: string, studioId: string) {
  await supabase.from("project_options").insert({
    project_id: projectId,
    studio_id: studioId,
    spec_id: specId,
    status: "draft",
  });
  // Ignore errors — unique constraint means it's already in the project, which is fine.
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScrapeResult {
  already_exists?: boolean;
  spec_id?: string;
  spec_name?: string;
  from_global?: boolean;
  global_spec_id?: string | null;
  name: string;
  code?: string | null;
  brand?: string | null;
  brand_domain?: string | null;
  description?: string | null;
  image_url?: string | null;
  cost_from?: number | null;
  cost_to?: number | null;
  cost_unit?: string | null;
  category_id?: string | null;
  tags?: string[];
  fields?: { label: string; value: string }[];
  field_values?: { field_id: string; value: string }[];
  supplier_id?: string | null;
  variant_group_id?: string | null;
}

// ── Lightweight scrape function ───────────────────────────────────────────────
// Extracts the core scraping logic without the AI SDK tool wrapper.
// Uses Firecrawl (preferred) or Jina Reader (fallback) + Claude Haiku.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Anthropic = require("@anthropic-ai/sdk");

const UTM_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid",
];

function stripTrackingParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    UTM_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scrapeUrl(rawUrl: string, studioId: string, supabase: any): Promise<ScrapeResult> {
  const cleanUrl = stripTrackingParams(rawUrl);

  // ── Check if already in studio library ────────────────────────────────────
  const { data: existing } = await supabase
    .from("specs")
    .select("id, name, image_url")
    .eq("studio_id", studioId)
    .eq("source_url", cleanUrl)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      already_exists: true,
      spec_id: existing.id,
      spec_name: existing.name,
      image_url: existing.image_url,
      name: existing.name,
    };
  }

  // ── Check global library ──────────────────────────────────────────────────
  const { data: globalSpec } = await supabase
    .from("global_specs")
    .select("id, name, code, brand_name, brand_domain, description, image_url, cost_from, cost_to, cost_unit, category_hint")
    .eq("source_url", cleanUrl)
    .limit(1)
    .maybeSingle();

  if (globalSpec) {
    // Load global fields
    const { data: globalFields } = await supabase
      .from("global_spec_fields")
      .select("label, value")
      .eq("global_spec_id", globalSpec.id);

    return {
      from_global: true,
      global_spec_id: globalSpec.id,
      name: globalSpec.name,
      code: globalSpec.code,
      brand: globalSpec.brand_name,
      brand_domain: globalSpec.brand_domain,
      description: globalSpec.description,
      image_url: globalSpec.image_url,
      cost_from: globalSpec.cost_from,
      cost_to: globalSpec.cost_to,
      cost_unit: globalSpec.cost_unit,
      fields: globalFields ?? [],
    };
  }

  // ── Fetch page content ────────────────────────────────────────────────────
  let markdown = "";
  let rawHtml = "";

  // Try Firecrawl first
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
        body: JSON.stringify({
          url: cleanUrl,
          formats: ["markdown", "rawHtml"],
          onlyMainContent: false,
          waitFor: 2000,
        }),
      });
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        markdown = fcData.data?.markdown ?? "";
        rawHtml = fcData.data?.rawHtml ?? "";
      }
    } catch { /* fall through to Jina */ }
  }

  // Fallback: Jina Reader
  if (!markdown) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: { Accept: "text/markdown" },
      });
      if (jinaRes.ok) markdown = await jinaRes.text();
    } catch { /* proceed with whatever we have */ }
  }

  if (!markdown && !rawHtml) {
    throw new Error("Could not fetch page content from any source");
  }

  // ── Extract images from HTML ──────────────────────────────────────────────
  let bestImage: string | null = null;
  if (rawHtml) {
    // Extract og:image first
    const ogMatch = rawHtml.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
      ?? rawHtml.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogMatch) bestImage = ogMatch[1];

    // Fallback: find product images
    if (!bestImage) {
      const imgMatches = Array.from(rawHtml.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi));
      const productImages = imgMatches
        .map((m) => m[1])
        .filter((src) =>
          !src.includes("logo") &&
          !src.includes("icon") &&
          !src.includes("badge") &&
          !src.includes("placeholder") &&
          !src.includes("spinner") &&
          !src.includes("favicon") &&
          (src.includes("product") || src.includes("gallery") || src.includes("main") || src.endsWith(".jpg") || src.endsWith(".webp") || src.endsWith(".png"))
        );
      if (productImages.length > 0) bestImage = productImages[0];
    }
  }

  // ── Re-host the chosen image on Supabase storage ──────────────────────────
  // Supplier CDNs frequently lack permissive CORS headers, which taints the
  // tldraw export canvas and drops the image from the PDF. Re-hosting on
  // Supabase storage (which serves with proper CORS) ensures PDF export works.
  // Falls back to the original URL if the rehost fails — never blocks scrape.
  if (bestImage) {
    const rehosted = await downloadAndStoreImage(bestImage, studioId, supabase);
    if (rehosted) bestImage = rehosted;
  }

  // ── Claude Haiku extraction ───────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const content = (markdown + "\n\n" + rawHtml.slice(0, 10000)).slice(0, 30000);

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract product information from this page content. Return ONLY valid JSON with these fields:
{
  "name": "product name (required)",
  "code": "product/reference code or SKU if visible, else null",
  "brand": "brand name if visible, else null",
  "description": "1-2 sentence description, else null",
  "cost_from": number or null,
  "cost_to": number or null (for price ranges),
  "cost_unit": "per m²", "per unit", etc or null,
  "tags": ["material", "colour", "style keywords"],
  "category_suggestion": "best category: Fabrics, Wallcoverings, Furniture, Lighting, Rugs, Accessories, Paint, Tiles, or Other"
}

Be conservative — only extract what is clearly stated. Do not infer or guess.

Page content:
${content}`,
      },
    ],
  });

  let extracted = {
    name: "Unknown Product",
    code: null as string | null,
    brand: null as string | null,
    description: null as string | null,
    cost_from: null as number | null,
    cost_to: null as number | null,
    cost_unit: null as string | null,
    tags: [] as string[],
    category_suggestion: "Other",
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = msg.content.find((b: any) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = { ...extracted, ...JSON.parse(jsonMatch[0]) };
      }
    }
  } catch { /* use defaults */ }

  // ── Resolve category ──────────────────────────────────────────────────────
  let categoryId: string | null = null;
  if (extracted.category_suggestion) {
    const { data: categories } = await supabase
      .from("spec_categories")
      .select("id, name")
      .eq("studio_id", studioId)
      .is("parent_id", null);

    const match = (categories ?? []).find(
      (c: { name: string }) => c.name.toLowerCase() === extracted.category_suggestion.toLowerCase()
    );
    if (match) categoryId = match.id;
  }

  // ── Write to global library ───────────────────────────────────────────────
  let globalSpecId: string | null = null;
  try {
    const domain = new URL(cleanUrl).hostname.replace(/^www\./, "");
    const { data: gs } = await supabase
      .from("global_specs")
      .upsert(
        {
          source_url: cleanUrl,
          name: extracted.name,
          code: extracted.code,
          brand_name: extracted.brand,
          brand_domain: domain,
          description: extracted.description,
          image_url: bestImage,
          cost_from: extracted.cost_from,
          cost_to: extracted.cost_to,
          cost_unit: extracted.cost_unit,
          category_hint: extracted.category_suggestion,
        },
        { onConflict: "source_url", ignoreDuplicates: true }
      )
      .select("id")
      .single();
    globalSpecId = gs?.id ?? null;
  } catch { /* non-critical */ }

  return {
    name: extracted.name,
    code: extracted.code,
    brand: extracted.brand,
    description: extracted.description,
    image_url: bestImage,
    cost_from: extracted.cost_from,
    cost_to: extracted.cost_to,
    cost_unit: extracted.cost_unit,
    category_id: categoryId,
    tags: extracted.tags,
    global_spec_id: globalSpecId,
  };
}
