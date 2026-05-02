/**
 * Add to Spec Library — /specs/new
 *
 * Multi-step form:
 *   Step 1 — Pick a category (shows template)
 *   Step 2 — Fill in name, template fields, cost, tags, supplier
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import NewSpecClient from "./NewSpecClient";
import type { LibraryCategoryRow } from "@/types/database";

export default async function NewSpecPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/specs");

  // Fetch categories
  const { data: categoriesData } = await supabase
    .from("library_categories")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("sort_order");

  // Fetch templates (maps to categories by name — studio's own templates)
  const { data: templatesData } = await supabase
    .from("library_templates")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("name");

  // Fetch all template fields
  const templates = templatesData ?? [];
  const { data: fieldsData } = await supabase
    .from("library_template_fields")
    .select("*")
    .in("template_id", templates.map((t) => t.id))
    .order("order_index");

  const fields = fieldsData ?? [];
  const fieldsByTemplate: Record<string, typeof fields> = {};
  for (const field of fields) {
    (fieldsByTemplate[field.template_id] ??= []).push(field);
  }

  // Fetch companies (as suppliers) from contact_companies
  const { data: suppliersData } = await supabase
    .from("contact_companies")
    .select("id, name, website")
    .eq("studio_id", studioId)
    .order("name");

  return (
    <AppShell>
      <NewSpecClient
        categories={categoriesData ?? []}
        templates={templates}
        fieldsByTemplate={fieldsByTemplate}
        suppliers={suppliersData ?? []}
      />
    </AppShell>
  );
}
