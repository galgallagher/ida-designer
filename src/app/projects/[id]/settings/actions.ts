"use server";

/**
 * Server actions for /projects/[id]/settings
 *
 * Project schedule preferences. Each project can customise which schedules
 * are visible, their order, and their names. Falls back to studio settings
 * when no project-level preferences exist.
 *
 * When a project saves its first preferences, the full list is written to
 * project_schedule_preferences (not just the diffs), making subsequent reads
 * simple and fast.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { SYSTEM_SCHEDULES } from "@/lib/schedule-types";
import crypto from "node:crypto";

// ── Guard helper ──────────────────────────────────────────────────────────────

async function getGuard(projectId: string) {
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

// ── Save project schedule preferences ────────────────────────────────────────
// Replaces all existing project-level prefs with the new list.

export async function saveProjectSchedulePreferences(
  projectId: string,
  rows: Array<{
    item_type: string;
    display_name: string | null;
    is_visible: boolean;
    is_custom: boolean;
    sort_order: number;
  }>
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Delete existing project prefs and replace with new list
  await supabase
    .from("project_schedule_preferences")
    .delete()
    .eq("project_id", projectId);

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("project_schedule_preferences")
      .insert(
        rows.map((r) => ({
          project_id: projectId,
          studio_id:  studioId,
          item_type:  r.item_type,
          display_name: r.display_name,
          is_visible: r.is_visible,
          is_custom:  r.is_custom,
          sort_order: r.sort_order,
        }))
      );

    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}

// ── Add custom schedule to this project ───────────────────────────────────────

export async function addProjectCustomSchedule(
  projectId: string,
  name: string,
  currentRows: Array<{ item_type: string; sort_order: number }>
): Promise<{ error: string | null; item_type?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const { error, supabase, studioId } = await getGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const item_type  = crypto.randomUUID();
  const sort_order = Math.max(0, ...currentRows.map((r) => r.sort_order)) + 1;

  const { error: insertError } = await supabase
    .from("project_schedule_preferences")
    .insert({
      project_id:   projectId,
      studio_id:    studioId,
      item_type,
      display_name: trimmed,
      is_visible:   true,
      is_custom:    true,
      sort_order,
    });

  if (insertError) return { error: insertError.message };

  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null, item_type };
}

// ── Reset to studio defaults ──────────────────────────────────────────────────
// Deletes all project-level prefs so the schedule view falls back to studio settings.

export async function resetProjectSchedulesToStudio(
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase } = await getGuard(projectId);
  if (error || !supabase) return { error: error ?? "Not authorised." };

  await supabase
    .from("project_schedule_preferences")
    .delete()
    .eq("project_id", projectId);

  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/specs/schedule`);
  return { error: null };
}
