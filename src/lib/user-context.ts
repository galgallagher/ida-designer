/**
 * user-context.ts
 *
 * Single source of truth for "who is the current user, and what studio are they in?"
 *
 * Wrapped in React's `cache()` so the work runs once per server request — every
 * layout, page, and helper that calls `getUserContext()` within the same
 * navigation shares the same result. See ADR 029.
 *
 * Replaces the duplicated fetch logic that used to live in AppShell,
 * ProjectLayout, and getCurrentStudioId().
 */

import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ProfileRow,
  StudioRow,
  StudioMemberRole,
} from "@/types/database";

export interface UserContext {
  user: User | null;
  profile: ProfileRow | null;
  memberships: { studio_id: string; role: StudioMemberRole }[];
  allStudios: StudioRow[];
  currentStudio: StudioRow | null;
  currentStudioId: string | null;
  studioRole: StudioMemberRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  email: string;
  displayName: string;
  initials: string;
}

const EMPTY_CONTEXT: UserContext = {
  user: null,
  profile: null,
  memberships: [],
  allStudios: [],
  currentStudio: null,
  currentStudioId: null,
  studioRole: null,
  isSuperAdmin: false,
  isAdmin: false,
  email: "",
  displayName: "User",
  initials: "U",
};

export const getUserContext = cache(async (): Promise<UserContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY_CONTEXT;

  // Profile + memberships in parallel — neither depends on the other.
  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("studio_members")
      .select("studio_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const memberships = membershipRows ?? [];
  const studioIds = memberships.map((m) => m.studio_id);

  // Fetch the studio rows the user belongs to.
  let allStudios: StudioRow[] = [];
  if (studioIds.length > 0) {
    const { data: studios } = await supabase
      .from("studios")
      .select("*")
      .in("id", studioIds);
    if (studios) {
      // Preserve membership order (oldest first).
      const map = new Map(studios.map((s) => [s.id, s]));
      allStudios = studioIds
        .map((id) => map.get(id))
        .filter((s): s is StudioRow => s !== undefined);
    }
  }

  // Resolve the current studio from cookie, falling back to the first membership.
  const cookieStore = await cookies();
  const cookieStudioId = cookieStore.get("current_studio_id")?.value;
  const currentStudio =
    (cookieStudioId && allStudios.find((s) => s.id === cookieStudioId)) ||
    allStudios[0] ||
    null;
  const currentStudioId = currentStudio?.id ?? null;

  const studioRole =
    memberships.find((m) => m.studio_id === currentStudioId)?.role ?? null;

  const isSuperAdmin = profile?.platform_role === "super_admin";
  const isAdmin =
    isSuperAdmin || studioRole === "owner" || studioRole === "admin";

  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const displayName = firstName
    ? `${firstName} ${lastName}`.trim()
    : (user.email?.split("@")[0] ?? "User");
  const initials = firstName
    ? `${firstName[0]}${lastName[0] ?? ""}`.toUpperCase()
    : (user.email?.[0] ?? "U").toUpperCase();

  return {
    user,
    profile: profile ?? null,
    memberships,
    allStudios,
    currentStudio,
    currentStudioId,
    studioRole,
    isSuperAdmin,
    isAdmin,
    email: user.email ?? "",
    displayName,
    initials,
  };
});
