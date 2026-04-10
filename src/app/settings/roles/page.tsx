/**
 * Studio Roles Settings — /settings/roles
 *
 * Admin-only page for managing configurable job title labels (e.g. Senior
 * Designer, Middleweight, Junior). Separate from system access roles.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import RolesClient from "./RolesClient";

export default async function StudioRolesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch roles in order
  const { data: rolesData } = await supabase
    .from("studio_roles")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order");

  const roles = rolesData ?? [];

  // Count members per role so the UI can warn before deleting
  const { data: memberData } = await supabase
    .from("studio_members")
    .select("studio_role_id")
    .eq("studio_id", studioId)
    .not("studio_role_id", "is", null);

  const memberCountByRole: Record<string, number> = {};
  for (const row of memberData ?? []) {
    if (row.studio_role_id) {
      memberCountByRole[row.studio_role_id] = (memberCountByRole[row.studio_role_id] ?? 0) + 1;
    }
  }

  return (
    <AppShell>
      <RolesClient roles={roles} memberCountByRole={memberCountByRole} />
    </AppShell>
  );
}
