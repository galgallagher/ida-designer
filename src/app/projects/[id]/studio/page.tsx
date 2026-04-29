import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import StudioPageClient from "./StudioPageClient";
import type { StudioModelRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) notFound();

  const { data: models } = await supabase
    .from("studio_models")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false });

  return (
    <StudioPageClient
      projectId={projectId}
      studioId={studioId}
      projectName={project.name}
      initialModels={(models ?? []) as StudioModelRow[]}
    />
  );
}
