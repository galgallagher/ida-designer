/**
 * Client Detail Page — Server Component
 *
 * Shows a specific client's projects as cards.
 * Matches the "Projects List — Hilton Hotels" Pencil design.
 *
 * URL pattern: /clients/[id]
 * Example: /clients/22222222-0000-0000-0000-000000000001
 *
 * Data flow:
 *   1. Fetch the client record by ID
 *   2. Fetch all projects for that client
 *   3. Render project cards in a 3-column grid
 *   4. The "New project" button is handled by ClientDetailPageClient
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import ClientDetailPageClient from "./ClientDetailPageClient";
import type { ClientRow, ProjectRow, ProjectStatus, ContactRow } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Status config — colours and labels for each project status ────────────────

const statusConfig: Record<
  ProjectStatus,
  { label: string; dotColor: string; textColor: string }
> = {
  active:    { label: "ACTIVE",    dotColor: "#22C55E", textColor: "#15803D" },
  on_hold:   { label: "ON HOLD",   dotColor: "#F59E0B", textColor: "#B45309" },
  completed: { label: "COMPLETED", dotColor: "#6366F1", textColor: "#4338CA" },
  archived:  { label: "ARCHIVED",  dotColor: "#9A9590", textColor: "#6B7280" },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();

  // Fetch the client — if not found or no access, show 404
  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!clientData) {
    notFound();
  }

  const client = clientData;

  // Fetch all projects for this client, scoped to the current studio
  const projectsQuery = supabase
    .from("projects")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (studioId) {
    projectsQuery.eq("studio_id", studioId);
  }

  const { data: projectsData } = await projectsQuery;

  const projects = projectsData ?? [];

  // Fetch contacts for this client
  const { data: contactsData } = await supabase
    .from("contacts")
    .select("*")
    .eq("client_id", id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  const contacts = contactsData ?? [];
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <AppShell>
      <ClientDetailPageClient
        clientId={id}
        clientName={client.name}
        clientAddress={client.address}
        activeCount={activeCount}
        contacts={contacts}
      >
        {/* ── Project cards grid ─────────────────────────────────── */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <p
              style={{
                fontSize: 14,
                color: "#9A9590",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              No projects yet for {client.name}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </ClientDetailPageClient>
    </AppShell>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectRow }) {
  const status = statusConfig[project.status] ?? statusConfig.archived;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="bg-white flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
      style={{
        borderRadius: 14,
        boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
        textDecoration: "none",
      }}
    >
      {/* Image / placeholder area */}
      <div
        className="w-full flex-shrink-0"
        style={{
          height: 160,
          background: "linear-gradient(135deg, #F7F6F4 0%, #EDECEA 100%)",
          borderRadius: "14px 14px 0 0",
        }}
      />

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2">
        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <div
            className="rounded-full flex-shrink-0"
            style={{ width: 7, height: 7, backgroundColor: status.dotColor }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: status.textColor,
              fontFamily: "var(--font-inter), sans-serif",
              textTransform: "uppercase",
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Project name */}
        <h3
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 18,
            fontWeight: 700,
            color: "#1A1A1A",
            lineHeight: 1.3,
          }}
        >
          {project.name}
        </h3>

        {/* Site address + project code */}
        <div>
          {project.site_address && (
            <p
              style={{
                fontSize: 12,
                color: "#9A9590",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              {project.site_address}
            </p>
          )}
          {project.code && (
            <p
              style={{
                fontSize: 12,
                color: "#C0BEBB",
                fontFamily: "var(--font-inter), sans-serif",
                marginTop: 2,
              }}
            >
              {project.code}
            </p>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            backgroundColor: "#E4E1DC",
            marginTop: 4,
          }}
        />

        {/* Bottom meta */}
        <p
          style={{
            fontSize: 11,
            color: "#C0BEBB",
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          0 drawings · 0 specs
        </p>
      </div>
    </Link>
  );
}
