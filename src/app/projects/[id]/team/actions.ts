"use server";

/**
 * Server actions for /projects/[id]/team — project member management.
 * Admin/owner-only mutations via adminGuard().
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";

// ── Add member to project ─────────────────────────────────────────────────────

export async function addProjectMember(
  projectId: string,
  studioMemberId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Verify the project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) return { error: "Project not found." };

  // Verify the studio_member belongs to this studio
  const { data: member } = await supabase
    .from("studio_members")
    .select("id")
    .eq("id", studioMemberId)
    .eq("studio_id", studioId)
    .single();

  if (!member) return { error: "Member not found." };

  const { error: dbError } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, studio_member_id: studioMemberId });

  if (dbError) {
    if (dbError.code === "23505") return { error: "This member is already on the project." };
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/team`);
  return { error: null };
}

// ── Remove member from project ────────────────────────────────────────────────

export async function removeProjectMember(
  projectMemberId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Verify the project belongs to this studio before deleting
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) return { error: "Project not found." };

  const { error: dbError } = await supabase
    .from("project_members")
    .delete()
    .eq("id", projectMemberId);

  if (dbError) return { error: dbError.message };

  revalidatePath(`/projects/${projectId}/team`);
  return { error: null };
}
