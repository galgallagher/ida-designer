import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { notFound } from "next/navigation";
import ProjectImagesClient from "./ProjectImagesClient";
import type { ProjectImageRow } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectImagesPage({ params }: Props) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  // Verify project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) notFound();

  const { data: images } = await supabase
    .from("project_images")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false });

  return (
    <ProjectImagesClient
      projectId={projectId}
      images={(images ?? []) as ProjectImageRow[]}
    />
  );
}
