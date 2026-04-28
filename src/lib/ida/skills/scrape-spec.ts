/**
 * scrapeSpec skill
 *
 * Fetches a product URL via Firecrawl (preferred) or Jina Reader (fallback),
 * extracts candidate images from raw HTML (not Markdown) for best fidelity,
 * then uses Claude Haiku to extract structured spec data.
 *
 * Also:
 * - Fetches the studio's template fields as extraction hints
 * - Matches extracted fields to template field IDs for direct saving
 * - Matches brand name against contact_companies for supplier linking
 */

import { tool, jsonSchema } from "ai";

// ── URL utilities ──────────────────────────────────────────────────────────

const UTM_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid",
];

/** Strip tracking/UTM query params from a URL, return the clean version. */
function stripTrackingParams(url: string): string {
  try {
    const u = new URL(url);
    UTM_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

// ── Skip patterns for image filtering ─────────────────────────────────────

const IMAGE_SKIP_PATTERNS = [
  /placeholder/i, /loading/i, /spinner/i,
  /icon/i, /logo/i, /svg/i,
  /1x1/i, /blank/i,
  /badge/i, /avatar/i, /favicon/i,
  /banner/i, /hero-bg/i, /background/i, /sprite/i,
  /\.gif$/i,
  /tracking/i, /pixel/i, /analytics/i,
  /spacer/i,
];

const PREFER_PATTERNS = [
  /product/i, /item/i, /gallery/i, /image/i, /photo/i,
  /main/i, /primary/i, /hero/i, /feature/i,
];

function scoreImage(url: string, alt: string): number {
  if (IMAGE_SKIP_PATTERNS.some((p) => p.test(url) || p.test(alt))) return -1;
  let score = 0;
  if (PREFER_PATTERNS.some((p) => p.test(url) || p.test(alt))) score += 2;
  if (/large|full|xl|2000|1600|1200|original/i.test(url)) score += 2;
  if (/small|thumb|thumbnail|50x|100x|150x/i.test(url)) score -= 2;
  if (/\.(jpg|jpeg|png|webp)/i.test(url)) score += 1;
  return score;
}

/** Resolve a potentially relative URL against a base page URL */
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Parse srcset string and return the URL for the highest-resolution entry.
 * Handles both width descriptors (800w) and pixel density descriptors (2x).
 */
function highestResSrcset(srcset: string, baseUrl: string): string | null {
  const entries = srcset
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] ?? "1x";
      const value = parseFloat(descriptor.replace(/[wx]/i, "")) || 1;
      return { url, value };
    });

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.value - a.value);
  return resolveUrl(entries[0].url, baseUrl);
}

/**
 * Extract candidate product images from raw HTML.
 * Checks data-* zoom/high-res attributes before falling back to src.
 * Resolves relative URLs. Filters junk images. Deduplicates.
 */
function extractCandidateImagesFromHtml(
  html: string,
  baseUrl: string
): { url: string; alt: string }[] {
  const candidates: { url: string; alt: string; score: number }[] = [];
  const seen = new Set<string>();

  // 1. Open Graph image — always most reliable for the primary product shot
  for (const [, ogUrl] of html.matchAll(
    /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi
  )) {
    const resolved = resolveUrl(ogUrl.trim(), baseUrl);
    if (resolved) candidates.push({ url: resolved, alt: "og:image", score: 10 });
  }
  // Also catch reversed attribute order
  for (const [, ogUrl] of html.matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/gi
  )) {
    const resolved = resolveUrl(ogUrl.trim(), baseUrl);
    if (resolved) candidates.push({ url: resolved, alt: "og:image", score: 10 });
  }

  // 2. All <img> tags — check high-res data attributes in priority order
  for (const [imgTag] of html.matchAll(/<img[^>]+>/gi)) {
    const getAttr = (name: string): string | null => {
      const m = imgTag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
      return m ? m[1].trim() : null;
    };

    const alt = getAttr("alt") ?? "";

    // Priority order for URL resolution
    const rawUrl =
      getAttr("data-zoom-image") ??
      getAttr("data-full-size") ??
      getAttr("data-large") ??
      getAttr("data-src") ??
      getAttr("data-lazy-src") ??
      // srcset: pick highest resolution entry
      (() => {
        const srcset = getAttr("srcset");
        return srcset ? highestResSrcset(srcset, baseUrl) : null;
      })() ??
      getAttr("src");

    if (!rawUrl) continue;

    // Skip data URIs
    if (rawUrl.startsWith("data:")) continue;

    const resolved = resolveUrl(rawUrl, baseUrl);
    if (!resolved) continue;

    const score = scoreImage(resolved, alt);
    if (score < 0) continue;

    candidates.push({ url: resolved, alt, score });
  }

  // Deduplicate by URL (ignoring query strings)
  const deduped = candidates.filter(({ url }) => {
    const key = url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ url, alt }) => ({ url, alt }));
}

