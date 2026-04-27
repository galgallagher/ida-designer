/**
 * Project Library — /projects/[id]/specs
 *
 * Shows project_specs WHERE item_type IS NULL — items under consideration.
 * Each card has an "Add to schedule" dropdown which sets item_type and
 * allocates a project code, moving the item to the Schedule view.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { SYSTEM_SCHEDULES, SYSTEM_LABEL_MAP } from "@/lib/schedule-types";
import ProjectSpecsClient from "./ProjectSpecsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSpecsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: projectData }, libraryResult, allProjectSpecsResult, studioSpecsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("studio_id", studioId)
      .single(),
    // Library: only rows with a spec attached (empty slots live on the Schedule page only)
    supabase
      .from("project_specs")
      .select("*")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .not("spec_id", "is", null)
      .order("created_at"),
    // Same query — used for picker exclusion (prevent adding duplicates)
    supabase
      .from("project_specs")
      .select("spec_id")
      .eq("project_id", projectId)
      .eq("studio_id", studioId),
    // Studio library for the picker
    supabase
      .from("specs")
      .select("id, name, code, image_url, cost_from, cost_to, cost_unit, category_id")
      .eq("studio_id", studioId)
      .order("name"),
  ]);

  if (!projectData) notFound();

  // ── Resolve category names ─────────────────────────────────────────────────

  const rawSpecs = studioSpecsResult.data ?? [];
  const catIds = [...new Set(rawSpecs.map((s) => s.category_id).filter(Boolean))] as string[];
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from("spec_categories")
      .select("id, name")
      .in("id", catIds);
    (cats ?? []).forEach((c) => catMap.set(c.id, c.name));
  }

  const librarySpecs = rawSpecs.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? null,
    image_url: s.image_url,
    category_name: s.category_id ? (catMap.get(s.category_id) ?? null) : null,
    cost_from: s.cost_from,
    cost_to: s.cost_to,
    cost_unit: s.cost_unit,
  }));

  // ── Schedule list for assign dropdown ─────────────────────────────────────

  const { data: projectPrefs } = await supabase
    .from("project_schedule_preferences")
    .select("item_type, display_name, is_visible, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  let schedules: { item_type: string; label: string }[];

  if (projectPrefs && projectPrefs.length > 0) {
    schedules = projectPrefs
      .filter((p) => p.is_visible)
      .map((p) => ({ item_type: p.item_type, label: p.display_name || SYSTEM_LABEL_MAP.get(p.item_type) || p.item_type }));
  } else {
    const { data: studioPrefs } = await supabase
      .from("studio_spec_preferences")
      .select("item_type, display_name, is_visible, sort_order")
      .eq("studio_id", studioId)
      .order("sort_order");

    if (studioPrefs && studioPrefs.length > 0) {
      const savedTypes = new Set(studioPrefs.map((p) => p.item_type));
      schedules = [
        ...studioPrefs,
        ...SYSTEM_SCHEDULES.filter((s) => !savedTypes.has(s.type)).map((s, i) => ({
          item_type: s.type, display_name: null as string | null, is_visible: true, sort_order: studioPrefs.length + i,
        })),
      ]
        .filter((p) => p.is_visible)
        .map((p) => ({ item_type: p.item_type, label: p.display_name || SYSTEM_LABEL_MAP.get(p.item_type) || p.item_type }));
    } else {
      schedules = SYSTEM_SCHEDULES.map((s) => ({ item_type: s.type, label: s.label }));
    }
  }

  const allProjectSpecIds = new Set((allProjectSpecsResult.data ?? []).map((r) => r.spec_id).filter((id): id is string => id !== null));

  return (
    <ProjectSpecsClient
      projectId={projectId}
      projectName={projectData.name}
      projectSpecs={libraryResult.data ?? []}
      librarySpecs={librarySpecs}
      allProjectSpecIds={[...allProjectSpecIds]}
      schedules={schedules}
    />
  );
}
