/**
 * createCategory skill
 *
 * Creates a new top-level spec category for the studio.
 * Ida calls this after the user confirms they want a new category created.
 */

import { tool, jsonSchema } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

type CreateCategoryParams = {
  name: string;
  icon?: string;
};

export const createCategoryTool = () =>
  tool({
    description:
      "Create a new spec category in the studio library. Only call this after the user has confirmed they want the category created. Do not create categories without explicit user approval.",
    parameters: jsonSchema<CreateCategoryParams>({
      type: "object",
      properties: {
        name: { type: "string", description: "The category name, e.g. 'Soft Furnishings'" },
        icon: {
          type: "string",
          enum: ["layers", "lightbulb", "scissors", "grid", "hammer", "paintbrush", "droplets", "key", "armchair", "square"],
          description: "A relevant icon name",
        },
      },
      required: ["name"],
    }),
    execute: async ({ name, icon }: CreateCategoryParams) => {
      const supabase = await createClient();
      const studioId = await getCurrentStudioId();

      if (!studioId) return { error: "No studio context found." };

      const { data: existing } = await supabase
        .from("library_categories")
        .select("sort_order")
        .eq("studio_id", studioId)
        .is("parent_id", null)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 10;

      const { data, error } = await supabase
        .from("library_categories")
        .insert({ studio_id: studioId, name, icon: icon ?? "layers", sort_order: nextOrder, is_active: true })
        .select("id, name")
        .single();

      if (error) return { error: `Failed to create category: ${error.message}` };
      return { id: data.id, name: data.name };
    },
  });
