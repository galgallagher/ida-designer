"use server";

/**
 * Server actions for project spec management.
 *
 * Project Library (/specs): add/remove specs. item_type is optional —
 * items live in the library without a schedule assignment.
 *
 * Project Schedule (/specs/schedule): assign/unassign schedule types
 * on existing project_specs rows via updateProjectSpec.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { SpecStatus } from "@/types/database";

// ── Shared guard ──────────────────────────────────────────────────────────────

async function getProjectGuard(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, studioId: null };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", supabase: null, studioId: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) return { error: "Project not found.", supabase: null, studioId: null };

  return { error: null, supabase, studioId };
}

// ── Resolve or create the default project option ──────────────────────────────

async function resolveDefaultOption(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  studioId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_default", true)
    .single();

  if (existing) return existing.id;

  const { data: any } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", projectId)
    .order("sort_order")
    .limit(1)
    .single();

  if (any) return any.id;

  const { data: created } = await supabase
    .from("project_options")
    .insert({
      studio_id: studioId,
      project_id: projectId,
      name: "Option A",
      label: "A",
      sort_order: 0,
      is_default: true,
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

// ── Add spec to project library ───────────────────────────────────────────────
// item_type is intentionally NOT required here — specs land in the library
// without a schedule assignment. They get assigned via the Schedule tab.

export async function addSpecToProject(
  projectId: string,
  payload: {
    spec_id: string;
    item_type?: string | null;
    drawing_id?: string | null;
    notes?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", payload.spec_id)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found in your library." };

  const optionId = await resolveDefaultOption(supabase, projectId, studioId);
  if (!optionId) return { error: "Could not resolve project option." };

  const { error: dbError } = await supabase.from("project_specs").insert({
    project_id: projectId,
    project_option_id: optionId,
    studio_id: studioId,
    spec_id: payload.spec_id,
    item_type: payload.item_type ?? null,
    drawing_id: payload.drawing_id ?? null,
    notes: payload.notes ?? null,
    status: "draft",
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: "This spec is already in the project." };
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Remove spec from project entirely ────────────────────────────────────────

export async function removeSpecFromProject(
  projectSpecId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("project_specs")
    .delete()
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Assign spec to a schedule type ────────────────────────────────────────────
// Sets item_type on an existing project_spec. Pass null to unassign.

export async function assignSpecToSchedule(
  projectSpecId: string,
  projectId: string,
  itemType: string | null
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("project_specs")
    .update({ item_type: itemType })
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Update spec status / notes ────────────────────────────────────────────────

export async function updateProjectSpec(
  projectSpecId: string,
  projectId: string,
  payload: {
    item_type?: string | null;
    drawing_id?: string | null;
    notes?: string | null;
    status?: SpecStatus;
  }
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("project_specs")
    .update(payload)
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}
