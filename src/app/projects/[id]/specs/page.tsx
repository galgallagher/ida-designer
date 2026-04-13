/**
 * Project Specs — /projects/[id]/specs
 *
 * Shows all spec items for this project grouped by item type.
 * Specs are picked from the studio library and assigned to the project.
 * There are no tabs or parallel options shown at this level — the schedule
 * is a flat list of everything being considered.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectSpecsClient from "./ProjectSpecsClient";
import { SYSTEM_SCHEDULES, SYSTEM_LABEL_MAP } from "@/lib/schedule-types";

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

  // Verify project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) notFound();

  // ── Fetch schedule preferences for this studio ────────────────────────────
  const { data: prefsData } = await supabase
    .from("studio_spec_preferences")
    .select("item_type, display_name, is_visible, is_custom, sort_order")
    .eq("studio_id", studioId)
    .order("sort_order");

  const savedPrefs = prefsData ?? [];
  const savedTypes = new Set(savedPrefs.map((p) => p.item_type));

  // Build the ordered, visible schedule list for the picker
  const allSchedules = [
    ...savedPrefs,
    // Append any system types not yet saved (default: visible)
    ...SYSTEM_SCHEDULES
      .filter((s) => !savedTypes.has(s.type))
      .map((s, i) => ({
        item_type: s.type,
        display_name: null as string | null,
        is_visible: true,
        is_custom: false,
        sort_order: savedPrefs.length + i,
      })),
  ];

  const visibleSchedules = allSchedules
    .filter((s) => s.is_visible)
    .map((s) => ({
      key: s.item_type,
      label: s.display_name || SYSTEM_LABEL_MAP.get(s.item_type) || s.display_name || "Unknown",
    }));

  // ── Parallel: project specs + studio library ───────────────────────────────
  const [projectSpecsResult, libraryResult] = await Promise.all([
    supabase
      .from("project_specs")
      .select("*")
      .eq("project_id", projectId)          // use legacy project_id column
      .eq("studio_id", studioId)
      .order("created_at"),
    supabase
      .from("specs")
      .select("id, name, image_url")
      .eq("studio_id", studioId)
      .order("name"),
  ]);

  const projectSpecs = projectSpecsResult.data ?? [];
  const librarySpecs = libraryResult.data ?? [];

  // ── Fetch spec details for specs in the schedule ───────────────────────────
  const specIds = [...new Set(projectSpecs.map((ps) => ps.spec_id))];
  const specDetailsResult = specIds.length > 0
    ? await supabase
        .from("specs")
        .select("id, name, image_url")
        .in("id", specIds)
    : { data: [] };

  const specDetails = specDetailsResult.data ?? [];

  return (
    <ProjectSpecsClient
      projectId={projectId}
      projectName={project.name}
      projectSpecs={projectSpecs}
      specDetails={specDetails}
      librarySpecs={librarySpecs}
      schedules={visibleSchedules}
    />
  );
}
