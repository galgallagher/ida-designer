/**
 * Settings → Spec Categories — /settings/categories
 *
 * Studio admins can create, edit, reorder, activate/deactivate,
 * and delete spec categories from here. Clicking a category's pencil
 * opens a right-side panel with inline edit + template field management.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import CategoriesClient from "./CategoriesClient";
import type { LibraryCategoryRow, LibraryTemplateFieldRow } from "@/types/database";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all categories for this studio (active + inactive)
  const { data: categoriesData } = await supabase
    .from("library_categories")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const categories = categoriesData ?? [];

  // Spec counts per category
  const categoryIds = categories.map((c) => c.id);
  const specCountByCategory: Record<string, number> = {};

  if (categoryIds.length > 0) {
    const { data: specs } = await supabase
      .from("library_items").select("category_id").eq("studio_id", studioId)
      .in("category_id", categoryIds);

    for (const spec of specs ?? []) {
      if (spec.category_id) {
        specCountByCategory[spec.category_id] = (specCountByCategory[spec.category_id] ?? 0) + 1;
      }
    }
  }

  // Fetch ALL template fields for all templates belonging to this studio
  // (passed to client so the panel can show them instantly without a round-trip)
  const templateIds = categories.map((c) => c.template_id).filter(Boolean) as string[];
  let allFields: LibraryTemplateFieldRow[] = [];

  if (templateIds.length > 0) {
    const { data: fieldsData } = await supabase
      .from("library_template_fields")
      .select("*")
      .in("template_id", templateIds)
      .order("order_index");
    allFields = fieldsData ?? [];
  }

  return (
    <AppShell>
      <CategoriesClient
        categories={categories}
        specCountByCategory={specCountByCategory}
        allFields={allFields}
      />
    </AppShell>
  );
}
