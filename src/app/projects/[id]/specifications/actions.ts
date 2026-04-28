"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
type CategoryChainRow = {
  abbreviation: string | null;
  name: string;
  parent_id: string | null;
};

type Supa = Awaited<ReturnType<typeof createClient>>;

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

// ── Code generation ───────────────────────────────────────────────────────────
// Walk the category chain (deepest first) and use the first non-null abbreviation.
// Subcategory abbreviation always wins over its parent.

async function fetchCategoryChainRow(
  supabase: Supa,
  studioId: string,
  id: string,
): Promise<CategoryChainRow | null> {
  const res = await supabase
    .from("spec_categories")
    .select("abbreviation, name, parent_id")
    .eq("id", id)
    .eq("studio_id", studioId)
    .single();
  return (res.data as CategoryChainRow | null) ?? null;
}

async function resolveCategoryPrefix(
  supabase: Supa,
  studioId: string,
  categoryId: string,
): Promise<string> {
  let currentId: string | null = categoryId;
  let fallbackName = "";
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const cat = await fetchCategoryChainRow(supabase, studioId, currentId);
    if (!cat) break;
    if (cat.abbreviation && cat.abbreviation.trim()) {
      return cat.abbreviation.trim().toUpperCase();
    }
    if (!fallbackName) fallbackName = cat.name ?? "";
    currentId = cat.parent_id;
  }

  return (fallbackName.slice(0, 2) || "SP").toUpperCase();
}

async function nextSequence(
  supabase: Supa,
  projectId: string,
  categoryId: string,
): Promise<number> {
  const { data } = await supabase
    .from("project_specs")
    .select("sequence")
    .eq("project_id", projectId)
    .eq("category_id", categoryId)
    .order("sequence", { ascending: false })
    .limit(1);

  return (data?.[0]?.sequence ?? 0) + 1;
}

// ── Create empty slot ─────────────────────────────────────────────────────────

