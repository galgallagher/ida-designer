/**
 * Spec Library — /specs
 *
 * Studio-wide catalogue of all spec items.
 * Server component: fetches categories + specs, passes to client for filtering/search.
 */

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import SpecLibraryClient from "./SpecLibraryClient";
import type { LibraryCategoryRow } from "@/types/database";

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
    .from("library_categories")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const categories = categoriesData ?? [];

  // Fetch all specs with their tags and suppliers (joined).
  // Hard-cap at 2000 — beyond that the library needs proper pagination
  // / server-side search (separate change). Guards against catastrophic
  // loads on very large studios; today's libraries are well under this.
  const { data: specsData } = await supabase
    .from("library_items")
    .select("*")
    .eq("studio_id", studioId)
    .order("name", { ascending: true })
    .limit(2000);

  const specs = specsData ?? [];

  // Fetch tags for all specs
  const { data: tagsData } = await supabase
    .from("library_item_tags")
    .select("library_item_id, tag")
    .in("library_item_id", specs.map((s) => s.id));

  // Fetch suppliers for all specs via junction
  const { data: specSupplierData } = await supabase
    .from("library_item_suppliers")
    .select("library_item_id, supplier_id")
    .in("library_item_id", specs.map((s) => s.id));

  // Fetch supplier details from contact_companies (including website for grouped view)
  const { data: suppliersData } = await supabase
    .from("contact_companies")
    .select("id, name, website")
    .eq("studio_id", studioId)
    .order("name", { ascending: true });

  type SupplierRef = { id: string; name: string; website: string | null };
  const supplierMap = new Map<string, SupplierRef>(
    (suppliersData ?? []).map((s) => [s.id, { id: s.id, name: s.name, website: s.website ?? null }])
  );

  // Build tag map and supplier map per spec
  const tagsBySpec: Record<string, string[]> = {};
  for (const t of tagsData ?? []) {
    (tagsBySpec[t.library_item_id] ??= []).push(t.tag);
  }

  const suppliersBySpec: Record<string, SupplierRef[]> = {};
  for (const ss of specSupplierData ?? []) {
    const sup = supplierMap.get(ss.supplier_id);
    if (sup) (suppliersBySpec[ss.library_item_id] ??= []).push(sup);
  }

  // Build category lookup
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Build variant group counts (so each card knows "2 colorways")
  const variantCounts = new Map<string, number>();
  for (const s of specs) {
    if (s.variant_group_id) {
      variantCounts.set(s.variant_group_id, (variantCounts.get(s.variant_group_id) ?? 0) + 1);
    }
  }

  // Enrich specs
  const enrichedSpecs = specs.map((s) => ({
    ...s,
    categoryName: s.category_id ? (categoryMap.get(s.category_id) ?? null) : null,
    variantCount: s.variant_group_id ? (variantCounts.get(s.variant_group_id) ?? 1) : 0,
    tags: tagsBySpec[s.id] ?? [],
    suppliers: suppliersBySpec[s.id] ?? [],
  }));

  return (
    <AppShell>
      <Suspense>
        <SpecLibraryClient
          specs={enrichedSpecs}
          categories={categories}
          allSuppliers={(suppliersData ?? []).map((s) => ({ id: s.id, name: s.name, website: s.website ?? null }))}
        />
      </Suspense>
    </AppShell>
  );
}
