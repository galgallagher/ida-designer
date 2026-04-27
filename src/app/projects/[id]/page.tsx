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
import { ImageIcon, Package, Users, Calendar, Plus } from "lucide-react";
import type { ProjectRow, ProjectStatus } from "@/types/database";

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

  // Round 2: client + drawing/spec counts
  const [{ data: clientData }, { count: drawingCount }, { count: specCount }] = await Promise.all([
    supabase.from("clients").select("name, address").eq("id", project.client_id).single(),
    supabase.from("drawings").select("*", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("project_specs").select("*", { count: "exact", head: true }).eq("project_id", id),
  ]);

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile icon={ImageIcon} label="Drawings" value={drawingCount ?? 0} href={`/projects/${id}/drawings`} />
        <StatTile icon={Package}   label="Specs"    value={specCount ?? 0}    href={`/projects/${id}/specs`} />
        <StatTile icon={Users}     label="Team"     value={teamCount ?? 0}    href={`/projects/${id}/team`} />
        <StatTile icon={Calendar}  label="Created"  value={createdDate} />
      </div>

      {/* ── Drawings section ── */}
      <Section
        title="Drawings"
        count={drawingCount ?? 0}
        actionLabel="+ Add drawing"
        onActionHref={`/projects/${id}/drawings`}
      >
        <EmptyState
          icon={ImageIcon}
          heading="No drawings yet"
          body="Upload floor plans, elevations, and other drawings to get started."
          action="+ Add drawing"
          actionHref={`/projects/${id}/drawings`}
        />
      </Section>

      <div style={{ height: 24 }} />

      {/* ── Specs section ── */}
      <Section
        title="Project Specs"
        count={specCount ?? 0}
        actionLabel="+ Add spec"
        onActionHref={`/projects/${id}/specs`}
      >
        <EmptyState
          icon={Package}
          heading="No specs yet"
          body="Pin materials, finishes, and products to this project."
          action="+ Add spec"
          actionHref={`/projects/${id}/specs`}
        />
      </Section>
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

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  actionLabel,
  onActionHref,
  children,
}: {
  title: string;
  count: number;
  actionLabel: string;
  onActionHref: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}{count > 0 && ` · ${count}`}
        </h2>
        <Link
          href={onActionHref}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#9A9590", textDecoration: "none" }}
        >
          <Plus size={13} />
          {actionLabel.replace("+ ", "")}
        </Link>
      </div>
      {children}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
  actionHref,
}: {
  icon: React.ElementType;
  heading: string;
  body: string;
  action: string;
  actionHref: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-12"
      style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
    >
      <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 44, height: 44, backgroundColor: "#F0EEEB" }}>
        <Icon size={18} style={{ color: "#C0BEBB" }} />
      </div>
      <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
        {heading}
      </p>
      <p className="max-w-xs mb-5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.6 }}>
        {body}
      </p>
      <Link
        href={actionHref}
        className="flex items-center gap-1.5 px-4 py-2 transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}
      >
        <Plus size={14} />
        {action.replace("+ ", "")}
      </Link>
    </div>
  );
}
