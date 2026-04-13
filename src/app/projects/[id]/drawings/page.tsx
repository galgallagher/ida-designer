/**
 * Project Drawings — /projects/[id]/drawings
 *
 * Shows drawings grouped by type (Arch ID, Joinery, FF&E), filtered by the
 * active Project Option. Each drawing shows its assigned finish codes.
 * Clicking a drawing opens a Sheet panel to manage finishes and view pinned specs.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectDrawingsClient from "./ProjectDrawingsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDrawingsPage({ params }: PageProps) {
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

  // ── Parallel: options + studio finishes ──────────────────────────────────────
  const [optionsResult, studioFinishesResult] = await Promise.all([
    supabase
      .from("project_options")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("studio_finishes")
      .select("id, code, name, colour_hex")
      .eq("studio_id", studioId)
      .order("code"),
  ]);

  const options = optionsResult.data ?? [];
  const studioFinishes = studioFinishesResult.data ?? [];
  const optionIds = options.map((o) => o.id);

  // ── Parallel: drawings + pinned specs (need optionIds) ───────────────────────
  const [drawingsResult, pinnedSpecsResult] = optionIds.length > 0
    ? await Promise.all([
        supabase
          .from("drawings")
          .select("id, name, drawing_type, project_option_id, order_index")
          .in("project_option_id", optionIds)
          .order("order_index"),
        supabase
          .from("project_specs")
          .select("id, spec_id, drawing_id, item_type, status, project_option_id")
          .in("project_option_id", optionIds)
          .not("drawing_id", "is", null),
      ])
    : [{ data: [] }, { data: [] }];

  const drawings = drawingsResult.data ?? [];
  const drawingIds = drawings.map((d) => d.id);

  // ── Fetch drawing finishes (need drawingIds) ──────────────────────────────────
  const drawingFinishesResult = drawingIds.length > 0
    ? await supabase
        .from("drawing_finishes")
        .select("drawing_id, studio_finish_id, order_index")
        .in("drawing_id", drawingIds)
        .order("order_index")
    : { data: [] };

  const drawingFinishes = drawingFinishesResult.data ?? [];

  // ── Fetch spec names for pinned specs ─────────────────────────────────────────
  const pinnedSpecs = pinnedSpecsResult.data ?? [];
  const specIds = [...new Set(pinnedSpecs.map((ps) => ps.spec_id))];
  const specNamesResult = specIds.length > 0
    ? await supabase
        .from("specs")
        .select("id, name")
        .in("id", specIds)
    : { data: [] };
  const specNames = specNamesResult.data ?? [];

  return (
    <ProjectDrawingsClient
      projectId={projectId}
      projectName={project.name}
      options={options}
      drawings={drawings as Parameters<typeof ProjectDrawingsClient>[0]["drawings"]}
      drawingFinishes={drawingFinishes}
      studioFinishes={studioFinishes}
      pinnedSpecs={pinnedSpecs as Parameters<typeof ProjectDrawingsClient>[0]["pinnedSpecs"]}
      specNames={specNames}
    />
  );
}
