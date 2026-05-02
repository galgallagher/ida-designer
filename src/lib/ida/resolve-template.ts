/**
 * resolveTemplateId
 *
 * Resolves the correct spec template ID for a new spec, in priority order:
 *   1. The template belonging to the spec's category (so field definitions match)
 *   2. The studio's first active template
 *   3. A newly created "General" template if none exist
 *
 * Returns null if all three steps fail (shouldn't happen in practice).
 *
 * Shared between the saveSpec Ida skill and the /api/ida/save route so
 * both save paths always use identical logic.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveTemplateId(
  supabase: SupabaseClient,
  studioId: string,
  categoryId: string | null
): Promise<string | null> {
  // 1. Category's own template — or walk up to the parent for sub-categories
  //    e.g. "Seating" has no template_id, but its parent "Furniture" does
  if (categoryId) {
    const { data: cat } = await supabase
      .from("library_categories")
      .select("template_id, parent_id")
      .eq("id", categoryId)
      .single();
    if (cat?.template_id) return cat.template_id as string;

    // Sub-category: check parent
    if (cat?.parent_id) {
      const { data: parent } = await supabase
        .from("library_categories")
        .select("template_id")
        .eq("id", cat.parent_id)
        .single();
      if (parent?.template_id) return parent.template_id as string;
    }
  }

  // 2. Studio's first active template
  const { data: templates } = await supabase
    .from("library_templates")
    .select("id")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (templates?.[0]?.id) return templates[0].id as string;

  // 3. Create a General template as last resort
  const { data: created } = await supabase
    .from("library_templates")
    .insert({ studio_id: studioId, name: "General", is_active: true })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}
