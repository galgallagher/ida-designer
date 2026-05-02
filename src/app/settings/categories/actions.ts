"use server";

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

type Result = { error?: string };

function revalidate() {
  revalidatePath("/settings/categories");
  revalidatePath("/specs");
}

// ── createCategory ────────────────────────────────────────────────────────────

export async function createCategory(formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const parent_id = (formData.get("parent_id") as string | null)?.trim() || null;
  const icon = (formData.get("icon") as string | null)?.trim() || null;
  const abbreviation = (formData.get("abbreviation") as string | null)?.trim().toUpperCase() || null;

  // Get next sort order within the same parent scope
  let siblingsQuery = supabase
    .from("library_categories")
    .select("sort_order")
    .eq("studio_id", studioId)
    .order("sort_order", { ascending: false })
    .limit(1);

  siblingsQuery = parent_id
    ? siblingsQuery.eq("parent_id", parent_id)
    : siblingsQuery.is("parent_id", null);

  const { data: siblings } = await siblingsQuery;
  const sort_order = (siblings?.[0]?.sort_order ?? 0) + 1;

  const { error: insertError } = await supabase
    .from("library_categories")
    .insert({ studio_id: studioId, name, parent_id, icon, sort_order, is_active: true, abbreviation });

  if (insertError) {
    console.error("[createCategory]", insertError);
    return { error: "Failed to create category." };
  }

  revalidate();
  return {};
}

// ── updateCategory ────────────────────────────────────────────────────────────

export async function updateCategory(id: string, formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const icon = (formData.get("icon") as string | null)?.trim() || null;
  const is_active = formData.get("is_active") === "true";
  const abbreviation = (formData.get("abbreviation") as string | null)?.trim().toUpperCase() || null;

  const { error: updateError } = await supabase
    .from("library_categories")
    .update({ name, icon, is_active, abbreviation })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (updateError) {
    console.error("[updateCategory]", updateError);
    return { error: "Failed to update category." };
  }

  revalidate();
  return {};
}

// ── toggleCategoryActive ──────────────────────────────────────────────────────

export async function toggleCategoryActive(id: string, currentValue: boolean): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const { error: updateError } = await supabase
    .from("library_categories")
    .update({ is_active: !currentValue })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (updateError) return { error: "Failed to toggle category." };
  revalidate();
  return {};
}

// ── deleteCategory ────────────────────────────────────────────────────────────

export async function deleteCategory(id: string): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  // Refuse if any specs reference this category
  const { count: specCount } = await supabase
    .from("library_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (specCount && specCount > 0) {
    return { error: `Cannot delete — ${specCount} spec${specCount > 1 ? "s" : ""} use this category.` };
  }

  // Also refuse if it has child categories with specs
  const { data: children } = await supabase
    .from("library_categories")
    .select("id")
    .eq("parent_id", id);

  if (children && children.length > 0) {
    const childIds = children.map((c) => c.id);
    const { count: childSpecCount } = await supabase
      .from("library_items")
      .select("id", { count: "exact", head: true })
      .in("category_id", childIds);
    if (childSpecCount && childSpecCount > 0) {
      return { error: `Cannot delete — sub-categories have ${childSpecCount} spec${childSpecCount > 1 ? "s" : ""}.` };
    }
    // Delete child categories first
    await supabase.from("library_categories").delete().in("id", childIds);
  }

  const { error: deleteError } = await supabase
    .from("library_categories")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (deleteError) return { error: "Failed to delete category." };
  revalidate();
  return {};
}

// ── moveCategory ──────────────────────────────────────────────────────────────

export async function moveCategory(id: string, direction: "up" | "down"): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  // Get this category
  const { data: cat } = await supabase
    .from("library_categories")
    .select("id, sort_order, parent_id")
    .eq("id", id)
    .single();

  if (!cat) return { error: "Category not found." };

  // Find the adjacent sibling in the given direction
  let siblingQuery = supabase
    .from("library_categories")
    .select("id, sort_order")
    .eq("studio_id", studioId)
    .filter("sort_order", direction === "up" ? "lt" : "gt", cat.sort_order)
    .order("sort_order", { ascending: direction !== "up" })
    .limit(1);

  siblingQuery = cat.parent_id
    ? siblingQuery.eq("parent_id", cat.parent_id)
    : siblingQuery.is("parent_id", null);

  const { data: sibling } = await siblingQuery.single();

  if (!sibling) return {}; // already at the edge

  // Swap sort orders
  await supabase.from("library_categories").update({ sort_order: sibling.sort_order }).eq("id", cat.id);
  await supabase.from("library_categories").update({ sort_order: cat.sort_order }).eq("id", sibling.id);

  revalidate();
  return {};
}

// ── ensureCategoryTemplate ────────────────────────────────────────────────────
// Creates a spec_template for a category that doesn't have one yet, links it,
// and returns the template_id. Safe to call multiple times — idempotent.

export async function ensureCategoryTemplate(
  categoryId: string
): Promise<{ templateId: string | null; error?: string }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { templateId: null, error: error ?? "Unknown error." };

  // Check if one already exists
  const { data: cat } = await supabase
    .from("library_categories")
    .select("template_id, name")
    .eq("id", categoryId)
    .single();

  if (!cat) return { templateId: null, error: "Category not found." };
  if (cat.template_id) return { templateId: cat.template_id };

  // Create a new template
  const { data: tmpl, error: tmplError } = await supabase
    .from("library_templates")
    .insert({ studio_id: studioId, name: cat.name, is_active: true })
    .select("id")
    .single();

  if (tmplError || !tmpl) return { templateId: null, error: "Failed to create template." };

  // Link category → template
  await supabase
    .from("library_categories")
    .update({ template_id: tmpl.id })
    .eq("id", categoryId);

  revalidate();
  return { templateId: tmpl.id };
}
