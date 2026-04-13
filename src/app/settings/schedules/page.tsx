/**
 * Schedule Types — /settings/schedules
 *
 * Studio admins can control which spec schedule types appear in projects,
 * rename them with studio-specific labels, and reorder them.
 * Uses studio_spec_preferences (migration 030).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import SchedulesClient from "./SchedulesClient";
import type { SpecItemType } from "@/types/database";

// All schedule types the platform supports, with their default labels
export const DEFAULT_SCHEDULE_TYPES: { type: SpecItemType; label: string }[] = [
  { type: "ffe",             label: "FF&E" },
  { type: "joinery",        label: "Joinery" },
  { type: "ironmongery",    label: "Ironmongery" },
  { type: "sanitaryware",   label: "Sanitaryware" },
  { type: "arch_id_finishes", label: "Arch ID Finishes" },
  { type: "joinery_finishes", label: "Joinery Finishes" },
  { type: "ffe_finishes",   label: "FF&E Finishes" },
];

export default async function SchedulesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch existing preferences for this studio
  const { data: prefsData } = await supabase
    .from("studio_spec_preferences")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const savedPrefs = prefsData ?? [];

  // Merge defaults with saved prefs: if a type has been saved, use that;
  // otherwise use the default (visible, default label, default order).
  const prefMap = new Map(savedPrefs.map((p) => [p.item_type, p]));

  const mergedPrefs = DEFAULT_SCHEDULE_TYPES.map((def, index) => {
    const saved = prefMap.get(def.type);
    return {
      item_type: def.type,
      default_label: def.label,
      display_name: saved?.display_name ?? null,
      is_visible: saved?.is_visible ?? true,
      sort_order: saved?.sort_order ?? index,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <AppShell>
      <SchedulesClient preferences={mergedPrefs} />
    </AppShell>
  );
}
