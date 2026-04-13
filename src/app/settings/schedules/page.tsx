/**
 * Schedule Types — /settings/schedules
 *
 * Studios can hide, rename and reorder system schedule types, and create
 * their own custom ones. Uses studio_spec_preferences as the source of truth.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import SchedulesClient, { type ScheduleRow } from "./SchedulesClient";
import { SYSTEM_SCHEDULES, SYSTEM_LABEL_MAP } from "@/lib/schedule-types";

export default async function SchedulesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // studio_spec_preferences is the source of truth.
  // If a studio hasn't customised yet, they have no rows — we fall back to defaults.
  const { data: savedPrefs } = await supabase
    .from("studio_spec_preferences")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const prefs = savedPrefs ?? [];

  // Build the full list:
  // 1. Saved prefs first (in their saved order)
  // 2. Any system types not yet saved (appended at end, visible by default)
  const savedTypes = new Set(prefs.map((p) => p.item_type));

  const savedRows: ScheduleRow[] = prefs.map((p) => ({
    item_type: p.item_type,
    default_label: SYSTEM_LABEL_MAP.get(p.item_type) ?? null,
    display_name: p.display_name,
    is_visible: p.is_visible,
    is_custom: p.is_custom,
    sort_order: p.sort_order,
  }));

  const unsavedSystemRows: ScheduleRow[] = SYSTEM_SCHEDULES
    .filter((s) => !savedTypes.has(s.type))
    .map((s, i) => ({
      item_type: s.type,
      default_label: s.label,
      display_name: null,
      is_visible: true,
      is_custom: false,
      sort_order: prefs.length + i,
    }));

  const rows = [...savedRows, ...unsavedSystemRows];

  return (
    <AppShell>
      <SchedulesClient initialRows={rows} />
    </AppShell>
  );
}
