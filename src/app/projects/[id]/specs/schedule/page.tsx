/**
 * Project Schedule — /projects/[id]/specs/schedule
 *
 * Shows confirmed project specs grouped by schedule type.
 * Items reach here only after being assigned from the Project Library.
 * "Remove from schedule" sends them back to project_library_items.
 *
 * Schedule order/visibility: project prefs → studio prefs → system defaults.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { SYSTEM_SCHEDULES, SYSTEM_LABEL_MAP } from "@/lib/schedule-types";
import ProjectScheduleClient from "./ProjectScheduleClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSchedulePage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase  = await createClient();
  const studioId  = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: projectData }, projectSpecsResult, libraryResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("studio_id", studioId)
      .single(),
    supabase
      .from("project_specs")
      .select("*")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .not("item_type", "is", null)
      .order("created_at"),
    supabase
      .from("specs")
      .select("id, name, code, image_url, cost_from, cost_to, cost_unit, category_id")
      .eq("studio_id", studioId)
      .order("name"),
  ]);

  if (!projectData) notFound();

  // ── Resolve schedule order ────────────────────────────────────────────────
  // Priority: project prefs → studio prefs → system defaults

  const { data: projectPrefs } = await supabase
    .from("project_schedule_preferences")
    .select("item_type, display_name, is_visible, is_custom, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  let scheduleRows: { item_type: string; label: string }[];

  if (projectPrefs && projectPrefs.length > 0) {
    // Project has customised schedules — use them
    scheduleRows = projectPrefs
      .filter((p) => p.is_visible)
      .map((p) => ({
        item_type: p.item_type,
        label: p.display_name || SYSTEM_LABEL_MAP.get(p.item_type) || p.item_type,
      }));
  } else {
    // Fall back to studio prefs or system defaults
    const { data: studioPrefs } = await supabase
      .from("studio_spec_preferences")
      .select("item_type, display_name, is_visible, sort_order")
      .eq("studio_id", studioId)
      .order("sort_order");

    if (studioPrefs && studioPrefs.length > 0) {
      const savedTypes  = new Set(studioPrefs.map((p) => p.item_type));
      const allRows = [
        ...studioPrefs,
        ...SYSTEM_SCHEDULES
          .filter((s) => !savedTypes.has(s.type))
          .map((s, i) => ({ item_type: s.type, display_name: null as string | null, is_visible: true, sort_order: studioPrefs.length + i })),
      ];
      scheduleRows = allRows
        .filter((p) => p.is_visible)
        .map((p) => ({
          item_type: p.item_type,
          label: p.display_name || SYSTEM_LABEL_MAP.get(p.item_type) || p.item_type,
        }));
    } else {
      scheduleRows = SYSTEM_SCHEDULES.map((s) => ({ item_type: s.type, label: s.label }));
    }
  }

  // ── Build spec detail map ─────────────────────────────────────────────────

  const rawLibrary = libraryResult.data ?? [];
  const catIds = [...new Set(rawLibrary.map((s) => s.category_id).filter(Boolean))] as string[];
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from("spec_categories")
      .select("id, name")
      .in("id", catIds);
    (cats ?? []).forEach((c) => catMap.set(c.id, c.name));
  }

  const specDetails = rawLibrary.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? null,
    image_url: s.image_url,
    category_name: s.category_id ? (catMap.get(s.category_id) ?? null) : null,
    cost_from: s.cost_from,
    cost_to: s.cost_to,
    cost_unit: s.cost_unit,
  }));

  return (
    <ProjectScheduleClient
      projectId={projectId}
      projectName={projectData.name}
      projectSpecs={projectSpecsResult.data ?? []}
      specDetails={specDetails}
      schedules={scheduleRows}
    />
  );
}
