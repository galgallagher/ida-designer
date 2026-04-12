"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

// ── createSpec ────────────────────────────────────────────────────────────────

export type CreateSpecResult = { success: true; specId: string } | { error: string };

export async function createSpec(formData: FormData): Promise<CreateSpecResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const template_id = (formData.get("template_id") as string | null)?.trim() ?? "";
  if (!template_id) return { error: "Please select a category template." };

  const category_id = (formData.get("category_id") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const cost_from = parseFloat(formData.get("cost_from") as string) || null;
  const cost_to = parseFloat(formData.get("cost_to") as string) || null;
  const cost_unit = (formData.get("cost_unit") as string | null)?.trim() || null;

  const imageUrlInput = (formData.get("image_url") as string | null)?.trim() || null;
  const imageFile = formData.get("image_file");
  const hasNewFile = imageFile instanceof File && imageFile.size > 0;

  if (hasNewFile && (imageFile as File).size > 2 * 1024 * 1024) {
    return { error: "Image file must be under 2 MB. Try pasting an image URL instead." };
  }

  // ── Create spec ────────────────────────────────────────────────────────────
  const { data: newSpec, error: specError } = await supabase
    .from("specs")
    .insert({ studio_id: studioId, template_id, category_id, name, description, cost_from, cost_to, cost_unit, image_url: imageUrlInput, image_path: null })
    .select("id")
    .single();

  if (specError || !newSpec) {
    console.error("[createSpec]", specError);
    return { error: "Failed to save spec. Please try again." };
  }

  const specId = newSpec.id;

  // ── Upload image file if provided (needs specId for the storage path) ──────
  if (hasNewFile) {
    const file = imageFile as File;
    const path = `${studioId}/${specId}`;
    const { error: uploadError } = await supabase.storage
      .from("spec-images")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      console.error("[createSpec] image upload failed", uploadError);
      return { error: "Spec saved but image upload failed. Try editing the spec to add the image again." };
    }
    const { data: urlData } = supabase.storage.from("spec-images").getPublicUrl(path);
    await supabase.from("specs")
      .update({ image_url: urlData.publicUrl, image_path: path })
      .eq("id", specId);
  }

  // ── Save field values ──────────────────────────────────────────────────────
  const fieldEntries: { spec_id: string; template_field_id: string; value: string }[] = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("field_") && typeof val === "string" && val.trim()) {
      const fieldId = key.replace("field_", "");
      fieldEntries.push({ spec_id: specId, template_field_id: fieldId, value: val.trim() });
    }
  }
  if (fieldEntries.length > 0) {
    await supabase.from("spec_field_values").insert(fieldEntries);
  }

  // ── Save tags ──────────────────────────────────────────────────────────────
  const tagsRaw = (formData.get("tags") as string | null)?.trim() ?? "";
  if (tagsRaw) {
    const tags = tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length > 0) {
      await supabase.from("spec_tags").insert(tags.map((tag) => ({ spec_id: specId, tag })));
    }
  }

  // ── Link supplier ──────────────────────────────────────────────────────────
  const supplierId = (formData.get("supplier_id") as string | null)?.trim() || null;
  const supplierCode = (formData.get("supplier_code") as string | null)?.trim() || null;
  const unitCost = parseFloat(formData.get("unit_cost") as string) || null;

  if (supplierId) {
    await supabase.from("spec_suppliers").insert({
      spec_id: specId, supplier_id: supplierId, supplier_code: supplierCode, unit_cost: unitCost,
    });
  }

  // ── Create new company inline if needed ───────────────────────────────────
  const newSupplierName = (formData.get("new_supplier_name") as string | null)?.trim();
  if (newSupplierName) {
    const { data: newSup } = await supabase
      .from("contact_companies")
      .insert({
        studio_id: studioId,
        name: newSupplierName,
        website: (formData.get("new_supplier_website") as string | null)?.trim() || null,
        email: (formData.get("new_supplier_email") as string | null)?.trim() || null,
        phone: (formData.get("new_supplier_phone") as string | null)?.trim() || null,
        category_id: null, street: null, city: null, country: null, notes: null,
      })
      .select("id")
      .single();

    if (newSup) {
      await supabase.from("spec_suppliers").insert({
        spec_id: specId, supplier_id: newSup.id,
        supplier_code: supplierCode, unit_cost: unitCost,
      });
    }
  }

  revalidatePath("/specs");
  redirect(`/specs/${specId}`);
}

// ── updateSpec ────────────────────────────────────────────────────────────────

export type UpdateSpecResult = { success: true } | { error: string };

