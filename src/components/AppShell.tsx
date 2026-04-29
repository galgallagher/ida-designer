/**
 * AppShell — Server Component
 *
 * The reusable layout wrapper used by all authenticated pages.
 * It pulls user/profile/studio context from the request-cached
 * `getUserContext()` helper (see ADR 029), then fetches the sidebar's
 * studio-scoped data (clients + projects + stars) in parallel.
 *
 * The sidebar itself (SidebarNav) is a Client Component so it can use
 * usePathname() to highlight the active nav item.
 */

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { signOut } from "@/app/login/actions";
import SidebarNav from "./SidebarNav";
import IdaWidget from "./IdaWidget";
import type { ClientRow } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
}

export default async function AppShell({ children }: AppShellProps) {
  const ctx = await getUserContext();
  const { user, profile, currentStudio, allStudios, isAdmin, isSuperAdmin, displayName, initials, email } = ctx;
  const role = profile?.platform_role?.replace("_", " ") ?? "member";

  // Sidebar-scoped data: clients (admins only) + projects + the user's stars.
  let clients: ClientRow[] = [];
  type SidebarProject = { id: string; name: string; status: string };
  let sidebarProjects: SidebarProject[] = [];
  let starredProjectIds = new Set<string>();

  if (user && currentStudio) {
    const supabase = await createClient();
    const [clientsRes, projectsRes, starsRes] = await Promise.all([
      isAdmin
        ? supabase
            .from("clients")
            .select("*")
            .eq("studio_id", currentStudio.id)
            .order("name", { ascending: true })
        : Promise.resolve({ data: [] as ClientRow[] }),
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
    clients = clientsRes.data ?? [];
    sidebarProjects = projectsRes.data ?? [];
    starredProjectIds = new Set((starsRes.data ?? []).map((s) => s.project_id));
  }

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
        isSuperAdmin={isSuperAdmin}
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

      {/* Ida — AI Design Assistant (persistent, all pages) */}
      <IdaWidget />
    </div>
  );
}
