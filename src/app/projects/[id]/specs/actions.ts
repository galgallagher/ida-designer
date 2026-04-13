"use server";

/**
 * Server actions for /projects/[id]/specs — project spec management.
 *
 * All mutations verify studio ownership by checking project_options.studio_id
 * or (for remove) project_specs.studio_id — no admin-only restriction since
 * all studio members with project access can manage specs.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { SpecItemType, SpecStatus } from "@/types/database";

// ── Shared guard ──────────────────────────────────────────────────────────────

async function getProjectGuard(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, studioId: null };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", supabase: null, studioId: null };

  // Verify project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) return { error: "Project not found.", supabase: null, studioId: null };

  return { error: null, supabase, studioId };
}

// ── Add spec to project ───────────────────────────────────────────────────────

export async function addSpecToProject(
  projectId: string,
  payload: {
    project_option_id: string;
    spec_id: string;
    item_type: SpecItemType;
    drawing_id: string | null;
    notes: string | null;
  }
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Verify the option belongs to this project + studio
  const { data: option } = await supabase
    .from("project_options")
    .select("id")
    .eq("id", payload.project_option_id)
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!option) return { error: "Option not found." };

  // Verify the spec belongs to this studio
  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", payload.spec_id)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found in your library." };

  const { error: dbError } = await supabase.from("project_specs").insert({
    project_id: projectId,                          // legacy FK — kept during transition
    project_option_id: payload.project_option_id,
    studio_id: studioId,
    spec_id: payload.spec_id,
    item_type: payload.item_type,
    drawing_id: payload.drawing_id,
    notes: payload.notes,
    status: "draft",
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: "This spec is already added to this option." };
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  return { error: null };
}

// ── Remove spec from project ──────────────────────────────────────────────────

export async function removeSpecFromProject(
  projectSpecId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // studio_id on project_specs acts as ownership check
  const { error: dbError } = await supabase
    .from("project_specs")
    .delete()
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specs`);
  return { error: null };
}

// ── Update spec item type / drawing / notes ───────────────────────────────────

export async function updateProjectSpec(
  projectSpecId: string,
  projectId: string,
  payload: {
    item_type?: SpecItemType;
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
  return { error: null };
}

// ── Add project option ────────────────────────────────────────────────────────

export async function addProjectOption(
  projectId: string,
  name: string
): Promise<{ error: string | null; optionId: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised.", optionId: null };

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Option name is required.", optionId: null };

  // Find the next available label (A → Z)
  const { data: existing } = await supabase
    .from("project_options")
    .select("label, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  const existingLabels = new Set((existing ?? []).map((o) => o.label));
  const nextLabel = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .find((l) => !existingLabels.has(l));

  if (!nextLabel) return { error: "Maximum 26 options reached.", optionId: null };

  const nextSortOrder = (existing ?? []).length;

  const { data: newOption, error: dbError } = await supabase
    .from("project_options")
    .insert({
      studio_id: studioId,
      project_id: projectId,
      name: trimmedName,
      label: nextLabel,
      sort_order: nextSortOrder,
      is_default: false,
    })
    .select("id")
    .single();

  if (dbError) {
    if (dbError.code === "23505") return { error: `Option "${nextLabel}" already exists.`, optionId: null };
    return { error: dbError.message, optionId: null };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  return { error: null, optionId: newOption.id };
}
