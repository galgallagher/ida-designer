import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectOptionsClient from "./ProjectOptionsClient";
import type { ProjectImageRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string }>;
}

export default async function ProjectOptionsPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { s: section } = await searchParams;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: projectData }, projectSpecsResult, studioSpecsResult, imagesResult, scheduleSlotsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .eq("studio_id", studioId)
        .single(),
      supabase
        .from("project_options")
        .select("id, spec_id, notes, status, created_at")
        .eq("project_id", projectId)
        .eq("studio_id", studioId)
        .not("spec_id", "is", null)
        .order("created_at"),
      supabase
        .from("specs")
        .select("id, name, code, image_url, cost_from, cost_to, cost_unit, category_id")
        .eq("studio_id", studioId)
        .order("name"),
      supabase
        .from("project_images")
        .select("*")
        .eq("project_id", projectId)
        .eq("studio_id", studioId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_specs")
        .select("id, spec_id, code, sequence, category_id")
        .eq("project_id", projectId)
        .eq("studio_id", studioId)
        .order("sequence"),
    ]);

  if (!projectData) notFound();

  // Resolve category names
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
    image_url: s.image_url ?? null,
    category_id: s.category_id ?? null,
    category_name: s.category_id ? (catMap.get(s.category_id) ?? null) : null,
    cost_from: s.cost_from ?? null,
    cost_to: s.cost_to ?? null,
    cost_unit: s.cost_unit ?? null,
  }));

  const alreadyAddedIds = new Set(
    (projectSpecsResult.data ?? []).map((r) => r.spec_id).filter((id): id is string => id !== null),
  );

  // Build map of specId → schedule codes assigned to it.
  const scheduleCodesBySpec: Record<string, string[]> = {};
  const emptySlots: { id: string; code: string; category_id: string }[] = [];
  (scheduleSlotsResult.data ?? []).forEach((row) => {
    if (row.spec_id) {
      const list = scheduleCodesBySpec[row.spec_id] ?? [];
      list.push(row.code);
      scheduleCodesBySpec[row.spec_id] = list;
    } else {
      emptySlots.push({ id: row.id, code: row.code, category_id: row.category_id });
    }
  });

  // Fetch all categories so the client can map slot category_id → descendants
  // (a spec can be assigned to a slot in its own category or any ancestor).
  const { data: allCats } = await supabase
    .from("spec_categories")
    .select("id, name, parent_id")
    .eq("studio_id", studioId)
    .eq("is_active", true);

  return (
    <ProjectOptionsClient
      projectId={projectId}
      projectName={projectData.name}
      projectSpecs={projectSpecsResult.data ?? []}
      librarySpecs={librarySpecs}
      alreadyAddedIds={[...alreadyAddedIds]}
      images={(imagesResult.data ?? []) as ProjectImageRow[]}
      section={section ?? null}
      scheduleCodesBySpec={scheduleCodesBySpec}
      emptySlots={emptySlots}
      categories={(allCats ?? []).map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }))}
    />
  );
}
