"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { MaterialCategory } from "@/types/database";

const VALID_CATEGORIES: MaterialCategory[] = ["wood", "stone", "metal", "glass", "concrete"];

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createMaterial(formData: FormData) {
  const name     = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() as MaterialCategory;
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name)                              return { error: "Name is required." };
  if (!VALID_CATEGORIES.includes(category)) return { error: "Invalid category." };

  const supabase  = await createClient();
  const studioId  = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  // Place at end of category list
  const { data: last } = await supabase
    .from("studio_materials")
    .select("sort_order")
    .eq("studio_id", studioId)
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sort_order = (last?.sort_order ?? 0) + 1;

  const { error } = await supabase
    .from("studio_materials")
    .insert({ studio_id: studioId, name, category, description, sort_order });

  if (error) return { error: "Failed to create material." };

  revalidatePath("/finishes");
  return { error: null };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateMaterial(id: string, formData: FormData) {
  const name     = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() as MaterialCategory;
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name)                              return { error: "Name is required." };
  if (!VALID_CATEGORIES.includes(category)) return { error: "Invalid category." };

  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  const { error } = await supabase
    .from("studio_materials")
    .update({ name, category, description })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (error) return { error: "Failed to update material." };

  revalidatePath("/finishes");
  return { error: null };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteMaterial(id: string) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  // Fetch the image_path first so we can clean up storage
  const { data: material } = await supabase
    .from("studio_materials")
    .select("image_path")
    .eq("id", id)
    .eq("studio_id", studioId)
    .single();

  if (material?.image_path) {
    await supabase.storage.from("material-images").remove([material.image_path]);
  }

  const { error } = await supabase
    .from("studio_materials")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (error) return { error: "Failed to delete material." };

  revalidatePath("/finishes");
  return { error: null };
}

// ── Upload image ───────────────────────────────────────────────────────────────

export async function uploadMaterialImage(materialId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };

  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 4 * 1024 * 1024)     return { error: "Image must be under 4 MB." };

  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found." };

  // Verify the material belongs to this studio
  const { data: material } = await supabase
    .from("studio_materials")
    .select("id, image_path")
    .eq("id", materialId)
    .eq("studio_id", studioId)
    .single();

  if (!material) return { error: "Material not found." };

  // Delete previous image if present
  if (material.image_path) {
    await supabase.storage.from("material-images").remove([material.image_path]);
  }

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${studioId}/${materialId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("material-images")
    .upload(path, file, { upsert: true });

  if (uploadError) return { error: "Image upload failed." };

  const { data: urlData } = supabase.storage.from("material-images").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("studio_materials")
    .update({
      image_url:  urlData.publicUrl,
      image_path: path,
    })
    .eq("id", materialId)
    .eq("studio_id", studioId);

  if (updateError) return { error: "Failed to save image URL." };

  revalidatePath("/finishes");
  return { error: null, imageUrl: urlData.publicUrl };
}
