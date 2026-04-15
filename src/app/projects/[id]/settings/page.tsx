/**
 * Project Settings — /projects/[id]/settings
 *
 * Per-project configuration. Currently: schedule customisation.
 * Inherits from studio_spec_preferences by default; override here per project.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { SYSTEM_SCHEDULES, SYSTEM_LABEL_MAP } from "@/lib/schedule-types";
import ProjectSettingsClient, { type SettingsScheduleRow } from "./ProjectSettingsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase  = await createClient();
  const studioId  = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!projectData) notFound();

  // ── Fetch project-level prefs (may be empty if not yet customised) ─────────

  const { data: projectPrefs } = await supabase
    .from("project_schedule_preferences")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  const hasProjectPrefs = projectPrefs && projectPrefs.length > 0;

  // ── Build the displayed list ──────────────────────────────────────────────
  // If project has prefs: show those.
  // Otherwise: show studio prefs (or system defaults) as a starting point.

  let rows: SettingsScheduleRow[];

  if (hasProjectPrefs) {
    rows = projectPrefs.map((p) => ({
      item_type:    p.item_type,
      default_label: SYSTEM_LABEL_MAP.get(p.item_type) ?? null,
      display_name: p.display_name,
      is_visible:   p.is_visible,
      is_custom:    p.is_custom,
      sort_order:   p.sort_order,
      is_project_override: true,
    }));
  } else {
    // Fall back to studio prefs
    const { data: studioPrefs } = await supabase
      .from("studio_spec_preferences")
      .select("*")
      .eq("studio_id", studioId)
      .order("sort_order");

    const prefs = studioPrefs ?? [];
    const savedTypes = new Set(prefs.map((p) => p.item_type));

    const studioRows: SettingsScheduleRow[] = prefs.map((p) => ({
      item_type:    p.item_type,
      default_label: SYSTEM_LABEL_MAP.get(p.item_type) ?? null,
      display_name: p.display_name,
      is_visible:   p.is_visible,
      is_custom:    p.is_custom,
      sort_order:   p.sort_order,
      is_project_override: false,
    }));

    const systemRows: SettingsScheduleRow[] = SYSTEM_SCHEDULES
      .filter((s) => !savedTypes.has(s.type))
      .map((s, i) => ({
        item_type:    s.type,
        default_label: s.label,
        display_name: null,
        is_visible:   true,
        is_custom:    false,
        sort_order:   prefs.length + i,
        is_project_override: false,
      }));

    rows = [...studioRows, ...systemRows];
  }

  return (
    <ProjectSettingsClient
      projectId={projectId}
      projectName={projectData.name}
      initialRows={rows}
      hasProjectOverride={hasProjectPrefs ?? false}
    />
  );
}
