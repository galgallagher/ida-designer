/**
 * saveSpec skill
 *
 * Saves a confirmed spec to the studio library.
 * Called after the user has reviewed the extracted data and chosen an image.
 */

import { tool, jsonSchema } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

type SaveSpecParams = {
  name: string;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  tags: string[];
  source_url: string | null;
};

export const saveSpecTool = () =>
  tool({
    description:
      "Save a confirmed spec to the studio library. Only call this after the user has reviewed the details and confirmed they want to save it.",
    parameters: jsonSchema<SaveSpecParams>({
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        description: { type: ["string", "null"], description: "Short product description" },
        category_id: { type: ["string", "null"], description: "UUID of the spec category" },
        image_url: { type: ["string", "null"], description: "URL of the chosen product image" },
        cost_from: { type: ["number", "null"], description: "Price lower bound" },
        cost_to: { type: ["number", "null"], description: "Price upper bound" },
        cost_unit: { type: ["string", "null"], description: "e.g. 'per m²'" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the spec" },
        source_url: { type: ["string", "null"], description: "The original product URL" },
      },
      required: ["name", "tags"],
    }),
    execute: async ({ name, description, category_id, image_url, cost_from, cost_to, cost_unit, tags, source_url }: SaveSpecParams) => {
      const supabase = await createClient();
      const studioId = await getCurrentStudioId();

      if (!studioId) return { error: "No studio context found." };

      const { data: templates } = await supabase
        .from("spec_templates")
        .select("id")
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      let templateId = templates?.[0]?.id;

      if (!templateId) {
        const { data: newTemplate } = await supabase
          .from("spec_templates")
          .insert({ studio_id: studioId, name: "General", is_active: true })
          .select("id")
          .single();
        templateId = newTemplate?.id;
      }

      if (!templateId) return { error: "Could not find or create a spec template." };

      const { data: spec, error: specError } = await supabase
        .from("specs")
        .insert({
          studio_id: studioId,
          template_id: templateId,
          category_id: category_id ?? null,
          name,
          description: description ?? null,
          image_url: image_url ?? null,
          cost_from: cost_from ?? null,
          cost_to: cost_to ?? null,
          cost_unit: cost_unit ?? null,
        })
        .select("id, name")
        .single();

      if (specError || !spec) return { error: `Failed to save spec: ${specError?.message}` };

      if (tags.length > 0) {
        await supabase.from("spec_tags").insert(tags.map((tag: string) => ({ spec_id: spec.id, tag })));
      }

      if (source_url) {
        try {
          await supabase.from("spec_tags").insert({ spec_id: spec.id, tag: `source:${source_url}` });
        } catch { /* best-effort */ }
      }

      return { id: spec.id, name: spec.name };
    },
  });
