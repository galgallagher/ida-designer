/**
 * Project Layout — wraps all /projects/[id]/* pages.
 *
 * Replaces the standard AppShell with a dual-layer nav:
 *   [IconRail 56px] [ProjectNav 220px] [main content]
 *
 * Uses request-cached `getUserContext()` (ADR 029) for auth / studio resolution,
 * then fetches all project-scoped data in a single parallel round.
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { signOut } from "@/app/login/actions";
import IconRail from "@/components/IconRail";
import ProjectNav from "@/components/ProjectNav";
import IdaWidget from "@/components/IdaWidget";
import type { ProjectStatus } from "@/types/database";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

type ProjectWithClient = {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  client_id: string;
  clients: { name: string } | null;
};

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params;

  const ctx = await getUserContext();
  if (!ctx.user) redirect("/login");
  const { initials, displayName, isAdmin, isSuperAdmin, currentStudioId } = ctx;

  // Single parallel round — none of these depend on each other.
  // The project query joins clients(name) so we don't need a follow-up round.
  const supabase = await createClient();
  const [projectRes, optionsRes, imagesRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, code, status, client_id, clients(name)")
      .eq("id", id)
      .single<ProjectWithClient>(),
    supabase
      .from("project_options")
      .select("specs(spec_categories(name))")
      .eq("project_id", id)
      .eq("studio_id", currentStudioId ?? "")
      .not("spec_id", "is", null),
    supabase
      .from("project_images")
      .select("type")
      .eq("project_id", id)
      .eq("studio_id", currentStudioId ?? ""),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  const clientName = project.clients?.name ?? "Unknown client";

  // Build category list for ProjectNav sub-nav
  const catCounts = new Map<string, number>();
  (optionsRes.data ?? []).forEach((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (o as any).specs?.spec_categories?.name as string | undefined;
    if (name) catCounts.set(name, (catCounts.get(name) ?? 0) + 1);
  });
  const optionCategories = Array.from(catCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
  const inspirationCount = (imagesRes.data ?? []).filter((i) => i.type === "inspiration").length;
  const sketchCount      = (imagesRes.data ?? []).filter((i) => i.type === "sketch").length;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#EDEDED" }}>
      {/* Collapsed icon-only main nav */}
      <IconRail initials={initials} displayName={displayName} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} signOutAction={signOut} />

      {/* Project-specific sidebar */}
      <ProjectNav
        projectId={id}
        projectName={project.name}
        projectCode={project.code}
        projectStatus={project.status}
        clientName={clientName}
        optionsSubNav={{ categories: optionCategories, inspirationCount, sketchCount }}
      />

      {/* Page content */}
      <main className="flex-1 overflow-auto" style={{ padding: 32, backgroundColor: "#EDEDED" }}>
        {children}
      </main>

      {/* Ida — pass project context so she can add specs directly to this project */}
      <IdaWidget projectId={id} projectName={project.name} />
    </div>
  );
}
