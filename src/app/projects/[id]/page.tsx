/**
 * Project Overview — /projects/[id]
 *
 * The project dashboard. Shows:
 * - Project header (code, name, status, client, address)
 * - Stat tiles (drawings, specs, team, created date)
 * - Drawings section (empty state for now)
 * - Specs section (empty state for now)
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Users, Calendar } from "lucide-react";
import type { ProjectStatus } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusConfig: Record<ProjectStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:    { label: "Active",    dot: "#22C55E", text: "#15803D", bg: "#DCFCE7" },
  on_hold:   { label: "On Hold",   dot: "#F59E0B", text: "#B45309", bg: "#FEF3C7" },
  completed: { label: "Completed", dot: "#6366F1", text: "#4338CA", bg: "#EEF2FF" },
  archived:  { label: "Archived",  dot: "#9A9590", text: "#6B7280", bg: "#F3F4F6" },
};

export default async function ProjectOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Round 1: project + team
  const [{ data: projectData }, { count: teamCount }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("project_members").select("*", { count: "exact", head: true }).eq("project_id", id),
  ]);

  if (!projectData) notFound();
  const project = projectData;

  // Round 2: client
  const { data: clientData } = await supabase
    .from("clients").select("name, address").eq("id", project.client_id).single();

  const client = clientData;

  const status = statusConfig[project.status] ?? statusConfig.archived;

  const createdDate = new Date(project.created_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="max-w-5xl">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-6" style={{ fontSize: 12, fontFamily: "var(--font-inter), sans-serif", color: "#9A9590" }}>
        <Link href="/projects" style={{ color: "#9A9590", textDecoration: "none" }} className="hover:text-[#1A1A1A] transition-colors">
          Projects
        </Link>
        <span>/</span>
        {project.code && <span style={{ color: "#C0BEBB" }}>{project.code}</span>}
        {project.code && <span>/</span>}
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{project.name}</span>
      </div>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          {project.code && (
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              {project.code}
            </p>
          )}
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 30, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 6 }}>
            {project.name}
          </h1>
          <div className="flex items-center gap-3" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {client && <span>{client.name}</span>}
            {client?.address && <><span style={{ color: "#E4E1DC" }}>·</span><span>{client.address}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ backgroundColor: status.bg, borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: status.text }}
          >
            <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: status.dot, display: "inline-block" }} />
            {status.label}
          </span>

          {/* Edit button */}
          <button
            type="button"
            style={{ height: 34, paddingLeft: 16, paddingRight: 16, backgroundColor: "#FFFFFF", border: "1px solid #E4E1DC", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}
            className="transition-shadow hover:shadow-sm"
          >
            Edit project
          </button>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-8">
        <StatTile icon={Users}    label="Team"    value={teamCount ?? 0} href={`/projects/${id}/team`} />
        <StatTile icon={Calendar} label="Created" value={createdDate} />
      </div>
    </div>
  );
}

// ── StatTile ──────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <div
      className="bg-white flex flex-col gap-3 p-4"
      style={{ borderRadius: 14, boxShadow: "0 2px 12px rgba(26,26,26,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </p>
        <Icon size={14} style={{ color: "#C0BEBB" }} />
      </div>
      <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#1A1A1A", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: "none" }} className="transition-transform hover:-translate-y-0.5">{inner}</Link>;
  }
  return inner;
}

