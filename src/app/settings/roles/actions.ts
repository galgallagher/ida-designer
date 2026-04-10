"use server";

/**
 * Server actions for /settings/roles — studio job title management.
 * All mutations are admin/owner-only via adminGuard().
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

// ── Create ────────────────────────────────────────────────────────────────────

export async function createStudioRole(formData: FormData): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Role name is required." };

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("studio_roles")
    .select("sort_order")
    .eq("studio_id", studioId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error: dbError } = await supabase
    .from("studio_roles")
    .insert({ studio_id: studioId, name, sort_order: nextOrder });

  if (dbError) {
    if (dbError.code === "23505") return { error: "A role with that name already exists." };
    return { error: dbError.message };
  }

  revalidatePath("/settings/roles");
  return { error: null };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateStudioRole(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Role name is required." };

  const { error: dbError } = await supabase
    .from("studio_roles")
    .update({ name })
    .eq("id", id)
    .eq("studio_id", studioId);

  if (dbError) {
    if (dbError.code === "23505") return { error: "A role with that name already exists." };
    return { error: dbError.message };
  }

  revalidatePath("/settings/roles");
  return { error: null };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteStudioRole(id: string): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // ON DELETE SET NULL handles the studio_members.studio_role_id FK
  const { error: dbError } = await supabase
    .from("studio_roles")
    .delete()
    .eq("id", id)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/roles");
  revalidatePath("/settings/members");
  return { error: null };
}

// ── Reorder ───────────────────────────────────────────────────────────────────

export async function moveStudioRole(
  id: string,
  direction: "up" | "down"
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { data: roles } = await supabase
    .from("studio_roles")
    .select("id, sort_order")
    .eq("studio_id", studioId)
    .order("sort_order");

  if (!roles) return { error: "Could not load roles." };

  const idx = roles.findIndex((r) => r.id === id);
  if (idx === -1) return { error: "Role not found." };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= roles.length) return { error: null }; // already at edge

  const current = roles[idx];
  const swap = roles[swapIdx];

  await Promise.all([
    supabase.from("studio_roles").update({ sort_order: swap.sort_order }).eq("id", current.id),
    supabase.from("studio_roles").update({ sort_order: current.sort_order }).eq("id", swap.id),
  ]);

  revalidatePath("/settings/roles");
  return { error: null };
}