export async function updateSpec(specId: string, formData: FormData): Promise<UpdateSpecResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const description = (formData.get("description") as string | null)?.trim() || null;
  const cost_from = parseFloat(formData.get("cost_from") as string) || null;
  const cost_to = parseFloat(formData.get("cost_to") as string) || null;
  const cost_unit = (formData.get("cost_unit") as string | null)?.trim() || null;

  // ── Resolve image (file takes priority over URL field) ────────────────────
  const imageUrlInput = (formData.get("image_url") as string | null)?.trim() || null;
  const existingImagePath = (formData.get("image_path") as string | null)?.trim() || null;
  const imageFile = formData.get("image_file");
  const hasNewFile = imageFile instanceof File && imageFile.size > 0;

  if (hasNewFile && (imageFile as File).size > 2 * 1024 * 1024) {
    return { error: "Image file must be under 2 MB. Try pasting an image URL instead." };
  }

  let finalImageUrl: string | null = imageUrlInput;
  let finalImagePath: string | null = existingImagePath;

  if (hasNewFile) {
    const file = imageFile as File;
    const studioId = await getCurrentStudioId();
    if (studioId) {
      const path = `${studioId}/${specId}`;
      const { error: uploadError } = await supabase.storage
        .from("spec-images")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        console.error("[updateSpec] image upload failed", uploadError);
        return { error: "Changes saved but image upload failed. Try uploading the image again." };
      }
      const { data: urlData } = supabase.storage.from("spec-images").getPublicUrl(path);
      finalImageUrl = urlData.publicUrl;
      finalImagePath = path;
    }
  }

  // ── Update core spec row ───────────────────────────────────────────────────
  const { error: specError } = await supabase
    .from("specs")
    .update({ name, description, cost_from, cost_to, cost_unit, image_url: finalImageUrl, image_path: finalImagePath })
    .eq("id", specId);

  if (specError) {
    console.error("[updateSpec]", specError);
    return { error: "Failed to update spec. Please try again." };
  }

  // ── Replace field values ───────────────────────────────────────────────────
  await supabase.from("spec_field_values").delete().eq("spec_id", specId);

  const fieldEntries: { spec_id: string; template_field_id: string; value: string }[] = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("field_") && typeof val === "string" && val.trim()) {
      const fieldId = key.replace("field_", "");
      fieldEntries.push({ spec_id: specId, template_field_id: fieldId, value: val.trim() });
    }
  }
  if (fieldEntries.length > 0) {
    await supabase.from("spec_field_values").insert(fieldEntries);
  }

  // ── Replace tags ───────────────────────────────────────────────────────────
  await supabase.from("spec_tags").delete().eq("spec_id", specId);

  const tagsRaw = (formData.get("tags") as string | null)?.trim() ?? "";
  if (tagsRaw) {
    const tags = tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length > 0) {
      await supabase.from("spec_tags").insert(tags.map((tag) => ({ spec_id: specId, tag })));
    }
  }

  // ── Replace suppliers ──────────────────────────────────────────────────────
  const supplierMode = (formData.get("supplier_mode") as string | null) ?? "none";
  await supabase.from("spec_suppliers").delete().eq("spec_id", specId);

  if (supplierMode === "existing") {
    const supplierId = (formData.get("supplier_id") as string | null)?.trim() || null;
    const supplierCode = (formData.get("supplier_code") as string | null)?.trim() || null;
    const unitCost = parseFloat(formData.get("unit_cost") as string) || null;
    if (supplierId) {
      await supabase.from("spec_suppliers").insert({
        spec_id: specId, supplier_id: supplierId, supplier_code: supplierCode, unit_cost: unitCost,
      });
    }
  } else if (supplierMode === "new") {
    const studioId = await getCurrentStudioId();
    const newSupplierName = (formData.get("new_supplier_name") as string | null)?.trim();
    if (newSupplierName && studioId) {
      const { data: newSup } = await supabase
        .from("contact_companies")
        .insert({
          studio_id: studioId,
          name: newSupplierName,
          website: (formData.get("new_supplier_website") as string | null)?.trim() || null,
          email: (formData.get("new_supplier_email") as string | null)?.trim() || null,
          phone: (formData.get("new_supplier_phone") as string | null)?.trim() || null,
          category_id: null, street: null, city: null, country: null, notes: null,
        })
        .select("id")
        .single();

      if (newSup) {
        const supplierCode = (formData.get("supplier_code") as string | null)?.trim() || null;
        const unitCost = parseFloat(formData.get("unit_cost") as string) || null;
        await supabase.from("spec_suppliers").insert({
          spec_id: specId, supplier_id: newSup.id, supplier_code: supplierCode, unit_cost: unitCost,
        });
      }
    }
  }

  revalidatePath(`/specs/${specId}`);
  revalidatePath("/specs");
  redirect(`/specs/${specId}`);
}

