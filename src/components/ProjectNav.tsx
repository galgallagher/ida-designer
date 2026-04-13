"use client";

/**
 * ProjectNav — project-specific sidebar panel.
 * Shown alongside IconRail when inside /projects/[id]/*.
 * Contains project identity + section navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, ImageIcon, Package, Users, Settings, ClipboardList } from "lucide-react";
import type { ProjectStatus } from "@/types/database";

const statusConfig: Record<ProjectStatus, { dot: string; label: string }> = {
  active:    { dot: "#22C55E", label: "Active" },
  on_hold:   { dot: "#F59E0B", label: "On Hold" },
  completed: { dot: "#6366F1", label: "Completed" },
  archived:  { dot: "#9A9590", label: "Archived" },
};

interface ProjectNavSection {
  label: string;
  href: string;
  icon: React.ElementType;
  soon?: boolean;
}

interface ProjectNavProps {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  projectStatus: ProjectStatus;
  clientName: string;
}

export default function ProjectNav({
  projectId,
  projectName,
  projectCode,
  projectStatus,
  clientName,
}: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const sections: ProjectNavSection[] = [
    { label: "Overview",  href: base,                  icon: LayoutDashboard },
    { label: "Drawings",       href: `${base}/drawings`, icon: ImageIcon },
    { label: "Project Library", href: `${base}/specs`,   icon: Package },
    { label: "Specs",          href: `${base}/specs/schedule`, icon: ClipboardList, soon: true },
    { label: "Team",           href: `${base}/team`,    icon: Users },
    { label: "Settings",       href: `${base}/settings`, icon: Settings, soon: true },
  ];

  const status = statusConfig[projectStatus] ?? statusConfig.archived;

  return (
    <aside
      className="flex flex-col py-5 flex-shrink-0"
      style={{ width: 220, backgroundColor: "#E8E6E3", height: "100%", borderRight: "1px solid #DEDAD6" }}
    >
      {/* Back to projects */}
      <Link
        href="/projects"
        className="flex items-center gap-2 px-4 mb-5 transition-opacity hover:opacity-70"
        style={{ textDecoration: "none", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500 }}
      >
        <ArrowLeft size={13} />
        All projects
      </Link>

      {/* Project identity */}
      <div className="px-4 mb-5">
        {projectCode && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
            {projectCode}
          </p>
        )}
        <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 15, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.3, marginBottom: 6 }}>
          {projectName}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: status.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
            {status.label} · {clientName}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#DEDAD6", marginBottom: 8 }} />

      {/* Nav sections */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {sections.map((section) => {
          const isActive = section.href === base
            ? pathname === base
            : pathname.startsWith(section.href);
          const Icon = section.icon;

          return (
            <div key={section.href}>
              {section.soon ? (
                <div
                  className="flex items-center gap-2.5 px-3 py-2"
                  style={{ borderRadius: 8, color: "#C0BEBB", fontFamily: "var(--font-inter), sans-serif", fontSize: 13 }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  <span>{section.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#E4E1DC", color: "#9A9590", borderRadius: 4, padding: "1px 5px", marginLeft: "auto" }}>
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  href={section.href}
                  className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${isActive ? "bg-white" : "hover:bg-black/[0.04]"}`}
                  style={{
                    borderRadius: 8,
                    textDecoration: "none",
                    boxShadow: isActive ? "0 1px 6px rgba(26,26,26,0.07)" : "none",
                    color: isActive ? "#1A1A1A" : "#9A9590",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {section.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
