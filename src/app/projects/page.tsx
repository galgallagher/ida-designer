/**
 * Projects Page — Server Component
 *
 * Shows all projects across all clients for the current studio.
 * The client handles status filtering (All / Active / On Hold / Completed / Archived).
 *
 * Data flow:
 *   1. Server fetches projects + joins client name from Supabase
 *   2. Passes all projects to ProjectsPageClient
 *   3. Client component handles filter tab state client-side (no re-fetch needed)
 *
 * Projects are created from a client's detail page (/clients/[id]) — there's
 * no standalone "New project" flow here since every project belongs to a client.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import ProjectsPageClient from "./ProjectsPageClient";
import type { ProjectRow } from "@/types/database";
import type { ProjectWithClient } from "./ProjectsPageClient";


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectsPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch projects, clients, and user's stars in parallel.
  // Hard-cap projects at 1000 — beyond that the page needs proper
  // pagination (separate change). This guards against catastrophic loads
  // for unusually large studios without changing today's behaviour.
  const [{ data: projectsData }, { data: clientsData }, { data: starsData }] = await Promise.all([
    studioId
      ? supabase.from("projects").select("*").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1000)
      : Promise.resolve({ data: [] }),
    studioId
      ? supabase.from("clients").select("id, name").eq("studio_id", studioId).limit(1000)
      : Promise.resolve({ data: [] }),
    user ? supabase.from("user_project_stars").select("project_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
  ]);

  const projects = projectsData ?? [];
  const clients = clientsData ?? [];
  const starredIds = new Set((starsData ?? []).map((s) => s.project_id));

  const clientMap: Record<string, string> = {};
  for (const client of clients) {
    clientMap[client.id] = client.name;
  }

  const projectsWithClient: ProjectWithClient[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status,
    site_address: project.site_address,
    description: project.description,
    created_at: project.created_at,
    client_id: project.client_id,
    clientName: clientMap[project.client_id] ?? "Unknown client",
    starred: starredIds.has(project.id),
  }));

  // Slim client list for the modal dropdown
  const clientsForModal = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <AppShell>
      <ProjectsPageClient projects={projectsWithClient} clients={clientsForModal} />
    </AppShell>
  );
}
