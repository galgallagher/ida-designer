"use server";

/**
 * Server actions for /settings/schedules — studio schedule type configuration.
 *
 * Studios can control system schedule types (hide/rename/reorder) and create
 * their own custom ones. All backed by studio_spec_preferences.
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

// ── Save all preferences (system types) ──────────────────────────────────────

export async function saveSchedulePreferences(
  preferences: {
    item_type: string;
    is_visible: boolean;
    display_name: string | null;
    sort_order: number;
    is_custom: boolean;
  }[]
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const rows = preferences.map((p) => ({
    studio_id: studioId,
    item_type: p.item_type,
    is_visible: p.is_visible,
    display_name: p.display_name?.trim() || null,
    sort_order: p.sort_order,
    is_custom: p.is_custom,
  }));

  const { error: dbError } = await supabase
    .from("studio_spec_preferences")
    .upsert(rows, { onConflict: "studio_id,item_type" });

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/schedules");
  return { error: null };
}

// ── Create custom schedule ─────────────────────────────────────────────────────

export async function createCustomSchedule(
  name: string,
  sortOrder: number
): Promise<{ error: string | null; itemType: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised.", itemType: null };

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Schedule name is required.", itemType: null };

  // Use a UUID as the key — opaque, unique, safe for open-ended custom values
  const { randomUUID } = await import("crypto");
  const itemType = randomUUID();

  const { error: dbError } = await supabase.from("studio_spec_preferences").insert({
    studio_id: studioId,
    item_type: itemType,
    display_name: trimmedName,
    is_visible: true,
    is_custom: true,
    sort_order: sortOrder,
  });

  if (dbError) return { error: dbError.message, itemType: null };

  revalidatePath("/settings/schedules");
  return { error: null, itemType };
}

// ── Delete custom schedule ────────────────────────────────────────────────────

export async function deleteCustomSchedule(
  itemType: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Only allow deleting custom schedules, never system ones
  const { data: pref } = await supabase
    .from("studio_spec_preferences")
    .select("is_custom")
    .eq("studio_id", studioId)
    .eq("item_type", itemType)
    .single();

  if (!pref?.is_custom) return { error: "System schedule types cannot be deleted." };

  // Check if any project specs use this custom schedule
  const { count } = await supabase
    .from("project_specs")
    .select("*", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("item_type", itemType);

  if (count && count > 0) {
    return { error: `This schedule is used by ${count} spec item${count === 1 ? "" : "s"} — remove those first.` };
  }

  const { error: dbError } = await supabase
    .from("studio_spec_preferences")
    .delete()
    .eq("studio_id", studioId)
    .eq("item_type", itemType);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/schedules");
  return { error: null };
}
