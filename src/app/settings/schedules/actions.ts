"use server";

/**
 * Server actions for /settings/schedules — studio schedule type preferences.
 *
 * Controls which spec schedule types are visible in projects, their display
 * names, and sort order. Uses studio_spec_preferences table.
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";
import type { SpecItemType } from "@/types/database";

// ── Upsert a single preference ────────────────────────────────────────────────

export async function upsertSchedulePreference(payload: {
  item_type: SpecItemType;
  is_visible: boolean;
  display_name: string | null;
  sort_order: number;
}): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("studio_spec_preferences")
    .upsert(
      {
        studio_id: studioId,
        item_type: payload.item_type,
        is_visible: payload.is_visible,
        display_name: payload.display_name?.trim() || null,
        sort_order: payload.sort_order,
      },
      { onConflict: "studio_id,item_type" }
    );

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/schedules");
  return { error: null };
}

// ── Save all preferences at once (full replace) ───────────────────────────────

export async function saveAllSchedulePreferences(
  preferences: {
    item_type: SpecItemType;
    is_visible: boolean;
    display_name: string | null;
    sort_order: number;
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
  }));

  const { error: dbError } = await supabase
    .from("studio_spec_preferences")
    .upsert(rows, { onConflict: "studio_id,item_type" });

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/schedules");
  revalidatePath("/projects");
  return { error: null };
}
