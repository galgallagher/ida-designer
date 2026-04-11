/**
 * scrapeSpec skill
 *
 * Fetches a product URL via Jina Reader (free, handles JS-rendered pages),
 * extracts candidate images via heuristics (no AI vision cost),
 * then uses Claude Haiku to extract structured spec data.
 *
 * Also:
 * - Fetches the studio's template fields as extraction hints
 * - Matches extracted fields to template field IDs for direct saving
 * - Matches brand name against contact_companies for supplier linking
 */

import { tool, jsonSchema } from "ai";

// ── Image heuristic filter ─────────────────────────────────────────────────

const SKIP_PATTERNS = [
  /logo/i, /icon/i, /badge/i, /avatar/i, /favicon/i,
  /banner/i, /hero-bg/i, /background/i, /sprite/i,
  /\.svg$/i, /\.gif$/i,
  /tracking/i, /pixel/i, /analytics/i,
  /1x1/i, /spacer/i,
];

const PREFER_PATTERNS = [
  /product/i, /item/i, /gallery/i, /image/i, /photo/i,
  /main/i, /primary/i, /hero/i, /feature/i,
];

function scoreImage(url: string, alt: string): number {
  if (SKIP_PATTERNS.some((p) => p.test(url) || p.test(alt))) return -1;
  let score = 0;
  if (PREFER_PATTERNS.some((p) => p.test(url) || p.test(alt))) score += 2;
  if (/large|full|xl|2000|1600|1200|original/i.test(url)) score += 2;
  if (/small|thumb|thumbnail|50x|100x|150x/i.test(url)) score -= 2;
  if (/\.(jpg|jpeg|png|webp)/i.test(url)) score += 1;
  return score;
}

function extractCandidateImages(markdown: string): { url: string; alt: string }[] {
  // 1. Open Graph image — most reliable, always the primary product image
  const ogImages = [...markdown.matchAll(/og:image.*?(https?:\/\/[^\s"'<>)]+)/gi)].map(
    ([, url]) => ({ url: url.trim(), alt: "og:image", score: 10 })
  );

  // 2. Markdown image syntax: ![alt](url)
  const mdImages = [...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)].map(
    ([, alt, url]) => ({ url, alt: alt ?? "", score: scoreImage(url, alt ?? "") })
  );

  // 3. HTML img tags
  const htmlImages = [...markdown.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi)].map(
    ([, url, alt]) => ({ url, alt: alt ?? "", score: scoreImage(url, alt ?? "") })
  );

  const all = [...ogImages, ...mdImages, ...htmlImages];
  const seen = new Set<string>();
  const unique = all.filter(({ url }) => {
    const clean = url.split("?")[0]; // dedupe ignoring query strings
    if (seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });

  return unique
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ url, alt }) => ({ url, alt }));
}

// ── Structured extraction via Haiku ───────────────────────────────────────

interface ExtractedSpec {
  name: string;
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

  const fieldsList = fieldHints.length > 0
    ? fieldHints.map((f) => `- ${f}`).join("\n")
    : "- dimensions\n- material\n- finish\n- colour\n- weight\n- fire rating\n- lead time\n- country of origin";

  const supplierHint = supplierNames.length > 0
    ? `\nKnown suppliers/brands in this studio: ${supplierNames.join(", ")} — if the product brand matches one of these (case-insensitive), use the exact spelling from this list.`
    : "";

