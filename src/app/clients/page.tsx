/**
 * Clients Page — Server Component
 *
 * Shows all clients for the current user's studio(s).
 * Design: "Option D — Floating Cards" from the Pencil designs.
 *
 * Data flow:
 *   1. Server fetches clients + project counts from Supabase
 *   2. Renders client cards with name, contact info, and project stats
 *   3. Each card links to the client detail page (/clients/[id])
 *   4. The "Add client" button is handled by ClientsPageClient (Client Component)
 *
 * RLS: The clients table has a super_admin bypass policy, so Gal sees all clients.
 * Regular studio members only see clients in their own studio (enforced by Supabase).
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import ClientsPageClient from "./ClientsPageClient";
import type { ClientRow, ProjectRow } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

/** A client record with its project counts pre-calculated */
interface ClientWithStats extends ClientRow {
  totalProjects: number;
  activeProjects: number;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientsPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();

  // Fetch clients scoped to the current studio (explicit filter + RLS)
  const { data: clientsData } = studioId
    ? await supabase
        .from("clients")
        .select("*")
        .eq("studio_id", studioId)
        .order("name", { ascending: true })
    : { data: [] };

  const clients = (clientsData as ClientRow[]) ?? [];

  // Fetch projects scoped to the current studio for accurate counts
  const { data: projectsData } = studioId
    ? await supabase
        .from("projects")
        .select("id, client_id, status")
        .eq("studio_id", studioId)
    : { data: [] };

  const projects = (projectsData as Pick<ProjectRow, "id" | "client_id" | "status">[]) ?? [];

  // Build a map: client_id → { total, active }
  const projectStats: Record<string, { total: number; active: number }> = {};
  for (const project of projects) {
    if (!projectStats[project.client_id]) {
      projectStats[project.client_id] = { total: 0, active: 0 };
    }
    projectStats[project.client_id].total++;
    if (project.status === "active") {
      projectStats[project.client_id].active++;
    }
  }

  // Merge stats into client records
  const clientsWithStats: ClientWithStats[] = clients.map((client) => ({
    ...client,
    totalProjects: projectStats[client.id]?.total ?? 0,
    activeProjects: projectStats[client.id]?.active ?? 0,
  }));

  return (
    <AppShell>
      <ClientsPageClient>
        {/* ── Client cards ───────────────────────────────────────── */}
        {clientsWithStats.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center py-24">
            <div
              className="flex items-center justify-center rounded-full mb-4"
              style={{ width: 56, height: 56, backgroundColor: "#F0EEEB" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: 28,
                  color: "#FFDE28",
                  fontWeight: 600,
                }}
              >
                i
              </span>
            </div>
            <h2
              className="mb-2"
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 20,
                fontWeight: 500,
                color: "#1A1A1A",
              }}
            >
              No clients yet
            </h2>
            <p
              className="mb-6 max-w-sm"
              style={{ fontSize: 14, color: "#9A9590" }}
            >
              Add your first client to start tracking projects and specs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientsWithStats.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </ClientsPageClient>
    </AppShell>
  );
}

// ── ClientCard ────────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: ClientWithStats }) {
  // First letter of the client name for the avatar
  const initial = client.name[0]?.toUpperCase() ?? "?";

  // Status dot: green if they have active projects, yellow if not
  const hasActiveProjects = client.activeProjects > 0;

  return (
    <Link
      href={`/clients/${client.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 bg-white transition-shadow hover:shadow-md cursor-pointer"
        style={{
          borderRadius: 14,
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
        }}
      >
        {/* Avatar circle */}
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0 font-semibold text-[#FFDE28]"
          style={{
            width: 40,
            height: 40,
            backgroundColor: "#1A1A1A",
            fontSize: 16,
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          {initial}
        </div>

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-[#1A1A1A] truncate"
            style={{
              fontSize: 14,
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            {client.name}
          </p>
          <p
            className="truncate mt-0.5"
            style={{
              fontSize: 12,
              color: "#9A9590",
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            {[client.email, client.phone].filter(Boolean).join("  ·  ") || "No contact info"}
          </p>
        </div>

        {/* Right: project count pill + status dot */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Project count badge */}
          <span
            className="px-3 py-1 text-xs font-medium text-[#9A9590]"
            style={{
              backgroundColor: "#F0EEEB",
              borderRadius: 999,
              fontFamily: "var(--font-inter), sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            {client.totalProjects} {client.totalProjects === 1 ? "project" : "projects"}
          </span>

          {/* Status dot */}
          <div
            className="rounded-full flex-shrink-0"
            title={hasActiveProjects ? "Has active projects" : "No active projects"}
            style={{
              width: 8,
              height: 8,
              backgroundColor: hasActiveProjects ? "#22C55E" : "#FFDE28",
            }}
          />
        </div>
      </div>
    </Link>
  );
}
