/**
 * AppShell — Server Component
 *
 * The reusable layout wrapper used by all authenticated pages.
 * It handles the server-side data fetching (user + profile + studio + client list)
 * and renders the overall page structure:
 *   [Sidebar] [Main content area]
 *
 * The sidebar itself (SidebarNav) is a Client Component so it can use
 * usePathname() to highlight the active nav item.
 *
 * Usage:
 *   <AppShell>
 *     <YourPageContent />
 *   </AppShell>
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import SidebarNav from "./SidebarNav";
import type { ProfileRow, ClientRow, StudioRow, StudioMemberRole } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
}

export default async function AppShell({ children }: AppShellProps) {
  // ── Fetch user + profile ──────────────────────────────────────────────────
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  let profile: ProfileRow | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // ── Derive display name and initials ─────────────────────────────────────
  const firstName = profile?.first_name || "";
  const lastName = profile?.last_name || "";
  const displayName = firstName
    ? `${firstName} ${lastName}`.trim()
    : (user?.email?.split("@")[0] ?? "User");
  const initials = firstName
    ? `${firstName[0]}${lastName[0] ?? ""}`.toUpperCase()
    : (user?.email?.[0] ?? "U").toUpperCase();
  const role = profile?.platform_role?.replace("_", " ") ?? "member";

  // ── Fetch all studios the user belongs to ─────────────────────────────────
  let allStudios: StudioRow[] = [];
  let currentStudio: { id: string; name: string; slug: string } | null = null;

  if (user) {
    // 1. Get the studio IDs the user belongs to
    const { data: memberships } = await supabase
      .from("studio_members")
      .select("studio_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (memberships && memberships.length > 0) {
      const studioIds = memberships.map((m) => m.studio_id);

      // 2. Fetch the studio rows
      const { data: studiosData } = await supabase
        .from("studios")
        .select("*")
        .in("id", studioIds);

      if (studiosData) {
        // Preserve the order from studio_members (by membership created_at)
        const studioMap = new Map(studiosData.map((s) => [s.id, s]));
        allStudios = studioIds
          .map((id) => studioMap.get(id))
          .filter((s): s is StudioRow => s !== undefined);
      }
    }

    // Determine current studio from cookie, falling back to first
    const cookieStore = await cookies();
    const cookieStudioId = cookieStore.get("current_studio_id")?.value;
    const matchedStudio = cookieStudioId
      ? allStudios.find((s) => s.id === cookieStudioId)
      : null;
    currentStudio = matchedStudio ?? allStudios[0] ?? null;
  }

  // ── Fetch the user's role in the current studio ───────────────────────────
  let studioRole: StudioMemberRole | null = null;
  if (user && currentStudio) {
    const { data: memberRow } = await supabase
      .from("studio_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("studio_id", currentStudio.id)
      .single();
    studioRole = memberRow?.role ?? null;
  }

  // Super admins always get full access
  const isAdmin =
    profile?.platform_role === "super_admin" ||
    studioRole === "owner" ||
    studioRole === "admin";

  // ── Fetch clients for the sidebar sub-list (admins only) ──────────────────
  let clients: ClientRow[] = [];
  if (user && currentStudio && isAdmin) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("studio_id", currentStudio.id)
      .order("name", { ascending: true });
    clients = data ?? [];
  }

  // ── Fetch projects + user's starred project IDs for sidebar ───────────────
  type SidebarProject = { id: string; name: string; status: string };
  let sidebarProjects: SidebarProject[] = [];
  let starredProjectIds = new Set<string>();

  if (user && currentStudio) {
    const [{ data: projData }, { data: starsData }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, status")
        .eq("studio_id", currentStudio.id)
        .order("name", { ascending: true }),
      supabase
        .from("user_project_stars")
        .select("project_id")
        .eq("user_id", user.id),
    ]);
    sidebarProjects = projData ?? [];
    starredProjectIds = new Set((starsData ?? []).map((s) => s.project_id));
  }

  const email = user?.email ?? "";

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "#EDEDED" }}
    >
      {/* Sidebar — client component for interactivity */}
      <SidebarNav
        profile={profile}
        displayName={displayName}
        initials={initials}
        role={role}
        email={email}
        clients={clients}
        currentStudio={currentStudio}
        allStudios={allStudios.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        signOutAction={signOut}
        isAdmin={isAdmin}
        projects={sidebarProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          starred: starredProjectIds.has(p.id),
        }))}
      />

      {/* Main content area — scrollable, with padding */}
      <main
        className="flex-1 overflow-auto"
        style={{ padding: 28, backgroundColor: "#EDEDED" }}
      >
        {children}
      </main>
    </div>
  );
}
