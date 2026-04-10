/**
 * Contact Categories Settings — /settings/contacts
 *
 * Admin-only page for managing the contact category tree.
 * Seeds default categories on first visit if none exist.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import ContactCategoriesClient from "./ContactCategoriesClient";
import { seedContactCategories } from "./actions";
import type { ContactCategoryRow } from "@/types/database";

export default async function ContactCategoriesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Seed defaults on first visit (idempotent)
  const { count } = await supabase
    .from("contact_categories")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId);

  if (count === 0) {
    await seedContactCategories();
  }

  // Fetch all categories
  const { data: categoriesData } = await supabase
    .from("contact_categories")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const categories = categoriesData ?? [];

  // Count companies per category
  const { data: countData } = await supabase
    .from("contact_companies")
    .select("category_id")
    .eq("studio_id", studioId);

  const companyCountByCategory: Record<string, number> = {};
  for (const row of countData ?? []) {
    if (row.category_id) {
      companyCountByCategory[row.category_id] = (companyCountByCategory[row.category_id] ?? 0) + 1;
    }
  }

  return (
    <AppShell>
      <ContactCategoriesClient
        categories={categories}
        companyCountByCategory={companyCountByCategory}
      />
    </AppShell>
  );
}
