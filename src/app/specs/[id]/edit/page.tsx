/**
 * Edit Spec — /specs/[id]/edit
 *
 * Pre-fills all fields from the existing spec and uses updateSpec server action.
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import EditSpecClient from "./EditSpecClient";
import type { SpecRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSpecPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/specs");

  // Fetch spec
  const { data: specData } = await supabase.from("specs").select("*").eq("id", id).single();
  if (!specData) notFound();
  const spec = specData;

  // Fetch category
  const { data: catData } = spec.category_id
    ? await supabase.from("spec_categories").select("*").eq("id", spec.category_id).single()
    : { data: null };

  // Fetch template fields
  const { data: fieldsData } = await supabase
    .from("spec_template_fields")
    .select("*")
    .eq("template_id", spec.template_id)
    .order("order_index");
  const fields = fieldsData ?? [];

  // Fetch existing field values
  const { data: valuesData } = await supabase
    .from("spec_field_values")
    .select("*")
    .eq("spec_id", id);
  const values = valuesData ?? [];
  const valueMap: Record<string, string> = Object.fromEntries(
    values.filter((v) => v.value != null).map((v) => [v.template_field_id, v.value as string])
  );

  // Fetch existing tags
  const { data: tagsData } = await supabase
    .from("spec_tags").select("tag").eq("spec_id", id);
  const tags = (tagsData ?? []).map((t) => t.tag);

  // Fetch existing suppliers via junction
  const { data: specSupData } = await supabase
    .from("spec_suppliers")
    .select("supplier_id, supplier_code, unit_cost")
    .eq("spec_id", id);

  const existingSupplierJunction = specSupData?.[0] ?? null;

  // Fetch all studio companies (as suppliers) from contact_companies
  const { data: allSuppliersData } = await supabase
    .from("contact_companies")
    .select("id, name, website")
    .eq("studio_id", studioId)
    .order("name");

  return (
    <AppShell>
      <EditSpecClient
        spec={spec}
        category={catData}
        fields={fields}
        valueMap={valueMap}
        initialTags={tags}
        existingSupplierJunction={existingSupplierJunction}
        suppliers={allSuppliersData ?? []}
      />
    </AppShell>
  );
}
