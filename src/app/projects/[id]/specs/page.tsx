/**
 * Project Library — /projects/[id]/specs
 *
 * A flat grid of all products and materials being considered for this project.
 * Items are added from the studio library with one click — no schedule
 * assignment at this stage. Schedule assignment happens on the Specs tab.
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
      .order("created_at"),
    supabase
      .from("specs")
      .select("id, name, code, image_url, cost_from, cost_to, cost_unit, category_id")
      .eq("studio_id", studioId)
      .order("name"),
  ]);

  if (!projectData) notFound();

  const projectSpecs = projectSpecsResult.data ?? [];
  const rawLibrary  = libraryResult.data ?? [];

  // Resolve category names for library specs
  const catIds = [...new Set(rawLibrary.map((s) => s.category_id).filter(Boolean))] as string[];
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from("spec_categories")
      .select("id, name")
      .in("id", catIds);
    (cats ?? []).forEach((c) => catMap.set(c.id, c.name));
  }

  const librarySpecs = rawLibrary.map((s) => ({
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
    <ProjectSpecsClient
      projectId={projectId}
      projectName={projectData.name}
      projectSpecs={projectSpecs}
      librarySpecs={librarySpecs}
    />
  );
}
