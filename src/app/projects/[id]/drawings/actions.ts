"use server";

/**
 * Server actions for /projects/[id]/drawings — project drawing management.
 *
 * Mutations verify studio ownership via project membership. All studio
 * members with access to the project can add drawings and manage finishes.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { DrawingType } from "@/types/database";

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

// ── Add drawing ───────────────────────────────────────────────────────────────

export async function addDrawing(
  projectId: string,
  payload: {
    project_option_id: string;
    name: string;
    drawing_type: DrawingType;
  }
): Promise<{ error: string | null; drawingId: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised.", drawingId: null };

  const name = payload.name.trim();
  if (!name) return { error: "Drawing name is required.", drawingId: null };

  // Verify the option belongs to this project + studio
  const { data: option } = await supabase
    .from("project_options")
    .select("id")
    .eq("id", payload.project_option_id)
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!option) return { error: "Option not found.", drawingId: null };

  // Get current max order_index for this option
  const { data: existing } = await supabase
    .from("drawings")
    .select("order_index")
    .eq("project_option_id", payload.project_option_id)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].order_index + 1) : 0;

  const { data: newDrawing, error: dbError } = await supabase
    .from("drawings")
    .insert({
      project_id: projectId,                         // legacy FK
      project_option_id: payload.project_option_id,
      studio_id: studioId,
      name,
      drawing_type: payload.drawing_type,
      order_index: nextOrder,
    })
    .select("id")
    .single();

  if (dbError) return { error: dbError.message, drawingId: null };

  revalidatePath(`/projects/${projectId}/drawings`);
  return { error: null, drawingId: newDrawing.id };
}

// ── Add finish to drawing ─────────────────────────────────────────────────────

export async function addFinishToDrawing(
  drawingId: string,
  studioFinishId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Verify drawing belongs to this studio
  const { data: drawing } = await supabase
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .eq("studio_id", studioId)
    .single();

  if (!drawing) return { error: "Drawing not found." };

  // Verify finish belongs to this studio
  const { data: finish } = await supabase
    .from("studio_finishes")
    .select("id")
    .eq("id", studioFinishId)
    .eq("studio_id", studioId)
    .single();

  if (!finish) return { error: "Finish not found." };

  // Get current max order_index for this drawing
  const { data: existing } = await supabase
    .from("drawing_finishes")
    .select("order_index")
    .eq("drawing_id", drawingId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].order_index + 1) : 0;

  const { error: dbError } = await supabase.from("drawing_finishes").insert({
    drawing_id: drawingId,
    studio_finish_id: studioFinishId,
    studio_id: studioId,
    order_index: nextOrder,
    notes: null,
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: "This finish is already assigned to this drawing." };
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/drawings`);
  return { error: null };
}

// ── Remove finish from drawing ────────────────────────────────────────────────

export async function removeFinishFromDrawing(
  drawingId: string,
  studioFinishId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("drawing_finishes")
    .delete()
    .eq("drawing_id", drawingId)
    .eq("studio_finish_id", studioFinishId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/drawings`);
  return { error: null };
}

// ── Delete drawing ────────────────────────────────────────────────────────────

export async function deleteDrawing(
  drawingId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("drawings")
    .delete()
    .eq("id", drawingId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/drawings`);
  return { error: null };
}
