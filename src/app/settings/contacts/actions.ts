"use server";

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

type Result = { error?: string };

function revalidate() {
  revalidatePath("/settings/contacts");
  revalidatePath("/contacts");
}

// ── seedContactCategories ─────────────────────────────────────────────────────

export async function seedContactCategories(): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  await supabase.rpc("seed_default_contact_categories", { p_studio_id: studioId });
  // Note: no revalidatePath here — this is called during render, not from a user action.
  return {};
}

// ── createContactCategory ─────────────────────────────────────────────────────

export async function createContactCategory(formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const parent_id = (formData.get("parent_id") as string | null)?.trim() || null;
  const icon = (formData.get("icon") as string | null)?.trim() || null;

  // Next sort order within same parent
  let siblingsQuery = supabase
    .from("contact_categories")
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
    .from("contact_categories")
    .insert({ studio_id: studioId, name, parent_id, icon, sort_order, is_active: true });

  if (insertError) return { error: "Failed to create category." };
  revalidate();
  return {};
}

// ── updateContactCategory ─────────────────────────────────────────────────────

export async function updateContactCategory(id: string, formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const icon = (formData.get("icon") as string | null)?.trim() || null;
  const is_active = formData.get("is_active") === "true";

  const { error: updateError } = await supabase
    .from("contact_categories")
    .update({ name, icon, is_active })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (updateError) return { error: "Failed to update category." };
  revalidate();
  return {};
}

// ── toggleContactCategoryActive ───────────────────────────────────────────────

export async function toggleContactCategoryActive(id: string, currentValue: boolean): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const { error: updateError } = await supabase
    .from("contact_categories")
    .update({ is_active: !currentValue })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (updateError) return { error: "Failed to toggle category." };
  revalidate();
  return {};
}

// ── deleteContactCategory ─────────────────────────────────────────────────────

export async function deleteContactCategory(id: string): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  // Refuse if any companies reference this category
  const { count: companyCount } = await supabase
    .from("contact_companies")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (companyCount && companyCount > 0) {
    return { error: `Cannot delete — ${companyCount} contact${companyCount > 1 ? "s" : ""} use this category.` };
  }

  // Also refuse if child categories have companies
  const { data: children } = await supabase
    .from("contact_categories")
    .select("id")
    .eq("parent_id", id);

  if (children && children.length > 0) {
    const childIds = children.map((c) => c.id);
    const { count: childCompanyCount } = await supabase
      .from("contact_companies")
      .select("id", { count: "exact", head: true })
      .in("category_id", childIds);

    if (childCompanyCount && childCompanyCount > 0) {
      return { error: `Cannot delete — sub-categories have ${childCompanyCount} contact${childCompanyCount > 1 ? "s" : ""}.` };
    }

    await supabase.from("contact_categories").delete().in("id", childIds);
  }

  const { error: deleteError } = await supabase
    .from("contact_categories")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (deleteError) return { error: "Failed to delete category." };
  revalidate();
  return {};
}

// ── moveContactCategory ───────────────────────────────────────────────────────

export async function moveContactCategory(id: string, direction: "up" | "down"): Promise<Result> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const { data: cat } = await supabase
    .from("contact_categories")
    .select("id, sort_order, parent_id")
    .eq("id", id)
    .single();

  if (!cat) return { error: "Category not found." };

  let siblingQuery = supabase
    .from("contact_categories")
    .select("id, sort_order")
    .eq("studio_id", studioId)
    .filter("sort_order", direction === "up" ? "lt" : "gt", cat.sort_order)
    .order("sort_order", { ascending: direction !== "up" })
    .limit(1);

  siblingQuery = cat.parent_id
    ? siblingQuery.eq("parent_id", cat.parent_id)
    : siblingQuery.is("parent_id", null);

  const { data: sibling } = await siblingQuery.single();

  if (!sibling) return {};

  await supabase.from("contact_categories").update({ sort_order: sibling.sort_order }).eq("id", cat.id);
  await supabase.from("contact_categories").update({ sort_order: cat.sort_order }).eq("id", sibling.id);

  revalidate();
  return {};
}
