/**
 * Project Canvas — /projects/[id]/canvas
 *
 * Freeform visual canvas for project inspiration. Drop images, sketches,
 * or paste product URLs. Multiple named canvases per project.
 * Auto-creates a default "Inspiration" canvas on first visit.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectCanvasClient from "./ProjectCanvasClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectCanvasPage({ params }: PageProps) {
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

  // Fetch all canvases for this project
  let { data: canvases } = await supabase
    .from("project_canvases")
    .select("id, name, order_index, created_at, updated_at")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  // Auto-create a default canvas on first visit
  if (!canvases || canvases.length === 0) {
    const { data: newCanvas, error } = await supabase
      .from("project_canvases")
      .insert({
        studio_id: studioId,
        project_id: projectId,
        name: "Inspiration",
        content: {},
        order_index: 0,
      })
      .select("id, name, order_index, created_at, updated_at")
      .single();

    if (error) {
      console.error("[ProjectCanvasPage] failed to create default canvas:", error);
      notFound();
    }

    canvases = [newCanvas];
  }

  return (
    <ProjectCanvasClient
      projectId={projectId}
      studioId={studioId}
      canvases={canvases}
    />
  );
}
