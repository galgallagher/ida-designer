"use client";

/**
 * ProjectsPageClient — Client Component
 *
 * Features:
 * - Status filter tabs
 * - Search by name or code
 * - Sort by code (default), name, client, or status
 * - Toggle between list and tile view
 * - Star projects (float to top)
 *
 * All preferences (sort, view) are persisted to localStorage — per user,
 * per browser. No server state needed for pure UI preferences.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Star, LayoutList, LayoutGrid, Search, ArrowUpDown } from "lucide-react";
import type { ProjectStatus } from "@/types/database";
import { toggleProjectStar } from "./actions";
import AddProjectModal from "./AddProjectModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectWithClient {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  site_address: string | null;
  description: string | null;
  created_at: string;
  client_id: string;
  clientName: string;
  starred: boolean;
}

type SortKey = "code" | "name" | "client" | "status";
type ViewMode = "list" | "tiles";

interface ProjectsPageClientProps {
  projects: ProjectWithClient[];
  clients: { id: string; name: string }[];
}

// ── Status config ──────────────────────────────────────────────────────────────

export const statusConfig: Record<
  ProjectStatus,
  { label: string; dotColor: string; textColor: string; bgColor: string }
> = {
  active:    { label: "Active",    dotColor: "#22C55E", textColor: "#15803D", bgColor: "#DCFCE7" },
  on_hold:   { label: "On Hold",   dotColor: "#F59E0B", textColor: "#B45309", bgColor: "#FEF3C7" },
  completed: { label: "Completed", dotColor: "#6366F1", textColor: "#4338CA", bgColor: "#EEF2FF" },
  archived:  { label: "Archived",  dotColor: "#9A9590", textColor: "#6B7280", bgColor: "#F3F4F6" },
};

const filterTabs: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "All",       value: "all" },
  { label: "Active",    value: "active" },
  { label: "On Hold",   value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Archived",  value: "archived" },
];

const sortOptions: { label: string; value: SortKey }[] = [
  { label: "Code",    value: "code" },
  { label: "Name",    value: "name" },
  { label: "Client",  value: "client" },
  { label: "Status",  value: "status" },
];

const PREFS_KEY = "projects_prefs";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectsPageClient({ projects, clients }: ProjectsPageClientProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load user prefs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.sortKey) setSortKey(prefs.sortKey);
        if (prefs.viewMode) setViewMode(prefs.viewMode);
      }
    } catch { /* ignore */ }
    setPrefsLoaded(true);
  }, []);

  // Persist prefs whenever they change
  useEffect(() => {
    if (!prefsLoaded) return;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sortKey, viewMode }));
  }, [sortKey, viewMode, prefsLoaded]);

  // Filter → search → sort
  const filtered = useMemo(() => {
    let result = activeFilter === "all"
      ? projects
      : projects.filter((p) => p.status === activeFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      // Starred always float to top
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      switch (sortKey) {
        case "code":   return (a.code ?? "").localeCompare(b.code ?? "");
        case "name":   return a.name.localeCompare(b.name);
        case "client": return a.clientName.localeCompare(b.clientName);
        case "status": return a.status.localeCompare(b.status);
        default:       return 0;
      }
    });
  }, [projects, activeFilter, search, sortKey]);

  const counts: Record<string, number> = { all: projects.length };
  for (const status of Object.keys(statusConfig) as ProjectStatus[]) {
    counts[status] = projects.filter((p) => p.status === status).length;
  }

  return (
    <div>
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Projects
          </h1>
          <p className="mt-1" style={{ fontSize: 13, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
            {projects.length} {projects.length === 1 ? "project" : "projects"} across all clients
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFDE28", borderRadius: 10, fontFamily: "var(--font-inter), sans-serif", border: "none", cursor: "pointer", color: "#1A1A1A" }}
        >
          + New project
        </button>
      </div>

      {/* ── Toolbar: filters + search + sort + view toggle ────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderRadius: 999,
                  backgroundColor: isActive ? "#1A1A1A" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#9A9590",
                  boxShadow: isActive ? "0 2px 8px rgba(26,26,26,0.2)" : "0 1px 4px rgba(26,26,26,0.06)",
                  fontFamily: "var(--font-inter), sans-serif",
                  border: "none", cursor: "pointer",
                }}
              >
                {tab.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "#F0EEEB", color: isActive ? "#FFFFFF" : "#9A9590" }}>
                  {counts[tab.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative" style={{ minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#C0BEBB", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              height: 34, paddingLeft: 30, paddingRight: 12,
              border: "1px solid #E4E1DC", borderRadius: 8,
              backgroundColor: "#FFFFFF", fontFamily: "var(--font-inter), sans-serif",
              fontSize: 13, color: "#1A1A1A", outline: "none", width: "100%",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#FFDE28"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#E4E1DC"}
          />
        </div>

        {/* Sort */}
        <div className="relative flex items-center gap-1.5">
          <ArrowUpDown size={13} style={{ color: "#9A9590", flexShrink: 0 }} />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{
              height: 34, paddingLeft: 4, paddingRight: 24,
              border: "none", background: "none", cursor: "pointer",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 13,
              color: "#9A9590", outline: "none", appearance: "none",
            }}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>Sort: {opt.label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-1 bg-white rounded-lg" style={{ boxShadow: "0 1px 4px rgba(26,26,26,0.06)" }}>
          {([["list", LayoutList], ["tiles", LayoutGrid]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              title={mode === "list" ? "List view" : "Tile view"}
              style={{
                width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 6, border: "none", cursor: "pointer",
                backgroundColor: viewMode === mode ? "#F0EEEB" : "transparent",
                color: viewMode === mode ? "#1A1A1A" : "#C0BEBB",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24">
          <div className="flex items-center justify-center rounded-full mb-4" style={{ width: 56, height: 56, backgroundColor: "#F0EEEB" }}>
            <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, color: "#FFDE28", fontWeight: 600 }}>i</span>
          </div>
          <h2 className="mb-2" style={{ fontFamily: "var(--font-playfair), serif", fontSize: 20, fontWeight: 500, color: "#1A1A1A" }}>
            {search ? "No matching projects" : `No ${activeFilter === "all" ? "" : statusConfig[activeFilter as ProjectStatus]?.label.toLowerCase() + " "}projects`}
          </h2>
          <p className="max-w-sm" style={{ fontSize: 14, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
            {search ? "Try a different search term." : activeFilter === "all" ? "Click '+ New project' to get started." : "No projects with this status yet."}
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </div>
      )}

      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        clients={clients}
      />
    </div>
  );
}

// ── ProjectRow (list view) ─────────────────────────────────────────────────────

function ProjectRow({ project }: { project: ProjectWithClient }) {
  const status = statusConfig[project.status] ?? statusConfig.archived;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-white transition-shadow hover:shadow-md group"
      style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.07)" }}
    >
      {/* Star */}
      <form action={toggleProjectStar.bind(null, project.id, project.starred)}>
        <button type="submit" title={project.starred ? "Unstar" : "Star"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0, color: project.starred ? "#FFDE28" : "#D4D2CF" }}>
          <Star size={13} fill={project.starred ? "#FFDE28" : "none"} className={project.starred ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"} />
        </button>
      </form>

      {/* Status dot */}
      <div className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: status.dotColor }} />

      {/* Clickable content */}
      <Link href={`/projects/${project.id}`} className="flex-1 flex items-center gap-4 min-w-0" style={{ textDecoration: "none" }}>
        {/* Code + name */}
        <div className="flex items-baseline gap-2 flex-1 min-w-0">
          {project.code && (
            <span className="flex-shrink-0" style={{ fontSize: 12, fontWeight: 600, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", letterSpacing: "0.04em" }}>
              {project.code}
            </span>
          )}
          <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif" }}>
            {project.name}
          </span>
          {project.site_address && (
            <span className="truncate hidden sm:block" style={{ fontSize: 12, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif" }}>
              {project.site_address}
            </span>
          )}
        </div>

        {/* Client pill */}
        <span className="px-2.5 py-1 text-xs font-medium flex-shrink-0" style={{ backgroundColor: "#F0EEEB", borderRadius: 999, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", whiteSpace: "nowrap" }}>
          {project.clientName}
        </span>

        {/* Status */}
        <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: status.textColor, fontFamily: "var(--font-inter), sans-serif", minWidth: 68, textAlign: "right" }}>
          {status.label}
        </span>
      </Link>
    </div>
  );
}

// ── ProjectTile (grid view) ────────────────────────────────────────────────────

function ProjectTile({ project }: { project: ProjectWithClient }) {
  const status = statusConfig[project.status] ?? statusConfig.archived;

  return (
    <div className="bg-white flex flex-col overflow-hidden group" style={{ borderRadius: 14, boxShadow: "0 2px 12px rgba(26,26,26,0.08)" }}>
      {/* Cover area */}
      <div className="relative flex-shrink-0" style={{ height: 140, background: "linear-gradient(135deg, #F7F6F4 0%, #EDECEA 100%)" }}>
        {/* Star */}
        <form action={toggleProjectStar.bind(null, project.id, project.starred)} style={{ position: "absolute", top: 10, right: 10 }}>
          <button type="submit" title={project.starred ? "Unstar" : "Star"} style={{ background: "white", border: "none", cursor: "pointer", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", color: project.starred ? "#FFDE28" : "#D4D2CF" }}>
            <Star size={13} fill={project.starred ? "#FFDE28" : "none"} className={project.starred ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"} />
          </button>
        </form>
      </div>

      {/* Card body */}
      <Link href={`/projects/${project.id}`} className="flex flex-col gap-2 p-4" style={{ textDecoration: "none", flex: 1 }}>
        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <div className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: status.dotColor }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: status.textColor, fontFamily: "var(--font-inter), sans-serif", textTransform: "uppercase" }}>
            {status.label}
          </span>
        </div>

        {/* Code + name */}
        <div>
          {project.code && (
            <p style={{ fontSize: 11, fontWeight: 600, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", letterSpacing: "0.04em", marginBottom: 2 }}>
              {project.code}
            </p>
          )}
          <h3 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 17, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.3 }}>
            {project.name}
          </h3>
        </div>

        {/* Client + address */}
        <div style={{ marginTop: "auto" }}>
          <div style={{ height: 1, backgroundColor: "#F0EEEB", marginBottom: 10 }} />
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
              {project.clientName}
            </span>
            <span style={{ fontSize: 11, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif" }}>
              0 drawings · 0 specs
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
