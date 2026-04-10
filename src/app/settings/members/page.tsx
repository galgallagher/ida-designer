/**
 * Team Members Settings — /settings/members
 *
 * Lists all studio members (active and pending). Admins can add people,
 * change access levels, assign job titles, and remove members.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import MembersClient, { type MemberWithProfile } from "./MembersClient";

export default async function TeamMembersPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all studio members
  const { data: membersData } = await supabase
    .from("studio_members")
    .select("id, user_id, role, studio_role_id, email, first_name, last_name, created_at")
    .eq("studio_id", studioId)
    .order("created_at");

  const memberRows = membersData ?? [];

  // Fetch profiles only for active members (those with a user_id)
  const activeUserIds = memberRows.filter((m) => m.user_id).map((m) => m.user_id as string);
  const { data: profilesData } = activeUserIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", activeUserIds)
    : { data: [] };

  const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));

  // Merge: active members get their name from profiles, pending from the row itself
  const members: MemberWithProfile[] = memberRows.map((m) => {
    const profile = m.user_id ? (profileMap.get(m.user_id) ?? null) : null;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      studio_role_id: m.studio_role_id,
      created_at: m.created_at,
      email: m.email,
      first_name: profile?.first_name ?? m.first_name,
      last_name: profile?.last_name ?? m.last_name,
    };
  });

  // Fetch configured job title roles
  const { data: rolesData } = await supabase
    .from("studio_roles")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const roles = rolesData ?? [];

  return (
    <AppShell>
      <MembersClient members={members} roles={roles} currentUserId={user.id} />
    </AppShell>
  );
}
