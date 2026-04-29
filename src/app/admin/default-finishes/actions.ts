"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MaterialCategory } from "@/types/database";

const VALID_CATEGORIES: MaterialCategory[] = ["wood", "stone", "metal", "glass", "concrete"];

// Guard: only super_admins may run any of these
async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profile?.platform_role !== "super_admin") throw new Error("Forbidden — super_admin only.");
  return supabase;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createDefaultFinish(formData: FormData): Promise<{ error: string | null; id?: string }> {
  const name = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() as MaterialCategory;
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name) return { error: "Name is required." };
  if (!VALID_CATEGORIES.includes(category)) return { error: "Invalid category." };

  const supabase = await requireSuperAdmin();

  const { data: last } = await supabase
    .from("default_finishes")
    .select("sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sort_order = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("default_finishes")
    .insert({ name, category, description, sort_order })
    .select("id")
    .single();

  if (error || !data) return { error: "Failed to create finish." };
  revalidatePath("/admin/default-finishes");
  return { error: null, id: data.id };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateDefaultFinish(id: string, formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() as MaterialCategory;
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name) return { error: "Name is required." };
  if (!VALID_CATEGORIES.includes(category)) return { error: "Invalid category." };

  const supabase = await requireSuperAdmin();

  const { error } = await supabase
    .from("default_finishes")
    .update({ name, category, description })
    .eq("id", id);

  if (error) return { error: "Failed to update finish." };
  revalidatePath("/admin/default-finishes");
  return { error: null };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteDefaultFinish(id: string) {
  const supabase = await requireSuperAdmin();

  const { data: finish } = await supabase
    .from("default_finishes")
    .select("image_path")
    .eq("id", id)
    .single();

  if (finish?.image_path) {
    await supabase.storage.from("material-images").remove([finish.image_path]);
  }

  const { error } = await supabase
    .from("default_finishes")
    .delete()
    .eq("id", id);

  if (error) return { error: "Failed to delete finish." };
  revalidatePath("/admin/default-finishes");
  return { error: null };
}

// ── Upload image ───────────────────────────────────────────────────────────────

export async function uploadDefaultFinishImage(finishId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image must be under 4 MB." };

  const supabase = await requireSuperAdmin();

  const { data: finish } = await supabase
    .from("default_finishes")
    .select("id, image_path")
    .eq("id", finishId)
    .single();

  if (!finish) return { error: "Finish not found." };

  if (finish.image_path) {
    await supabase.storage.from("material-images").remove([finish.image_path]);
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `_defaults/${finishId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("material-images")
    .upload(path, file, { upsert: true });

  if (uploadError) return { error: "Image upload failed." };

  const { data: urlData } = supabase.storage.from("material-images").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("default_finishes")
    .update({ image_url: urlData.publicUrl, image_path: path })
    .eq("id", finishId);

  if (updateError) return { error: "Failed to save image URL." };

  revalidatePath("/admin/default-finishes");
  return { error: null, imageUrl: urlData.publicUrl };
}

// ── One-shot: copy current defaults to existing studios ────────────────────────

export async function copyDefaultsToAllStudios() {
  const supabase = await requireSuperAdmin();

  const [{ data: defaults }, { data: studios }] = await Promise.all([
    supabase.from("default_finishes").select("*"),
    supabase.from("studios").select("id"),
  ]);

  if (!defaults || !studios) return { error: "Failed to load data." };
  if (defaults.length === 0) return { error: "No defaults to copy.", copied: 0 };

  const rows = studios.flatMap((s) =>
    defaults.map((d) => ({
      studio_id: s.id,
      category: d.category,
      name: d.name,
      description: d.description,
      image_url: d.image_url,
      image_path: d.image_path,
      sort_order: d.sort_order,
    })),
  );

  const { error } = await supabase.from("studio_materials").insert(rows);
  if (error) return { error: "Failed to copy: " + error.message };

  return { error: null, copied: rows.length, studios: studios.length };
}