/**
 * Fallback image extractor from Markdown (used when no raw HTML is available).
 */
function extractCandidateImagesFromMarkdown(
  markdown: string
): { url: string; alt: string }[] {
  const ogImages = [...markdown.matchAll(/og:image.*?(https?:\/\/[^\s"'<>)]+)/gi)].map(
    ([, url]) => ({ url: url.trim(), alt: "og:image", score: 10 })
  );

  const mdImages = [
    ...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g),
  ].map(([, alt, url]) => ({ url, alt: alt ?? "", score: scoreImage(url, alt ?? "") }));

  const htmlImages = [
    ...markdown.matchAll(
      /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi
    ),
  ].map(([, url, alt]) => ({ url, alt: alt ?? "", score: scoreImage(url, alt ?? "") }));

  const all = [...ogImages, ...mdImages, ...htmlImages];
  const seen = new Set<string>();
  return all
    .filter(({ url, score }) => {
      if (score < 0) return false;
      const key = url.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ url, alt }) => ({ url, alt }));
}

// ── Structured extraction via Haiku ───────────────────────────────────────

interface ExtractedSpec {
  name: string;
  code: string | null;
  colorway: string | null;
  brand: string | null;
  description: string | null;
  collection: string | null;
  category_suggestion: string;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  tags: string[];
  fields: { label: string; value: string }[];
}

async function extractWithHaiku(
  pageContent: string,
  url: string,
  categoryNames: string[],
  fieldHints: string[],
  supplierNames: string[]
): Promise<ExtractedSpec> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic.default();

  const categoryList = categoryNames.length > 0 ? categoryNames.join(", ") : "none";

  const fieldsList =
    fieldHints.length > 0
      ? fieldHints.map((f) => `- ${f}`).join("\n")
      : "- dimensions\n- material\n- finish\n- colour\n- weight\n- fire rating\n- lead time\n- country of origin";

  const supplierHint =
    supplierNames.length > 0
      ? `\nKnown suppliers/brands in this studio: ${supplierNames.join(", ")} — if the product brand matches one of these (case-insensitive), use the exact spelling from this list.`
      : "";

  const systemPrompt = `You are extracting product data for an interior design procurement platform. Be conservative — if a field is ambiguous or absent, return null. Never infer or fabricate values.`;

  const userPrompt = `Extract structured product information from the supplier page content below. Return ONLY valid JSON — no prose, no markdown fences.

URL: ${url}

Available spec categories in this studio: ${categoryList}
${supplierHint}

Required JSON shape:
{
  "name": "product name",
  "code": "product reference code, SKU, article number, or style code (e.g. '8086/02', 'HAL-65-0123') — extract exactly as shown including slashes and hyphens, or null if not visible",
  "brand": "brand/manufacturer name or null",
  "description": "1-2 sentence description, or null",
  "collection": "collection name if part of one, or null",
  "colorway": "colour or finish variant name if this is one specific colourway/finish of a multi-variant product (e.g. 'Clay', 'Navy', 'Natural', 'Ivory', 'Brass'). Return null if the product has no colour variants or if this is the only colour offered.",
  "category_suggestion": "best matching category from the list above, or suggest a new one if none fit",
  "cost_from": number or null,
  "cost_to": number or null,
  "cost_unit": "per m², per unit, per linear m, etc. or null",
  "tags": ["array", "of", "relevant", "tags"],
  "fields": [{ "label": "field name", "value": "field value" }]
}

--- FIELD EXTRACTION RULES ---

Extract values for THESE specific fields. Use the EXACT label name shown:
${fieldsList}

General rules:
- Match loosely: "Width (cm)", "Width:", "Fabric Width" → use label "Width"
- Combine multi-line values into one string (e.g. pattern repeat H + V)
- Only include a field if its value is clearly stated on the page — if unsure, omit it
- Search the ENTIRE page including tabs, accordions, and technical spec sections

Field-specific rules:
- Martindale / Rub count: may appear as "Rub count: 30,000", "30k Martindale", or in a spec table under "Abrasion". Extract the number only (e.g. "30000").
- Width: may appear in cm or inches (e.g. "140cm", "54\"", "54 inches"). ALWAYS convert to cm (1 inch = 2.54 cm). Store the result in cm and note the original unit in parentheses if it was inches — e.g. "137cm (54\")".
- Composition / Content: may appear as "100% Polyester", "65% Wool 35% Nylon", or in a fibre breakdown table. Concatenate into one string.
- Fire rating / Flame retardancy: look for "BS 5867", "Crib 5", "IMO", "EN 13501", or similar standards.
- Lead time: may appear as "In stock", "4–6 weeks", "Made to order". Extract as-is.
- Country of origin: may appear as "Made in Italy", "Origin: Belgium", or in a spec table.

--- COST EXTRACTION RULES ---

- Extract price as a number only (no currency symbols).
- If you see a crossed-out original price next to a sale/current price, return the CURRENT (lower) selling price, not the original.
- Single price = cost_from only (leave cost_to null).
- Price range = cost_from (lower) and cost_to (upper).
- If price is clearly per unit, per metre, per m², capture that in cost_unit.

Page content:
${pageContent.slice(0, 25000)}`;

  let rawText = "";
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    rawText = response.content[0].type === "text" ? response.content[0].text : "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Haiku API call failed: ${message}`);
  }

  // Strip markdown fences if present
  const jsonMatch =
    rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawText.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

  try {
    const parsed = JSON.parse(jsonStr.trim()) as ExtractedSpec;
    return parsed;
  } catch (parseErr) {
    // Log the raw content to help diagnose prompt/model issues
    console.error(
      "[scrape-spec] JSON parse failed. Raw Haiku response:\n",
      rawText.slice(0, 2000)
    );
    throw new Error(
      `Extraction failed: Claude returned a response that could not be parsed as JSON. ` +
        `Parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
    );
  }
}

// ── Tool definition ────────────────────────────────────────────────────────

export const scrapeSpecTool = (categoryNames: string[]) =>
  tool({
    description:
      "Fetch a product URL and extract structured spec information including name, description, cost, category, and candidate product images. Call this whenever the user provides a URL that looks like a product page.",
    parameters: jsonSchema<{ url: string }>({
      type: "object",
      properties: {
        url: { type: "string", description: "The product page URL to scrape" },
      },
      required: ["url"],
    }),
    execute: async ({ url }: { url: string }) => {
      // Top-level try/catch so any unexpected throw (Haiku timeout, JSON
      // parse, Supabase blip, etc.) becomes a graceful { error } return
      // instead of bubbling up to the AI SDK and surfacing as the generic
      // "An error occurred" red chip in the Ida widget. All the existing
      // inline `return { error: "..." }` paths still work — they short-
      // circuit normally without touching this handler.
      try {
      // Strip tracking params once — use the clean URL throughout
      const cleanUrl = stripTrackingParams(url);

      // ── Step 1: Check global library first (cross-studio dedup) ─────────
      // If ANY studio has ever scraped this URL, the data lives in global_specs.
      // We can skip the network scrape entirely and return the cached data.
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const studioId = await getCurrentStudioId();

        if (studioId) {
          // 1a. Has any studio scraped this URL before?
          const { data: globalSpec } = await supabase
            .from("global_specs")
            .select("id, name, code, brand_name, brand_domain, description, image_url, cost_from, cost_to, cost_unit, category_hint")
            .eq("source_url", cleanUrl)
            .limit(1)
            .single();

          if (globalSpec) {
            // 1b. Has THIS studio already pinned it?
            const { data: studioSpec } = await supabase
              .from("specs")
              .select("id, name")
              .eq("studio_id", studioId)
              .eq("global_spec_id", globalSpec.id)
              .limit(1)
              .single();

            if (studioSpec) {
              return { already_exists: true, spec_id: studioSpec.id, spec_name: studioSpec.name, spec_url: `/specs` };
            }

            // 1c. New to this studio — load global fields and return for pinning.
            // No network scrape needed.
            const [{ data: globalFields }, variantSiblingResult] = await Promise.all([
              supabase
                .from("global_spec_fields")
                .select("label, value, sort_order")
                .eq("global_spec_id", globalSpec.id)
                .order("sort_order"),
              // Check for a colorway sibling already in this studio
              (() => {
                const lastSlash = cleanUrl.lastIndexOf('/');
                if (lastSlash > 10) {
                  const baseUrl = cleanUrl.substring(0, lastSlash);
                  return supabase
                    .from("specs")
                    .select("id, variant_group_id")
                    .eq("studio_id", studioId)
                    .like("source_url", `${baseUrl}/%`)
                    .neq("source_url", cleanUrl)
                    .limit(1)
                    .maybeSingle();
                }
                return Promise.resolve({ data: null });
              })(),
            ]);

            let fromGlobalVariantGroupId: string | null = null;
            const variantSibling = variantSiblingResult.data;
            if (variantSibling) {
              fromGlobalVariantGroupId = variantSibling.variant_group_id ?? crypto.randomUUID();
              if (!variantSibling.variant_group_id) {
                await supabase
                  .from("specs")
                  .update({ variant_group_id: fromGlobalVariantGroupId })
                  .eq("id", variantSibling.id);
              }
            }

            return {
              from_global: true as const,
              global_spec_id: globalSpec.id,
              name: globalSpec.name,
              code: globalSpec.code ?? null,
              brand: globalSpec.brand_name,
              description: globalSpec.description,
              image_url: globalSpec.image_url,
              cost_from: globalSpec.cost_from,
              cost_to: globalSpec.cost_to,
              cost_unit: globalSpec.cost_unit,
              category_hint: globalSpec.category_hint,
              fields: (globalFields ?? []).map((f) => ({ label: f.label, value: f.value })),
              source_url: cleanUrl,
              brand_domain: globalSpec.brand_domain,
              variant_group_id: fromGlobalVariantGroupId,
            };
          }

          // ── Step 2: Not in global library — check studio-specific dedup ──
          // Belt-and-braces: catches any race window or pre-026 migration specs
          const { data: specByUrl } = await supabase
            .from("specs")
            .select("id, name")
            .eq("studio_id", studioId)
            .eq("source_url", cleanUrl)
            .limit(1)
            .single();

          if (specByUrl) {
            return { already_exists: true, spec_id: specByUrl.id, spec_name: specByUrl.name, spec_url: `/specs` };
          }

          // Fallback: legacy source: tag (pre-024 migration specs)
          const { data: tagRow } = await supabase
            .from("spec_tags")
            .select("spec_id")
            .eq("tag", `source:${cleanUrl}`)
            .limit(1)
            .single();

          if (tagRow?.spec_id) {
            const { data: specRow } = await supabase
              .from("specs")
              .select("id, name")
              .eq("id", tagRow.spec_id)
              .eq("studio_id", studioId)
              .single();

            if (specRow) {
              return { already_exists: true, spec_id: specRow.id, spec_name: specRow.name, spec_url: `/specs` };
            }
          }
        }
      } catch { /* non-critical — proceed with scrape */ }

      // ── Step 3: Variant group detection ────────────────────────────────────
      // If this URL shares a base path with an existing studio spec, they're
      // colorway variants. Assign a shared group UUID so the UI can link them.
      let variantGroupId: string | null = null;
      try {
        const { createClient: _vc } = await import("@/lib/supabase/server");
        const { getCurrentStudioId: _vs } = await import("@/lib/studio-context");
        const _vSb = await _vc();
        const _vSid = await _vs();
        if (_vSid) {
          const lastSlash = cleanUrl.lastIndexOf('/');
          if (lastSlash > 10) {
            const baseUrl = cleanUrl.substring(0, lastSlash);
            const { data: sibling } = await _vSb
              .from("specs")
              .select("id, variant_group_id")
              .eq("studio_id", _vSid)
              .like("source_url", `${baseUrl}/%`)
              .neq("source_url", cleanUrl)
              .limit(1)
              .maybeSingle();
            if (sibling) {
              variantGroupId = sibling.variant_group_id ?? crypto.randomUUID();
              if (!sibling.variant_group_id) {
                await _vSb
                  .from("specs")
                  .update({ variant_group_id: variantGroupId })
                  .eq("id", sibling.id);
              }
            }
          }
        }
      } catch { /* non-critical */ }

      // ── Fetch the page ────────────────────────────────────────────────
      //
      // Strategy A — Firecrawl (preferred when API key is set):
      //   Requests BOTH markdown (for LLM extraction) and html (for image harvesting).
      //   waitFor: 2000 handles JS-rendered pages (tabs, accordions loading late).
      //   onlyMainContent: false captures specs in sidebars and technical sections.
      //   If markdown < 200 chars, treat as a failed scrape and fall through.
      //
      // Strategy B — Jina Reader + raw HTML fetch (fallback):
      //   Jina gives clean markdown for text extraction.
      //   Raw HTML fetch is used separately for image extraction.

      let markdown = "";
      let rawHtml = "";  // used for image extraction

      const firecrawlKey = process.env.FIRECRAWL_API_KEY;

      if (firecrawlKey) {
        // ── Strategy A: Firecrawl ──────────────────────────────────────
        try {
          const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${firecrawlKey}`,
            },
            body: JSON.stringify({
              url,
              formats: ["markdown", "html"],
              onlyMainContent: false,  // include tabs, sidebars, technical sections
              waitFor: 2000,           // allow JS-rendered content to load
              timeout: 30000,
            }),
            signal: AbortSignal.timeout(35000),
          });

          if (fcRes.ok) {
            const fcData = await fcRes.json() as {
              success: boolean;
              data?: { markdown?: string; html?: string; metadata?: { ogImage?: string } };
            };
            const fcMarkdown = fcData.data?.markdown ?? "";
            const fcHtml = fcData.data?.html ?? "";

            // Treat very short markdown as a failed scrape — fall through to Jina
            if (fcMarkdown.length >= 200) {
              markdown = fcMarkdown;
              rawHtml = fcHtml;
            }
          }
        } catch { /* fall through to Jina fallback below */ }
      }

      if (!markdown) {
        // ── Strategy B: Jina + raw HTML in parallel ────────────────────
        const jinaUrl = `https://r.jina.ai/${url}`;

        const [jinaRes, htmlRes] = await Promise.allSettled([
          fetch(jinaUrl, {
            headers: {
              Accept: "text/markdown",
              "X-Return-Format": "markdown",
              "X-Remove-Selector": "nav, footer, header, .cookie-banner, #cookie-notice",
            },
            signal: AbortSignal.timeout(20000),
          }),
          fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "en-GB,en;q=0.9",
            },
            signal: AbortSignal.timeout(15000),
          }),
        ]);

        if (jinaRes.status === "fulfilled" && jinaRes.value.ok) {
          markdown = await jinaRes.value.text();
        }

        if (htmlRes.status === "fulfilled" && htmlRes.value.ok) {
          rawHtml = await htmlRes.value.text();
        }
      }

      // ── Build LLM page content from raw HTML ──────────────────────────
      // For the LLM we strip HTML tags to get clean text, and include JSON-LD.
      // Images are extracted separately from rawHtml below.
      let htmlTextContent = "";
      if (rawHtml) {
        const jsonLdBlocks = [
          ...rawHtml.matchAll(
            /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
          ),
        ]
          .map(([, json]) => json.trim())
          .join("\n");

        const strippedText = rawHtml
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<!--[\s\S]*?-->/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s{2,}/g, " ")
          .trim();

        htmlTextContent = [
          jsonLdBlocks ? `=== Structured data (JSON-LD) ===\n${jsonLdBlocks}` : "",
          `=== Full page text (includes hidden tabs) ===\n${strippedText.slice(0, 12000)}`,
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      if (!markdown && !htmlTextContent) {
        return { error: "Could not fetch that page — it may be blocking automated access." };
      }
      if (markdown.length < 100 && htmlTextContent.length < 100) {
        return {
          error:
            "The page didn't return enough content. It may require a login or be blocking access.",
        };
      }

      // ── Fetch studio context: template fields + contact companies ─────
      type TemplateField = { id: string; template_id: string; name: string; ai_hint: string | null };
      type ContactCompany = { id: string; name: string; website: string | null };
      let templateFieldsList: TemplateField[] = [];
      let contactCompaniesList: ContactCompany[] = [];

      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const sid = await getCurrentStudioId();
        if (sid) {
          const { data: studioTemplates } = await supabase
            .from("spec_templates")
            .select("id")
            .eq("studio_id", sid)
            .eq("is_active", true);

          const templateIds = (studioTemplates ?? []).map((t) => t.id);

          const [fieldsRes, companiesRes] = await Promise.all([
            templateIds.length > 0
              ? supabase
                  .from("spec_template_fields")
                  .select("id, template_id, name, ai_hint")
                  .in("template_id", templateIds)
              : Promise.resolve({ data: [] as TemplateField[] }),
            supabase
              .from("contact_companies")
              .select("id, name, website")
              .eq("studio_id", sid),
          ]);

          templateFieldsList = (fieldsRes.data ?? []) as TemplateField[];
          contactCompaniesList = (companiesRes.data ?? []) as ContactCompany[];
        }
      } catch { /* non-critical */ }

      // ── Extract candidate images from raw HTML ────────────────────────
      // Prefer HTML (has high-res data-* attributes and srcset); fall back to markdown.
      const images = rawHtml
        ? extractCandidateImagesFromHtml(rawHtml, url)
        : extractCandidateImagesFromMarkdown(markdown);

      // ── Extract spec data via Haiku ───────────────────────────────────
      // Combined page content: Markdown first (better prose), then HTML stripped text
      // (better for specs hidden in tabs/accordions).
      const uniqueFieldNames = [...new Set(templateFieldsList.map((f) => f.name))];
      const supplierNames = contactCompaniesList.map((c) => c.name);

      const pageContent = [
        markdown ? `=== Main page content ===\n${markdown.slice(0, 15000)}` : "",
        htmlTextContent,
      ]
        .filter(Boolean)
        .join("\n\n");

      const spec = await extractWithHaiku(
        pageContent,
        url,
        categoryNames,
        uniqueFieldNames,
        supplierNames
      );

      // ── Resolve category_id, field_values, supplier_id server-side ───
      let category_id: string | null = null;
      const field_values: { field_id: string; label: string; value: string }[] = [];
      let supplier_id: string | null = null;

      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const studioId = await getCurrentStudioId();
        if (studioId && spec.category_suggestion) {
          const { data: categories } = await supabase
            .from("spec_categories")
            .select("id, name, template_id, parent_id")
            .eq("studio_id", studioId)
            .eq("is_active", true);

          const catMatch = categories?.find(
            (c) => c.name.toLowerCase() === spec.category_suggestion.toLowerCase()
          );
          category_id = catMatch?.id ?? null;
          // Walk up to parent if sub-category has no template (e.g. Seating → Furniture)
          const template_id =
            catMatch?.template_id ??
            (catMatch?.parent_id
              ? (categories?.find((c) => c.id === catMatch.parent_id)?.template_id ?? null)
              : null);

          if (template_id && spec.fields.length > 0) {
            const catFields = templateFieldsList.filter((f) => f.template_id === template_id);
            for (const extracted of spec.fields) {
              const extLabel = extracted.label.toLowerCase().replace(/[:()\s]+/g, " ").trim();
              const fieldMatch = catFields.find((tf) => {
                const tfLabel = tf.name.toLowerCase().replace(/[:()\s]+/g, " ").trim();
                return (
                  tfLabel === extLabel ||
                  extLabel.startsWith(tfLabel) ||
                  tfLabel.startsWith(extLabel) ||
                  extLabel.includes(tfLabel) ||
                  tfLabel.includes(extLabel)
                );
              });
              if (fieldMatch && extracted.value?.trim()) {
                if (!field_values.some((fv) => fv.field_id === fieldMatch.id)) {
                  field_values.push({
                    field_id: fieldMatch.id,
                    label: fieldMatch.name,
                    value: extracted.value,
                  });
                }
              }
            }
          }

          // ── Supplier resolution: domain match → brand name match → auto-create ──
          //
          // Priority order:
          // 1. Domain match — an existing company whose website matches the URL
          // 2. Brand name match — an existing company whose name matches spec.brand
          // 3. Auto-create — always named from the URL domain (the actual retailer/
          //    supplier), NOT the product brand. "justfabrics.co.uk" → "Just Fabrics",
          //    not "Scion". The brand is who made it; the domain is who sells it.
          let urlDomain: string | null = null;
          try { urlDomain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

          const domainMatch = urlDomain
            ? contactCompaniesList.find((c) => {
                if (!c.website) return false;
                try {
                  const companyDomain = new URL(
                    c.website.startsWith("http") ? c.website : `https://${c.website}`
                  ).hostname.replace(/^www\./, "");
                  return companyDomain === urlDomain;
                } catch { return false; }
              })
            : null;

          if (domainMatch) {
            // 1. Existing company matched by domain — use it
            supplier_id = domainMatch.id;
          } else {
            // 2. Try brand-name match against existing companies (secondary)
            if (spec.brand) {
              const brandMatch = contactCompaniesList.find(
                (c) => c.name.toLowerCase() === spec.brand!.toLowerCase()
              );
              if (brandMatch) {
                supplier_id = brandMatch.id;
              }
            }

            // 3. Still no match — auto-create, naming from URL domain (not brand)
            if (!supplier_id && studioId && (urlDomain || spec.brand)) {
              // Derive a readable name from the domain: "justfabrics.co.uk" → "Justfabrics"
              // Split hyphenated domains: "john-lewis.com" → "John Lewis"
              const companyName = urlDomain
                ? urlDomain
                    .replace(/\.(co\.uk|com\.au|co\.nz|co\.za|com|net|org|io|co|uk|store|shop|online|studio|de|fr|es|it|nl|se|no|dk|be|at|ch|au|nz|ca|ie|sg|hk|jp|br|mx|in|za)$/i, "")
                    .split(/[-_]/)
                    .filter(Boolean)
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(" ")
                : spec.brand!;

              // Look up the studio's "Suppliers" category
              const { data: supplierCat } = await supabase
                .from("contact_categories")
                .select("id")
                .eq("studio_id", studioId)
                .ilike("name", "supplier%")
                .limit(1)
                .maybeSingle();

              const { data: newCompany } = await supabase
                .from("contact_companies")
                .insert({
                  studio_id: studioId,
                  name: companyName,
                  website: urlDomain ? `https://${urlDomain}` : null,
                  category_id: supplierCat?.id ?? null,
                })
                .select("id")
                .single();
              supplier_id = newCompany?.id ?? null;
            }
          }
        }
      } catch { /* non-critical */ }

      // ── Step 3: Write to global_specs after a fresh scrape ───────────
      // Uses service_role client — global_specs requires service_role for writes.
      // Non-blocking: wrapped in try/catch so a failed global write never blocks
      // the studio from saving their spec.
      let globalSpecId: string | null = null;
      try {
        const { createAdminClient } = await import("@/lib/supabase/server-admin");
        const { downloadAndStoreImage } = await import("@/lib/ida/download-image");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const serviceSupabase = createAdminClient();

        let urlDomainForGlobal: string | null = null;
        try { urlDomainForGlobal = new URL(cleanUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

        // Re-host the primary image on Supabase storage so later studios that
        // pin this global_spec inherit a URL from our own CDN (needed for
        // tldraw PDF export). serviceSupabase bypasses RLS; we still write to
        // the scraping studio's folder. Falls back to the original URL on any
        // failure — never blocks the scrape.
        let primaryImage: string | null = images[0]?.url ?? null;
        try {
          const scrapingStudioId = await getCurrentStudioId();
          if (primaryImage && scrapingStudioId) {
            const rehosted = await downloadAndStoreImage(primaryImage, scrapingStudioId, serviceSupabase);
            if (rehosted) primaryImage = rehosted;
          }
        } catch { /* fall back to original supplier URL */ }

        // Assemble display name: "Otillo · Clay" when colorway is detected
        const displayName = spec.colorway ? `${spec.name} · ${spec.colorway}` : spec.name;

        // ignoreDuplicates: true — first scrape wins; don't overwrite existing global data
        const { data: upsertedGlobal } = await serviceSupabase
          .from("global_specs")
          .upsert(
            {
              source_url: cleanUrl,
              name: displayName,
              code: spec.code ?? null,
              brand_name: spec.brand ?? null,
              brand_domain: urlDomainForGlobal,
              description: spec.description ?? null,
              image_url: primaryImage,
              cost_from: spec.cost_from ?? null,
              cost_to: spec.cost_to ?? null,
              cost_unit: spec.cost_unit ?? null,
              category_hint: spec.category_suggestion ?? null,
            },
            { onConflict: "source_url", ignoreDuplicates: true }
          )
          .select("id")
          .single();

        if (upsertedGlobal?.id) {
          globalSpecId = upsertedGlobal.id;

          // Write freeform fields (first scrape wins — DO NOTHING on conflict)
          if (spec.fields.length > 0) {
            await serviceSupabase
              .from("global_spec_fields")
              .upsert(
                spec.fields
                  .filter((f) => f.label?.trim() && f.value?.trim())
                  .map((f, i) => ({
                    global_spec_id: globalSpecId!,
                    label: f.label.trim(),
                    value: f.value.trim(),
                    sort_order: i,
                  })),
                { onConflict: "global_spec_id,label", ignoreDuplicates: true }
              );
          }

          // Write tags (DO NOTHING on conflict)
          if (spec.tags.length > 0) {
            await serviceSupabase
              .from("global_spec_tags")
              .upsert(
                spec.tags.map((tag) => ({ global_spec_id: globalSpecId!, tag })),
                { onConflict: "global_spec_id,tag", ignoreDuplicates: true }
              );
          }
        }
      } catch { /* non-critical — global write failure never blocks studio save */ }

      const displayName = spec.colorway ? `${spec.name} · ${spec.colorway}` : spec.name;
      return { ...spec, name: displayName, category_id, source_url: cleanUrl, images, field_values, supplier_id, global_spec_id: globalSpecId, variant_group_id: variantGroupId };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error("[scrape-spec] Unhandled error for url=%s:", url, message, stack);
        return {
          error: `I ran into a problem scraping that page: ${message}. The site might be blocking automated access, or the content was in an unexpected format.`,
        };
      }
    },
  });