// ── getSpecDetail ─────────────────────────────────────────────────────────────

export interface SpecDetailData {
  spec: {
    id: string; name: string; description: string | null; image_url: string | null;
    source_url: string | null; template_id: string; category_id: string | null;
    cost_from: number | null; cost_to: number | null; cost_unit: string | null; created_at: string;
  };
  category: { id: string; name: string } | null;
  fields: { id: string; name: string; field_type: string; order_index: number }[];
  valueMap: Record<string, string>;
  tags: string[];
  suppliers: {
    id: string; name: string; website: string | null;
    supplier_code: string | null; unit_cost: number | null;
  }[];
  projects: { id: string; name: string; code: string | null }[];
}

export async function getSpecDetail(id: string): Promise<SpecDetailData | null> {
  const supabase = await createClient();

  const { data: spec } = await supabase.from("specs").select("*").eq("id", id).single();
  if (!spec) return null;

  // Category
  const { data: catData } = spec.category_id
    ? await supabase.from("spec_categories").select("id, name").eq("id", spec.category_id).single()
    : { data: null };

  // Template fields
  const { data: fieldsData } = await supabase
    .from("spec_template_fields").select("id, name, field_type, order_index")
    .eq("template_id", spec.template_id).order("order_index");

  // Field values
  const { data: valuesData } = await supabase.from("spec_field_values").select("*").eq("spec_id", id);
  const valueMap: Record<string, string> = Object.fromEntries(
    (valuesData ?? []).filter((v) => v.value != null).map((v) => [v.template_field_id, v.value!])
  );

  // Tags
  const { data: tagsData } = await supabase.from("spec_tags").select("tag").eq("spec_id", id);
  const tags: string[] = (tagsData ?? []).map((t) => t.tag);

  // Suppliers via junction
  const { data: specSupData } = await supabase
    .from("spec_suppliers").select("supplier_id, supplier_code, unit_cost").eq("spec_id", id);
  const supplierIds = (specSupData ?? []).map((s) => s.supplier_id);
  let suppliers: SpecDetailData["suppliers"] = [];
  if (supplierIds.length > 0) {
    const { data: supData } = await supabase
      .from("contact_companies").select("id, name, website").in("id", supplierIds);
    suppliers = (supData ?? []).map((sup) => {
      const junc = (specSupData ?? []).find((s) => s.supplier_id === sup.id);
      return { ...sup, supplier_code: junc?.supplier_code ?? null, unit_cost: junc?.unit_cost ?? null };
    });
  }

  // Projects
  const { data: projectSpecData } = await supabase
    .from("project_specs").select("project_id").eq("spec_id", id);
  const projectIds = (projectSpecData ?? []).map((p) => p.project_id);
  let projects: SpecDetailData["projects"] = [];
  if (projectIds.length > 0) {
    const { data: projData } = await supabase.from("projects").select("id, name, code").in("id", projectIds);
    projects = projData ?? [];
  }

  return {
    spec: {
      id: spec.id, name: spec.name, description: spec.description ?? null,
      image_url: spec.image_url ?? null, source_url: spec.source_url ?? null,
      template_id: spec.template_id, category_id: spec.category_id ?? null,
      cost_from: spec.cost_from ?? null, cost_to: spec.cost_to ?? null,
      cost_unit: spec.cost_unit ?? null, created_at: spec.created_at,
    },
    category: catData ?? null,
    fields: fieldsData ?? [],
    valueMap,
    tags,
    suppliers,
    projects,
  };
}

// ── deleteSpec ────────────────────────────────────────────────────────────────

export async function deleteSpec(specId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  // Verify ownership — only delete specs belonging to this studio
  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", specId)
    .eq("studio_id", studioId)
    .single();
  if (!spec) return { error: "Spec not found." };

  // Block deletion if this spec is used in any project
  const { count } = await supabase
    .from("project_specs")
    .select("*", { count: "exact", head: true })
    .eq("spec_id", specId);

  if (count && count > 0) {
    return {
      error: `This spec is used in ${count} project${count === 1 ? "" : "s"} — remove it from those projects first.`,
    };
  }

  // Delete related rows first (in case DB doesn't cascade)
  await Promise.all([
    supabase.from("spec_field_values").delete().eq("spec_id", specId),
    supabase.from("spec_tags").delete().eq("spec_id", specId),
    supabase.from("spec_suppliers").delete().eq("spec_id", specId),
  ]);

  const { error } = await supabase.from("specs").delete().eq("id", specId);
  if (error) return { error: "Failed to delete spec." };

  revalidatePath("/specs");
  return {};
}
