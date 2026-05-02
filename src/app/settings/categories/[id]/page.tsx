/**
 * Settings → Category Fields — /settings/categories/[id]
 *
 * Shows and manages the template fields for a single spec category.
 * Studio admins can add, edit, reorder, and delete fields from here.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import FieldsClient from "./FieldsClient";
import type { LibraryTemplateFieldRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryFieldsPage({ params }: PageProps) {
  const { id: categoryId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the category
  const { data: catData } = await supabase
    .from("library_categories")
    .select("*")
    .eq("id", categoryId)
    .eq("studio_id", studioId)
    .single();

  if (!catData) notFound();

  // If no template exists yet, create one on the fly
  let templateId = catData.template_id;
  if (!templateId) {
    const { data: newTemplate } = await supabase
      .from("library_templates")
      .insert({ studio_id: studioId, name: catData.name, is_active: true })
      .select("id")
      .single();

    if (newTemplate) {
      templateId = newTemplate.id;
      await supabase
        .from("library_categories")
        .update({ template_id: templateId })
        .eq("id", categoryId);
    }
  }

  if (!templateId) notFound();

  // Fetch the template fields
  const { data: fieldsData } = await supabase
    .from("library_template_fields")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index");

  const fields = fieldsData ?? [];

  // Fetch parent name if this is a sub-category
  let parentName: string | null = null;
  if (catData.parent_id) {
    const { data: parentData } = await supabase
      .from("library_categories").select("name").eq("id", catData.parent_id).single();
    parentName = parentData?.name ?? null;
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 720 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          <span>Settings</span>
          <span>/</span>
          <Link href="/settings/categories" className="flex items-center gap-1 hover:text-[#1A1A1A] transition-colors" style={{ color: "#9A9590", textDecoration: "none" }}>
            <ArrowLeft size={11} /> Spec Categories
          </Link>
          {parentName && (
            <>
              <span>/</span>
              <span>{parentName}</span>
            </>
          )}
          <span>/</span>
          <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{catData.name}</span>
        </div>

        {/* Category identity */}
        <div className="mb-8 pb-6" style={{ borderBottom: "1px solid #E4E1DC" }}>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 24, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            {catData.name}
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {catData.is_active ? "Active" : "Inactive"} · {parentName ? `Sub-category of ${parentName}` : "Top-level category"}
          </p>
        </div>

        {/* Field editor */}
        <FieldsClient
          categoryId={categoryId}
          categoryName={catData.name}
          templateId={templateId}
          fields={fields}
        />
      </div>
    </AppShell>
  );
}