  const prompt = `You are extracting structured product information from a supplier's page for an interior design spec library.

URL: ${url}

Available spec categories in this studio: ${categoryList}
${supplierHint}

Extract the following from the page content below. Return ONLY valid JSON:
{
  "name": "product name",
  "brand": "brand/manufacturer name or null",
  "description": "1-2 sentence description, or null",
  "collection": "collection name if part of one, or null",
  "category_suggestion": "best matching category from the list above, or suggest a new one if none fit",
  "cost_from": number or null,
  "cost_to": number or null,
  "cost_unit": "per m², per unit, per linear m, etc. or null",
  "tags": ["array", "of", "relevant", "tags"],
  "fields": [{ "label": "field name", "value": "field value" }]
}

For fields, extract values for THESE target fields. Use the EXACT label name shown (e.g. "Composition", not "Composition:"):
${fieldsList}

Important field extraction rules:
- Match loosely: "Width (cm)", "Width:", "Fabric Width" → use label "Width"
- Combine multi-line values into one string (e.g. pattern repeat horizontal + vertical)
- Only include a field if its value is clearly stated on the page — do not guess
- Search the ENTIRE page including tabs, accordions, and technical spec sections

For cost: extract as number only (no currency symbols). Single price = cost_from only.

Page content:
${pageContent.slice(0, 25000)}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonStr.trim()) as ExtractedSpec;
  } catch {
    return {
      name: "Unknown product",
      brand: null,
      description: null,
      collection: null,
      category_suggestion: categoryNames[0] ?? "Uncategorised",
      cost_from: null,
      cost_to: null,
      cost_unit: null,
      tags: [],
      fields: [],
    };
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
      // ── Check if already in the library ──────────────────────────────
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const studioId = await getCurrentStudioId();
        if (studioId) {
          const { data: tagRow } = await supabase
            .from("spec_tags")
            .select("spec_id")
            .eq("tag", `source:${url}`)
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
              return {
                already_exists: true,
                spec_id: specRow.id,
                spec_name: specRow.name,
                spec_url: `/specs`,
              };
            }
          }
        }
      } catch { /* non-critical — proceed with scrape */ }

      // ── Fetch the page ────────────────────────────────────────────────
      //
      // Strategy A — Firecrawl (preferred when API key is set):
      //   Full browser rendering, handles JS tabs/accordions, returns clean markdown.
      //   Doesn't use Readability so hidden tab content IS included.
      //
      // Strategy B — Jina Reader + raw HTML (fallback):
      //   Jina gives clean markdown but strips CSS-hidden elements (Readability).
      //   Raw HTML fetch captures everything including hidden tabs by stripping tags.

      let markdown = "";
      let htmlContent = "";

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
              formats: ["markdown"],
              onlyMainContent: false,   // include tabs, sidebars, technical sections
              timeout: 30000,
            }),
            signal: AbortSignal.timeout(35000),
          });

          if (fcRes.ok) {
            const fcData = await fcRes.json() as {
              success: boolean;
              data?: { markdown?: string; metadata?: { ogImage?: string } };
            };
            markdown = fcData.data?.markdown ?? "";
          }
        } catch { /* fall through to fallback below */ }
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
          const rawHtml = await htmlRes.value.text();

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

          htmlContent = [
            jsonLdBlocks ? `=== Structured data (JSON-LD) ===\n${jsonLdBlocks}` : "",
            `=== Full page text (includes hidden tabs) ===\n${strippedText.slice(0, 12000)}`,
          ]
            .filter(Boolean)
            .join("\n\n");
        }
      }

      if (!markdown && !htmlContent) {
        return { error: "Could not fetch that page — it may be blocking automated access." };
      }
      if (markdown.length < 100 && htmlContent.length < 100) {
        return { error: "The page didn't return enough content. It may require a login or be blocking access." };
      }

      // ── Fetch studio context: template fields + contact companies ─────
      type TemplateField = { id: string; template_id: string; name: string; ai_hint: string | null };
      type ContactCompany = { id: string; name: string };
      let templateFieldsList: TemplateField[] = [];
      let contactCompaniesList: ContactCompany[] = [];

      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const sid = await getCurrentStudioId();
        if (sid) {
          // First get template IDs for this studio (security: don't fetch other studios' fields)
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
              .select("id, name")
              .eq("studio_id", sid),
          ]);

          templateFieldsList = (fieldsRes.data ?? []) as TemplateField[];
          contactCompaniesList = (companiesRes.data ?? []) as ContactCompany[];
        }
      } catch { /* non-critical */ }

      // ── Extract data via Haiku ────────────────────────────────────────
      // Images come from Jina markdown (has proper URLs); text content is combined.
      const images = extractCandidateImages(markdown);
      const uniqueFieldNames = [...new Set(templateFieldsList.map((f) => f.name))];
      const supplierNames = contactCompaniesList.map((c) => c.name);

      // Combined page content: Jina markdown first (better for name/desc/cost),
      // then HTML-extracted text (better for technical specs in hidden tabs).
      const pageContent = [
        markdown ? `=== Main page content ===\n${markdown.slice(0, 15000)}` : "",
        htmlContent,
      ]
        .filter(Boolean)
        .join("\n\n");

      const spec = await extractWithHaiku(pageContent, url, categoryNames, uniqueFieldNames, supplierNames);

      // ── Resolve category_id, field_values, supplier_id server-side ───
      let category_id: string | null = null;
      let field_values: { field_id: string; label: string; value: string }[] = [];
      let supplier_id: string | null = null;

      try {
        const { createClient } = await import("@/lib/supabase/server");
        const { getCurrentStudioId } = await import("@/lib/studio-context");
        const supabase = await createClient();
        const studioId = await getCurrentStudioId();
        if (studioId && spec.category_suggestion) {
          const { data: categories } = await supabase
            .from("spec_categories")
            .select("id, name, template_id")
            .eq("studio_id", studioId)
            .eq("is_active", true);

          const catMatch = categories?.find(
            (c) => c.name.toLowerCase() === spec.category_suggestion.toLowerCase()
          );
          category_id = catMatch?.id ?? null;
          const template_id = catMatch?.template_id ?? null;

          // Match extracted fields to template field IDs.
          // Uses fuzzy matching so "Width (cm)" → "Width", "Martindale:" → "Martindale" etc.
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
                // Avoid duplicate field_ids (keep the first match)
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

          // Match brand to a known contact company
          if (spec.brand) {
            const supMatch = contactCompaniesList.find(
              (c) => c.name.toLowerCase() === spec.brand!.toLowerCase()
            );
            supplier_id = supMatch?.id ?? null;
          }
        }
      } catch { /* non-critical */ }

      return { ...spec, category_id, source_url: url, images, field_values, supplier_id };
    },
  });
