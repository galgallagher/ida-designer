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
    />
  );
}
