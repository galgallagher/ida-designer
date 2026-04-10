"use server";

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";
import type { FieldType } from "@/types/database";

type Result = { error?: string };

function revalidateAll(categoryId: string) {
  revalidatePath(`/settings/categories/${categoryId}`);
  revalidatePath("/settings/categories");
  revalidatePath("/specs");
  revalidatePath("/specs/new");
}

// ── createField ───────────────────────────────────────────────────────────────

export async function createField(templateId: string, categoryId: string, formData: FormData): Promise<Result> {
  const { error, supabase } = await adminGuard();
  if (error || !supabase) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Field name is required." };

  const field_type = (formData.get("field_type") as FieldType | null) ?? "text";
  const is_required = formData.get("is_required") === "true";
  const ai_hint = (formData.get("ai_hint") as string | null)?.trim() || null;

  // Parse options for select fields
  const optionsRaw = (formData.get("options") as string | null)?.trim() ?? "";
  const options = field_type === "select" && optionsRaw
    ? optionsRaw.split("\n").map((o) => o.trim()).filter(Boolean)
    : null;

  // Get next order_index
  const { data: last } = await supabase
    .from("spec_template_fields")
    .select("order_index")
    .eq("template_id", templateId)
    .order("order_index", { ascending: false })
    .limit(1)
    .single();

  const order_index = (last?.order_index ?? 0) + 1;

  const { error: insertError } = await supabase
    .from("spec_template_fields")
    .insert({ template_id: templateId, name, field_type, is_required, order_index, ai_hint, options });

  if (insertError) {
    console.error("[createField]", insertError);
    return { error: "Failed to create field." };
  }

  revalidateAll(categoryId);
  return {};
}

// ── updateField ───────────────────────────────────────────────────────────────

export async function updateField(fieldId: string, categoryId: string, formData: FormData): Promise<Result> {
  const { error, supabase } = await adminGuard();
  if (error || !supabase) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Field name is required." };

  const field_type = (formData.get("field_type") as FieldType | null) ?? "text";
  const is_required = formData.get("is_required") === "true";
  const ai_hint = (formData.get("ai_hint") as string | null)?.trim() || null;

  const optionsRaw = (formData.get("options") as string | null)?.trim() ?? "";
  const options = field_type === "select" && optionsRaw
    ? optionsRaw.split("\n").map((o) => o.trim()).filter(Boolean)
    : null;

  const { error: updateError } = await supabase
    .from("spec_template_fields")
    .update({ name, field_type, is_required, ai_hint, options })
    .eq("id", fieldId);

  if (updateError) {
    console.error("[updateField]", updateError);
    return { error: "Failed to update field." };
  }

  revalidateAll(categoryId);
  return {};
}

// ── deleteField ───────────────────────────────────────────────────────────────

export async function deleteField(fieldId: string, categoryId: string): Promise<Result> {
  const { error, supabase } = await adminGuard();
  if (error || !supabase) return { error: error ?? "Unknown error." };

  const { error: deleteError } = await supabase
    .from("spec_template_fields")
    .delete()
    .eq("id", fieldId);

  if (deleteError) return { error: "Failed to delete field." };

  revalidateAll(categoryId);
  return {};
}

// ── moveField ─────────────────────────────────────────────────────────────────

export async function moveField(
  fieldId: string,
  templateId: string,
  categoryId: string,
  direction: "up" | "down"
): Promise<Result> {
  const { error, supabase } = await adminGuard();
  if (error || !supabase) return { error: error ?? "Unknown error." };

  const { data: field } = await supabase
    .from("spec_template_fields")
    .select("id, order_index")
    .eq("id", fieldId)
    .single();

  if (!field) return { error: "Field not found." };

  const { data: sibling } = await supabase
    .from("spec_template_fields")
    .select("id, order_index")
    .eq("template_id", templateId)
    .filter("order_index", direction === "up" ? "lt" : "gt", field.order_index)
    .order("order_index", { ascending: direction !== "up" })
    .limit(1)
    .single();

  if (!sibling) return {};

  await supabase.from("spec_template_fields").update({ order_index: sibling.order_index }).eq("id", field.id);
  await supabase.from("spec_template_fields").update({ order_index: field.order_index }).eq("id", sibling.id);

  revalidateAll(categoryId);
  return {};
}
