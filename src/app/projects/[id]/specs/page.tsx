/**
 * Project Specs — /projects/[id]/specs
 *
 * Shows all spec items grouped by item type, filtered by the active project option.
 * Project Options (A/B/C) allow parallel design directions within one project.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectSpecsClient from "./ProjectSpecsClient";
import type { DrawingType } from "@/types/database";

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

  // ── Parallel: fetch options + library specs ──────────────────────────────────
  const [optionsResult, libraryResult] = await Promise.all([
    supabase
      .from("project_options")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("specs")
      .select("id, name, image_url")
      .eq("studio_id", studioId)
      .order("name"),
  ]);

  const options = optionsResult.data ?? [];
  const librarySpecs = libraryResult.data ?? [];

  // ── Parallel: fetch project specs + drawings (need optionIds) ────────────────
  const optionIds = options.map((o) => o.id);

  const [projectSpecsResult, drawingsResult] = optionIds.length > 0
    ? await Promise.all([
        supabase
          .from("project_specs")
          .select("*")
          .in("project_option_id", optionIds)
          .order("created_at"),
        supabase
          .from("drawings")
          .select("id, name, project_option_id, drawing_type")
          .in("project_option_id", optionIds)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }];

  const projectSpecs = projectSpecsResult.data ?? [];
  const drawingsRaw = drawingsResult.data ?? [];
  const drawings = drawingsRaw as {
    id: string;
    name: string;
    project_option_id: string | null;
    drawing_type: DrawingType | null;
  }[];

  // ── Fetch spec details for the specs referenced in project_specs ────────────
  const specIds = [...new Set(projectSpecs.map((ps) => ps.spec_id))];
  const specDetailsResult = specIds.length > 0
    ? await supabase
        .from("specs")
        .select("id, name, image_url")
        .in("id", specIds)
    : { data: [] };

  const specDetails = (specDetailsResult.data ?? []) as {
    id: string;
    name: string;
    image_url: string | null;
  }[];

  return (
    <ProjectSpecsClient
      projectId={projectId}
      projectName={project.name}
      options={options}
      projectSpecs={projectSpecs}
      specDetails={specDetails}
      drawings={drawings}
      librarySpecs={librarySpecs}
    />
  );
}