export async function createSpecCode(
  projectId: string,
  categoryId: string,
): Promise<{ error: string | null; id: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised.", id: null };

  const { data: cat } = await supabase
    .from("spec_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("studio_id", studioId)
    .single();
  if (!cat) return { error: "Category not found.", id: null };

  const prefix = await resolveCategoryPrefix(supabase, studioId, categoryId);
  const seq = await nextSequence(supabase, projectId, categoryId);

  const { data, error: dbError } = await supabase
    .from("project_specs")
    .insert({
      project_id: projectId,
      studio_id: studioId,
      category_id: categoryId,
      code: `${prefix}${String(seq).padStart(2, "0")}`,
      sequence: seq,
      quantity: 1,
      price: null,
      spec_id: null,
      notes: null,
    })
    .select("id")
    .single();

  if (dbError) return { error: dbError.message, id: null };

  revalidatePath(`/projects/${projectId}/specifications`);
  return { error: null, id: data.id };
}

// ── Update slot fields (qty, price, notes, assignment) ────────────────────────

export async function updateSpecCode(
  slotId: string,
  projectId: string,
  patch: {
    quantity?: number;
    price?: number | null;
    budget?: number | null;
    notes?: string | null;
    spec_id?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  if (patch.spec_id) {
    const { data: spec } = await supabase
      .from("specs")
      .select("id")
      .eq("id", patch.spec_id)
      .eq("studio_id", studioId)
      .single();
    if (!spec) return { error: "Spec not found in your library." };
  }

  const { error: dbError } = await supabase
    .from("project_specs")
    .update(patch)
    .eq("id", slotId)
    .eq("project_id", projectId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specifications`);
  return { error: null };
}

// ── Delete slot ───────────────────────────────────────────────────────────────

export async function deleteSpecCode(
  slotId: string,
  projectId: string,
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("project_specs")
    .delete()
    .eq("id", slotId)
    .eq("project_id", projectId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specifications`);
  return { error: null };
}

// ── Assign a spec to an existing slot ─────────────────────────────────────────
// Used by the picker on an unassigned slot. Validates the spec's category is
// the slot's category (or a descendant) and ensures the spec is in
// project_options too.

export async function assignSpecToCode(
  slotId: string,
  projectId: string,
  specId: string,
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const [{ data: slot }, { data: spec }] = await Promise.all([
    supabase
      .from("project_specs")
      .select("id, category_id")
      .eq("id", slotId)
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .single(),
    supabase
      .from("specs")
      .select("id, category_id")
      .eq("id", specId)
      .eq("studio_id", studioId)
      .single(),
  ]);

  if (!slot) return { error: "Slot not found." };
  if (!spec) return { error: "Spec not found in your library." };
  if (!spec.category_id) return { error: "Spec has no category." };

  // Verify spec.category_id is the slot category or a descendant of it.
  const allowed = await collectCategoryDescendants(supabase, studioId, slot.category_id);
  if (!allowed.has(spec.category_id)) {
    return { error: "Spec category doesn't match this slot's category." };
  }

  // Ensure the spec is in project_options.
  const { data: existingOption } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", projectId)
    .eq("spec_id", specId)
    .maybeSingle();
  if (!existingOption) {
    await supabase.from("project_options").insert({
      project_id: projectId,
      studio_id: studioId,
      spec_id: specId,
      notes: null,
      status: "draft",
    });
  }

  const { error: dbError } = await supabase
    .from("project_specs")
    .update({ spec_id: specId })
    .eq("id", slotId)
    .eq("studio_id", studioId);
  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/specifications`);
  revalidatePath(`/projects/${projectId}/options`);
  return { error: null };
}

async function collectCategoryDescendants(
  supabase: Supa,
  studioId: string,
  rootId: string,
): Promise<Set<string>> {
  const result = new Set<string>([rootId]);
  const { data } = await supabase
    .from("spec_categories")
    .select("id, parent_id")
    .eq("studio_id", studioId);
  const all: { id: string; parent_id: string | null }[] = (data ?? []) as { id: string; parent_id: string | null }[];

  let added = true;
  while (added) {
    added = false;
    for (const row of all) {
      if (row.parent_id && result.has(row.parent_id) && !result.has(row.id)) {
        result.add(row.id);
        added = true;
      }
    }
  }
  return result;
}

// ── Unassign + optional reset ─────────────────────────────────────────────────
// Always clears the spec assignment. The flags decide which other fields the
// user wants wiped at the same time. Quantity resets to 1 (the column is NOT
// NULL with a default of 1) — never to NULL.

export async function unassignCode(
  slotId: string,
  projectId: string,
  reset: { quantity?: boolean; price?: boolean; budget?: boolean; notes?: boolean } = {},
): Promise<{ error: string | null }> {
  const patch: {
    spec_id: null;
    quantity?: number;
    price?: number | null;
    budget?: number | null;
    notes?: string | null;
  } = { spec_id: null };
  if (reset.quantity) patch.quantity = 1;
  if (reset.price)    patch.price    = null;
  if (reset.budget)   patch.budget   = null;
  if (reset.notes)    patch.notes    = null;
  return updateSpecCode(slotId, projectId, patch);
}

// ── Fetch eligible empty codes for a spec (used by canvas picker) ─────────────

export async function getScheduleContextForSpec(
  projectId: string,
  specId: string,
): Promise<{
  error: string | null;
  specName: string | null;
  eligibleEmptySlots: { id: string; code: string }[];
  assignedCodes: string[];
}> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) {
    return { error: error ?? "Not authorised.", specName: null, eligibleEmptySlots: [], assignedCodes: [] };
  }

  const { data: spec } = await supabase
    .from("specs")
    .select("id, name, category_id")
    .eq("id", specId)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found.", specName: null, eligibleEmptySlots: [], assignedCodes: [] };

  // Codes already assigned to this spec on this project's schedule
  const { data: assignedRows } = await supabase
    .from("project_specs")
    .select("code")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .eq("spec_id", specId)
    .order("sequence");
  const assignedCodes = (assignedRows ?? []).map((r) => r.code);

  if (!spec.category_id) {
    return { error: null, specName: spec.name, eligibleEmptySlots: [], assignedCodes };
  }

  // Collect spec's category + ancestor chain — a spec fits a slot in its own
  // category or any ancestor (e.g. Linen spec → Fabric slot).
  const { data: allCats } = await supabase
    .from("spec_categories")
    .select("id, parent_id")
    .eq("studio_id", studioId);
  const parentMap = new Map<string, string | null>();
  (allCats ?? []).forEach((c) => parentMap.set(c.id, c.parent_id));
  const allowed = new Set<string>([spec.category_id]);
  let cursor: string | null = parentMap.get(spec.category_id) ?? null;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    allowed.add(cursor);
    cursor = parentMap.get(cursor) ?? null;
  }

  const { data: slots } = await supabase
    .from("project_specs")
    .select("id, code, category_id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .is("spec_id", null)
    .order("sequence");

  const eligibleEmptySlots = (slots ?? [])
    .filter((s) => allowed.has(s.category_id))
    .map((s) => ({ id: s.id, code: s.code }));

  return { error: null, specName: spec.name, eligibleEmptySlots, assignedCodes };
}

// ── All schedule codes for a project (for canvas pills) ───────────────────────

export async function getScheduleCodesForProject(
  projectId: string,
): Promise<Record<string, string[]>> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return {};

  const { data } = await supabase
    .from("project_specs")
    .select("spec_id, code")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .not("spec_id", "is", null)
    .order("sequence");

  const out: Record<string, string[]> = {};
  (data ?? []).forEach((r) => {
    if (!r.spec_id) return;
    (out[r.spec_id] ??= []).push(r.code);
  });
  return out;
}

// ── Add a library spec to the schedule ────────────────────────────────────────
// Always creates a NEW code in the spec's category and assigns the spec to it.
// (The picker UI handles the "reuse an empty code" path explicitly.)
// Also ensures the spec is in project_options.

export async function addSpecToSchedule(
  projectId: string,
  specId: string,
): Promise<{ error: string | null; slotId: string | null; code: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised.", slotId: null, code: null };

  const { data: spec } = await supabase
    .from("specs")
    .select("id, category_id")
    .eq("id", specId)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found in your library.", slotId: null, code: null };
  if (!spec.category_id) return { error: "Spec has no category — cannot derive a code.", slotId: null, code: null };

  // Ensure the spec exists in project_options.
  const { data: existingOption } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", projectId)
    .eq("spec_id", specId)
    .maybeSingle();
  if (!existingOption) {
    await supabase.from("project_options").insert({
      project_id: projectId,
      studio_id: studioId,
      spec_id: specId,
      notes: null,
      status: "draft",
    });
  }

  // Always create a new code already assigned.
  const prefix = await resolveCategoryPrefix(supabase, studioId, spec.category_id);
  const seq = await nextSequence(supabase, projectId, spec.category_id);
  const newCode = `${prefix}${String(seq).padStart(2, "0")}`;

  const { data: created, error: insertError } = await supabase
    .from("project_specs")
    .insert({
      project_id: projectId,
      studio_id: studioId,
      category_id: spec.category_id,
      code: newCode,
      sequence: seq,
      quantity: 1,
      price: null,
      spec_id: specId,
      notes: null,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message, slotId: null, code: null };

  revalidatePath(`/projects/${projectId}/specifications`);
  revalidatePath(`/projects/${projectId}/options`);
  return { error: null, slotId: created.id, code: newCode };
}
