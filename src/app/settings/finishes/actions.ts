"use server";

/**
 * Server actions for /settings/finishes — studio finish palette management.
 * All mutations are admin/owner-only via adminGuard().
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

// ── Create ────────────────────────────────────────────────────────────────────

export async function createFinish(payload: {
  code: string;
  name: string;
  description: string | null;
  colour_hex: string | null;
}): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const code = payload.code.trim().toUpperCase();
  if (!code) return { error: "Finish code is required." };
  if (!payload.name.trim()) return { error: "Finish name is required." };

  const { error: dbError } = await supabase.from("studio_finishes").insert({
    studio_id: studioId,
    code,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    colour_hex: payload.colour_hex?.trim() || null,
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: `Finish code "${code}" already exists.` };
    return { error: dbError.message };
  }

  revalidatePath("/settings/finishes");
  return { error: null };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateFinish(
  id: string,
  payload: {
    code: string;
    name: string;
    description: string | null;
    colour_hex: string | null;
  }
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const code = payload.code.trim().toUpperCase();
  if (!code) return { error: "Finish code is required." };
  if (!payload.name.trim()) return { error: "Finish name is required." };

  const { error: dbError } = await supabase
    .from("studio_finishes")
    .update({
      code,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      colour_hex: payload.colour_hex?.trim() || null,
    })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (dbError) {
    if (dbError.code === "23505") return { error: `Finish code "${code}" already exists.` };
    return { error: dbError.message };
  }

  revalidatePath("/settings/finishes");
  return { error: null };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteFinish(id: string): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Check if finish is assigned to any drawings before deleting
  const { count } = await supabase
    .from("drawing_finishes")
    .select("*", { count: "exact", head: true })
    .eq("studio_finish_id", id);

  if (count && count > 0) {
    return { error: `This finish is assigned to ${count} drawing${count === 1 ? "" : "s"} — remove it from those drawings first.` };
  }

  const { error: dbError } = await supabase
    .from("studio_finishes")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/finishes");
  return { error: null };
}
