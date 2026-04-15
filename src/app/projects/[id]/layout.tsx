/**
 * Project Layout — wraps all /projects/[id]/* pages.
 *
 * Replaces the standard AppShell with a dual-layer nav:
 *   [IconRail 56px] [ProjectNav 220px] [main content]
 *
 * Fetches the project + client name server-side so ProjectNav has what it needs.
 */

import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import IconRail from "@/components/IconRail";
import ProjectNav from "@/components/ProjectNav";
import IdaWidget from "@/components/IdaWidget";
import type { ProfileRow, ProjectRow, StudioMemberRole, StudioRow } from "@/types/database";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Round 2: fetch profile, memberships, and project all in parallel —
  // none depend on each other, they only need user.id and the URL param id.
  const cookieStore = await cookies();
  const [{ data: profileData }, { data: memberships }, { data: projectData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("studio_members").select("studio_id, role").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("projects").select("*").eq("id", id).single(),
  ]);

  if (!projectData) notFound();
  const project = projectData;
  const profile = profileData;

  const firstName = profile?.first_name || "";
  const lastName  = profile?.last_name  || "";
  const displayName = firstName ? `${firstName} ${lastName}`.trim() : (user.email?.split("@")[0] ?? "User");
  const initials  = firstName
    ? `${firstName[0]}${lastName[0] ?? ""}`.toUpperCase()
    : (user.email?.[0] ?? "U").toUpperCase();

  const cookieStudioId = cookieStore.get("current_studio_id")?.value;
  const studioIds = (memberships ?? []).map((m) => m.studio_id);
  const currentStudioId = (cookieStudioId && studioIds.includes(cookieStudioId))
    ? cookieStudioId
    : studioIds[0] ?? null;

  const currentMembership = (memberships ?? []).find((m) => m.studio_id === currentStudioId);
  const studioRole = currentMembership?.role ?? null;
  const isAdmin = profile?.platform_role === "super_admin" || studioRole === "owner" || studioRole === "admin";

  // Round 3: client name — only needs project.client_id which we now have
  const { data: clientData } = await supabase
    .from("clients")
    .select("name")
    .eq("id", project.client_id)
    .single();

  const clientName = clientData?.name ?? "Unknown client";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#EDEDED" }}>
      {/* Collapsed icon-only main nav */}
      <IconRail initials={initials} displayName={displayName} isAdmin={isAdmin} signOutAction={signOut} />

      {/* Project-specific sidebar */}
      <ProjectNav
        projectId={id}
        projectName={project.name}
        projectCode={project.code}
        projectStatus={project.status}
        clientName={clientName}
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
