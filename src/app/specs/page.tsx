/**
 * Spec Library — /specs
 *
 * Studio-wide catalogue of all spec items.
 * Server component: fetches categories + specs, passes to client for filtering/search.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import SpecLibraryClient from "./SpecLibraryClient";
import type { SpecCategoryRow } from "@/types/database";

export default async function SpecLibraryPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();

  if (!studioId) {
    return (
      <AppShell>
        <p>No studio found.</p>
      </AppShell>
    );
  }

  // Fetch categories (flat list — client builds the tree)
  const { data: categoriesData } = await supabase
    .from("spec_categories")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const categories = categoriesData ?? [];

  // Fetch all specs with their tags and suppliers (joined)
  const { data: specsData } = await supabase
    .from("specs")
    .select("*")
    .eq("studio_id", studioId)
    .order("name", { ascending: true });

  const specs = specsData ?? [];

  // Fetch tags for all specs
  const { data: tagsData } = await supabase
    .from("spec_tags")
    .select("spec_id, tag")
    .in("spec_id", specs.map((s) => s.id));

  // Fetch suppliers for all specs via junction
  const { data: specSupplierData } = await supabase
    .from("spec_suppliers")
    .select("spec_id, supplier_id")
    .in("spec_id", specs.map((s) => s.id));

  // Fetch supplier names from contact_companies
  const { data: suppliersData } = await supabase
    .from("contact_companies")
    .select("id, name")
    .eq("studio_id", studioId)
    .order("name", { ascending: true });

  const supplierMap = new Map((suppliersData ?? []).map((s) => [s.id, s.name]));

  // Build tag map and supplier name map per spec
  const tagsBySpec: Record<string, string[]> = {};
  for (const t of tagsData ?? []) {
    (tagsBySpec[t.spec_id] ??= []).push(t.tag);
  }

  const suppliersBySpec: Record<string, string[]> = {};
  for (const ss of specSupplierData ?? []) {
    const name = supplierMap.get(ss.supplier_id);
    if (name) (suppliersBySpec[ss.spec_id] ??= []).push(name);
  }

  // Build category lookup
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Enrich specs
  const enrichedSpecs = specs.map((s) => ({
    ...s,
    categoryName: s.category_id ? (categoryMap.get(s.category_id) ?? null) : null,
    tags: tagsBySpec[s.id] ?? [],
    supplierNames: suppliersBySpec[s.id] ?? [],
  }));

  return (
    <AppShell>
      <SpecLibraryClient
        specs={enrichedSpecs}
        categories={categories}
        allSuppliers={suppliersData ?? []}
      />
    </AppShell>
  );
}
