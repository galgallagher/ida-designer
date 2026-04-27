"use server";

/**
 * Server actions for project specs.
 *
 * project_specs holds items at both stages:
 *  - item_type = null  → in the Project Library (considering, no code yet)
 *  - item_type = set   → assigned to a schedule (committed, project_code allocated)
 *
 * The Project Library page filters for item_type IS NULL.
 * The Schedule page filters for item_type IS NOT NULL.
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

// ── Category abbreviation resolution (subcategory takes priority) ─────────────

async function resolveCategoryAbbreviation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string
): Promise<string | null> {
  const { data: cat } = await supabase
    .from("spec_categories")
    .select("abbreviation, parent_id")
    .eq("id", categoryId)
    .single();

  if (!cat) return null;
  if (cat.abbreviation) return cat.abbreviation;

  if (cat.parent_id) {
    const { data: parent } = await supabase
      .from("spec_categories")
      .select("abbreviation")
      .eq("id", cat.parent_id)
      .single();
    return parent?.abbreviation ?? null;
  }

  return null;
}

// ── Gap-filling code allocator ────────────────────────────────────────────────

async function allocateProjectSpecCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  abbreviation: string
): Promise<string> {
  const { data } = await supabase
    .from("project_specs")
    .select("project_code")
    .eq("project_id", projectId)
    .like("project_code", `${abbreviation}%`);

  const used = new Set(
    (data ?? [])
      .map((r) => r.project_code)
      .filter(Boolean)
      .map((code) => parseInt(code!.slice(abbreviation.length), 10))
      .filter((n) => !isNaN(n))
  );

  let n = 1;
  while (used.has(n)) n++;

  return `${abbreviation}${String(n).padStart(2, "0")}`;
}

// ── Add spec to project library (item_type = null, no code yet) ───────────────

export async function addSpecToProject(
  projectId: string,
  payload: { spec_id: string; notes?: string | null }
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

  const { error: dbError } = await supabase.from("project_specs").insert({
    project_id: projectId,
    studio_id: studioId,
    spec_id: payload.spec_id,
    item_type: null,
    notes: payload.notes ?? null,
    status: "draft",
    project_code: null,
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: "This item is already in the project." };
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  return { error: null };
}

// ── Remove spec from project ──────────────────────────────────────────────────
// If a project_code has been allocated the slot is permanent — detach the spec
// (set spec_id to null) rather than deleting the row.
// If no code has been allocated yet the row can be fully deleted.

export async function removeSpecFromProject(
  projectSpecId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { data: row } = await supabase
    .from("project_specs")
    .select("project_code")
    .eq("id", projectSpecId)
    .eq("studio_id", studioId)
    .single();

  if (row?.project_code) {
    // Slot is permanent — detach spec, keep code + item_type
    const { error: dbError } = await supabase
      .from("project_specs")
      .update({ spec_id: null })
      .eq("id", projectSpecId)
      .eq("studio_id", studioId);
    if (dbError) return { error: dbError.message };
  } else {
    // Never committed — delete entirely
    const { error: dbError } = await supabase
      .from("project_specs")
      .delete()
      .eq("id", projectSpecId)
      .eq("studio_id", studioId);
    if (dbError) return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Reassign a spec into an existing empty slot ───────────────────────────────
// Used when a coded slot has spec_id = null and a new spec is being slotted in.
// Does NOT allocate a new code — the existing project_code is retained.

export async function reassignSpecSlot(
  projectSpecId: string,
  projectId: string,
  newSpecId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", newSpecId)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found in your library." };

  const { error: dbError } = await supabase
    .from("project_specs")
    .update({ spec_id: newSpecId })
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Assign to schedule — allocates project_code on first assignment ───────────
// Pass null to remove from schedule (clears item_type and project_code,
// sending the item back to the Project Library view).

export async function assignSpecToSchedule(
  projectSpecId: string,
  projectId: string,
  itemType: string | null
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  if (itemType === null) {
    // Remove from schedule — clear item_type and code, return to Project Library.
    // spec_id stays intact so the item remains in the library for reassignment.
    const { error: dbError } = await supabase
      .from("project_specs")
      .update({ item_type: null, project_code: null })
      .eq("id", projectSpecId)
      .eq("studio_id", studioId);

    if (dbError) return { error: dbError.message };
  } else {
    // Assigning — allocate a code if not already set
    const { data: ps } = await supabase
      .from("project_specs")
      .select("project_code, spec_id")
      .eq("id", projectSpecId)
      .single();

    let projectCode = ps?.project_code ?? null;

    if (!projectCode && ps?.spec_id) {
      const { data: spec } = await supabase
        .from("specs")
        .select("category_id")
        .eq("id", ps.spec_id)
        .single();

      if (spec?.category_id) {
        const abbreviation = await resolveCategoryAbbreviation(supabase, spec.category_id);
        if (abbreviation) {
          projectCode = await allocateProjectSpecCode(supabase, projectId, abbreviation);
        }
      }
    }

    const { error: dbError } = await supabase
      .from("project_specs")
      .update({ item_type: itemType, project_code: projectCode })
      .eq("id", projectSpecId)
      .eq("studio_id", studioId);

    if (dbError) return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/specs`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Update spec notes / status ────────────────────────────────────────────────

export async function updateProjectSpec(
  projectSpecId: string,
  projectId: string,
  payload: {
    notes?: string | null;
    status?: SpecStatus;
    quantity?: number | null;
    unit?: string | null;
    project_price?: number | null;
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
