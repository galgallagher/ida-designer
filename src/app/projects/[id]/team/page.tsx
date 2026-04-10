/**
 * Project Team — /projects/[id]/team
 *
 * Shows and manages which studio members are assigned to a specific project.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import ProjectTeamClient, {
  type ProjectMemberEntry,
  type StudioMemberOption,
} from "./ProjectTeamClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectTeamPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  // Verify project exists and belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) notFound();

  // ── Fetch assigned project members ──────────────────────────────────────────

  const { data: projectMembersData } = await supabase
    .from("project_members")
    .select("id, studio_member_id")
    .eq("project_id", projectId)
    .order("created_at");

  const projectMembers = projectMembersData ?? [];
  const assignedStudioMemberIds = new Set(projectMembers.map((pm) => pm.studio_member_id));

  // ── Fetch all studio members ────────────────────────────────────────────────

  const { data: studioMembersData } = await supabase
    .from("studio_members")
    .select("id, user_id, role, studio_role_id, first_name, last_name")
    .eq("studio_id", studioId);

  const studioMembers = studioMembersData ?? [];

  // ── Fetch profiles (only for active members with a user_id) ────────────────

  const userIds = studioMembers.map((m) => m.user_id).filter((id): id is string => id !== null);
  const { data: profilesData } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));

  // ── Fetch studio roles ──────────────────────────────────────────────────────

  const { data: rolesData } = await supabase
    .from("studio_roles")
    .select("id, name")
    .eq("studio_id", studioId);

  const roleMap = new Map((rolesData ?? []).map((r) => [r.id, r.name]));

  // ── Build assigned + available lists ───────────────────────────────────────

  const projectMemberMap = new Map(projectMembers.map((pm) => [pm.studio_member_id, pm.id]));

  const assignedMembers: ProjectMemberEntry[] = studioMembers
    .filter((sm) => assignedStudioMemberIds.has(sm.id))
    .map((sm) => {
      const profile = sm.user_id ? (profileMap.get(sm.user_id) ?? null) : null;
      return {
        projectMemberId: projectMemberMap.get(sm.id)!,
        studioMemberId: sm.id,
        userId: sm.user_id,
        role: sm.role,
        jobTitle: sm.studio_role_id ? (roleMap.get(sm.studio_role_id) ?? null) : null,
        firstName: profile?.first_name ?? sm.first_name ?? null,
        lastName: profile?.last_name ?? sm.last_name ?? null,
      };
    });

  const availableMembers: StudioMemberOption[] = studioMembers
    .filter((sm) => !assignedStudioMemberIds.has(sm.id))
    .map((sm) => {
      const profile = sm.user_id ? (profileMap.get(sm.user_id) ?? null) : null;
      return {
        studioMemberId: sm.id,
        userId: sm.user_id,
        role: sm.role,
        jobTitle: sm.studio_role_id ? (roleMap.get(sm.studio_role_id) ?? null) : null,
        firstName: profile?.first_name ?? sm.first_name ?? null,
        lastName: profile?.last_name ?? sm.last_name ?? null,
      };
    });

  return (
    <ProjectTeamClient
      projectId={projectId}
      projectName={project.name}
      assignedMembers={assignedMembers}
      availableMembers={availableMembers}
    />
  );
}
