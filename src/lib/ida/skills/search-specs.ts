/**
 * searchSpecs skill
 *
 * Searches the studio's spec library using structured criteria that Sonnet
 * extracts from natural language (e.g. "blue geometric fabric, 100cm wide").
 *
 * Queries across three layers simultaneously:
 *   - specs (name, description) — keyword / brand text match
 *   - spec_tags               — colour, pattern, texture, style tags
 *   - spec_field_values       — width (cm), Martindale, etc.
 *
 * Results are scored by how many criteria match and returned ranked.
 */

import { tool, jsonSchema } from "ai";

type SearchSpecsParams = {
  keywords?: string;
  colors?: string[];
  patterns?: string[];
  materials?: string[];
  styles?: string[];
  uses?: string[];
  width_min_cm?: number;
  width_max_cm?: number;
  martindale_min?: number;
  category_name?: string;
  limit?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract the first numeric value from a string like "137cm (54\")" or "30,000" */
function parseFirstNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

/** Format a cost range into a display string */
function formatCost(
  from: number | null,
  to: number | null,
  unit: string | null
): string | null {
  if (!from && !to) return null;
  const range =
    from && to
      ? `£${from}–£${to}`
      : from
      ? `from £${from}`
      : `to £${to}`;
  return unit ? `${range} ${unit}` : range;
}

// ── Tool ───────────────────────────────────────────────────────────────────

export const searchSpecsTool = () =>
  tool({
    description:
      "Search the studio's spec library using structured criteria extracted from the user's natural language request. Use this when the user asks to find, show, or look for products — e.g. 'show me blue geometric fabrics' or 'find something for upholstery, 100cm wide'. Extract the relevant criteria and call this tool.",
    parameters: jsonSchema<SearchSpecsParams>({
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Free-text keywords to match against product name and description",
        },
        colors: {
          type: "array",
          items: { type: "string" },
          description: "Colour tags to match, e.g. ['blue', 'navy', 'teal']",
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Pattern types, e.g. ['geometric', 'stripe', 'plain']",
        },
        materials: {
          type: "array",
          items: { type: "string" },
          description:
            "Material or texture tags, e.g. ['fabric', 'velvet', 'leather', 'woven']",
        },
        styles: {
          type: "array",
          items: { type: "string" },
          description:
            "Style descriptors, e.g. ['contemporary', 'traditional', 'natural']",
        },
        uses: {
          type: "array",
          items: { type: "string" },
          description:
            "Intended use cases, e.g. ['upholstery', 'curtains', 'wallcovering']",
        },
        width_min_cm: {
          type: "number",
          description: "Minimum fabric or product width in cm",
        },
        width_max_cm: {
          type: "number",
          description: "Maximum fabric or product width in cm",
        },
        martindale_min: {
          type: "number",
          description: "Minimum Martindale rub count required",
        },
        category_name: {
          type: "string",
          description: "Filter results to a specific spec category by name",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 8, max 20)",
        },
      },
    }),
    execute: async (params: SearchSpecsParams) => {
      const { createClient } = await import("@/lib/supabase/server");
      const { getCurrentStudioId } = await import("@/lib/studio-context");

      const supabase = await createClient();
      const studioId = await getCurrentStudioId();
      if (!studioId) return { error: "No studio context found." };

      const maxResults = Math.min(params.limit ?? 8, 20);

      // ── 1. All studio specs ─────────────────────────────────────────────
      const { data: specs } = await supabase
        .from("specs")
        .select(
          "id, name, description, image_url, category_id, cost_from, cost_to, cost_unit"
        )
        .eq("studio_id", studioId);

      if (!specs || specs.length === 0) {
        return {
          results: [],
          total_found: 0,
          message: "No specs in the library yet.",
        };
      }

      const specIds = specs.map((s) => s.id);

      // ── 2. Category map (id → name, id → parent_id) ────────────────────
      const { data: categories } = await supabase
        .from("spec_categories")
        .select("id, name, parent_id")
        .eq("studio_id", studioId);

      const catMap = new Map(
        (categories ?? []).map((c) => [c.id, c.name])
      );

      // Build a Set of category IDs that match the filter, including all descendants.
      // e.g. "Lighting" matches Pendant, Recessed, Wall Light, Floor Lamp, Table Lamp.
      function resolveMatchingCategoryIds(filterName: string): Set<string> | null {
        if (!filterName) return null;
        const all = categories ?? [];

        // Find all categories whose name contains the filter string
        const matchedRoots = all.filter((c) =>
          c.name.toLowerCase().includes(filterName)
        );
        if (matchedRoots.length === 0) return null;

        const ids = new Set<string>();

        // For each matched category, add it and all its descendants (1-2 levels deep)
        for (const root of matchedRoots) {
          ids.add(root.id);
          // Direct children
          const children = all.filter((c) => c.parent_id === root.id);
          for (const child of children) {
            ids.add(child.id);
            // Grandchildren (supports up to 3 levels of nesting)
            const grandchildren = all.filter((c) => c.parent_id === child.id);
            for (const gc of grandchildren) ids.add(gc.id);
          }
        }
        return ids;
      }

      // ── 3. Tags for all specs (exclude internal source: tags) ───────────
      const { data: tagRows } = await supabase
        .from("spec_tags")
        .select("spec_id, tag")
        .in("spec_id", specIds)
        .not("tag", "like", "source:%");

      const tagsBySpec = new Map<string, string[]>();
      for (const row of tagRows ?? []) {
        const arr = tagsBySpec.get(row.spec_id) ?? [];
        arr.push(row.tag.toLowerCase());
        tagsBySpec.set(row.spec_id, arr);
      }

      // ── 4. Field values for width / Martindale filtering ───────────────
      type FieldValueEntry = { fieldName: string; value: string };
      let fieldValuesBySpec = new Map<string, FieldValueEntry[]>();

      const needsFieldSearch =
        params.width_min_cm != null ||
        params.width_max_cm != null ||
        params.martindale_min != null;

      if (needsFieldSearch) {
        const { data: studioTemplates } = await supabase
          .from("spec_templates")
          .select("id")
          .eq("studio_id", studioId)
          .eq("is_active", true);

        const templateIds = (studioTemplates ?? []).map((t) => t.id);

        if (templateIds.length > 0) {
          // Fetch fields whose names contain "width" or "martindale" / "rub"
          const { data: relevantFields } = await supabase
            .from("spec_template_fields")
            .select("id, name")
            .in("template_id", templateIds);

          const targetFields = (relevantFields ?? []).filter((f) => {
            const n = f.name.toLowerCase();
            return (
              n.includes("width") ||
              n.includes("martindale") ||
              n.includes("rub")
            );
          });

          if (targetFields.length > 0) {
            const fieldIds = targetFields.map((f) => f.id);
            const fieldNameById = new Map(
              targetFields.map((f) => [f.id, f.name])
            );

            const { data: fieldValues } = await supabase
              .from("spec_field_values")
              .select("spec_id, template_field_id, value")
              .in("spec_id", specIds)
              .in("template_field_id", fieldIds);

            for (const fv of fieldValues ?? []) {
              const arr = fieldValuesBySpec.get(fv.spec_id) ?? [];
              arr.push({
                fieldName: fieldNameById.get(fv.template_field_id) ?? "",
                value: fv.value ?? "",
              });
              fieldValuesBySpec.set(fv.spec_id, arr);
            }
          }
        }
      }

      // ── 5. Score each spec ──────────────────────────────────────────────
      const searchTags = [
        ...(params.colors ?? []),
        ...(params.patterns ?? []),
        ...(params.materials ?? []),
        ...(params.styles ?? []),
        ...(params.uses ?? []),
      ].map((t) => t.toLowerCase());

      const keywordsLower = (params.keywords ?? "").toLowerCase().trim();
      const catFilter = (params.category_name ?? "").toLowerCase().trim();
      const matchingCategoryIds = resolveMatchingCategoryIds(catFilter);
      const hasAnyCriteria =
        searchTags.length > 0 ||
        keywordsLower.length > 0 ||
        needsFieldSearch;

      type ScoredSpec = (typeof specs)[0] & {
        score: number;
        matchedTags: string[];
      };

      const scored: ScoredSpec[] = [];

      for (const spec of specs) {
        let score = 0;
        const matchedTags: string[] = [];

        // Hard filter by category — includes the matched category AND all its children/grandchildren
        if (matchingCategoryIds) {
          if (!spec.category_id || !matchingCategoryIds.has(spec.category_id)) continue;
        }

        // Keyword match against name (+2) and description (+1)
        if (keywordsLower) {
          if (spec.name.toLowerCase().includes(keywordsLower)) {
            score += 2;
          } else if (
            (spec.description ?? "").toLowerCase().includes(keywordsLower)
          ) {
            score += 1;
          }
        }

        // Tag matching — partial/substring match, +3 per matched search tag
        const specTags = tagsBySpec.get(spec.id) ?? [];
        for (const searchTag of searchTags) {
          for (const specTag of specTags) {
            if (
              specTag.includes(searchTag) ||
              searchTag.includes(specTag)
            ) {
              score += 3;
              matchedTags.push(specTag);
              break; // only count once per search tag criterion
            }
          }
        }

        // Width field match (+2 if within requested range)
        if (params.width_min_cm != null || params.width_max_cm != null) {
          const fvs = fieldValuesBySpec.get(spec.id) ?? [];
          for (const fv of fvs) {
            if (fv.fieldName.toLowerCase().includes("width")) {
              const num = parseFirstNumber(fv.value);
              if (num !== null) {
                const inRange =
                  (params.width_min_cm == null ||
                    num >= params.width_min_cm) &&
                  (params.width_max_cm == null || num <= params.width_max_cm);
                if (inRange) score += 2;
              }
              break;
            }
          }
        }

        // Martindale minimum (+2 if meets requirement)
        if (params.martindale_min != null) {
          const fvs = fieldValuesBySpec.get(spec.id) ?? [];
          for (const fv of fvs) {
            const fn = fv.fieldName.toLowerCase();
            if (fn.includes("martindale") || fn.includes("rub")) {
              const num = parseFirstNumber(fv.value);
              if (num !== null && num >= params.martindale_min) {
                score += 2;
              }
              break;
            }
          }
        }

        // Skip unmatched specs when criteria were given
        if (hasAnyCriteria && score === 0) continue;

        scored.push({
          ...spec,
          score,
          matchedTags,
        });
      }

      // ── 6. Sort, slice, and format ──────────────────────────────────────
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, maxResults);

      const results = top.map((spec) => {
        const catId = spec.category_id ?? "";
        const catName = catMap.get(catId) ?? null;
        const parentId = (categories ?? []).find((c) => c.id === catId)?.parent_id ?? null;
        const parentName = parentId ? (catMap.get(parentId) ?? null) : null;
        const categoryLabel = catName
          ? parentName
            ? `${parentName} › ${catName}`
            : catName
          : null;

        return {
          id: spec.id,
          name: spec.name,
          category: categoryLabel,
          cost: formatCost(spec.cost_from, spec.cost_to, spec.cost_unit),
          matched_tags: spec.matchedTags,
          image_url: spec.image_url,
        };
      });

      return {
        results,
        total_found: scored.length,
      };
    },
  });
