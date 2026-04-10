/**
 * Contacts — /contacts
 *
 * Studio-wide company/contact directory with category tree and tag filtering.
 * Seeds default contact categories on first visit.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import ContactsClient, { type EnrichedCompany } from "./ContactsClient";
import { seedContactCategories } from "@/app/settings/contacts/actions";
import type { ContactCategoryRow } from "@/types/database";

export default async function ContactsPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();

  if (!studioId) {
    return <AppShell><p>No studio found.</p></AppShell>;
  }

  // Seed default categories on first visit (idempotent)
  const { count } = await supabase
    .from("contact_categories")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId);

  if (count === 0) {
    await seedContactCategories();
  }

  // Fetch categories
  const { data: categoriesData } = await supabase
    .from("contact_categories")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("sort_order");

  const categories = categoriesData ?? [];

  // Fetch companies
  const { data: companiesData } = await supabase
    .from("contact_companies")
    .select("*")
    .eq("studio_id", studioId)
    .order("name");

  const companies = companiesData ?? [];

  if (companies.length === 0) {
    return (
      <AppShell>
        <ContactsClient companies={[]} categories={categories} />
      </AppShell>
    );
  }

  const companyIds = companies.map((c) => c.id);

  // Fetch tags for all companies
  const { data: tagsData } = await supabase
    .from("contact_tags").select("company_id, tag")
    .in("company_id", companyIds);

  // Count people per company
  const { data: peopleData } = await supabase
    .from("contact_people").select("company_id")
    .in("company_id", companyIds);

  // Build tag map
  const tagsByCompany: Record<string, string[]> = {};
  for (const t of tagsData ?? []) {
    (tagsByCompany[t.company_id] ??= []).push(t.tag);
  }

  // Build people count map
  const peopleCountByCompany: Record<string, number> = {};
  for (const p of peopleData ?? []) {
    peopleCountByCompany[p.company_id] = (peopleCountByCompany[p.company_id] ?? 0) + 1;
  }

  // Build category name map
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const enrichedCompanies: EnrichedCompany[] = companies.map((c) => ({
    ...c,
    categoryName: c.category_id ? (categoryMap.get(c.category_id) ?? null) : null,
    tags: tagsByCompany[c.id] ?? [],
    peopleCount: peopleCountByCompany[c.id] ?? 0,
  }));

  return (
    <AppShell>
      <ContactsClient companies={enrichedCompanies} categories={categories} />
    </AppShell>
  );
}
