"use client";

/**
 * ProjectNav — project-specific sidebar panel.
 * Shown alongside IconRail when inside /projects/[id]/*.
 * Contains project identity + section navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Package, Users, Settings, Palette } from "lucide-react";
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

interface OptionsSubNav {
  categories: { label: string; count: number }[];
  inspirationCount: number;
  sketchCount: number;
}

interface ProjectNavProps {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  projectStatus: ProjectStatus;
  clientName: string;
  optionsSubNav?: OptionsSubNav;
}

export default function ProjectNav({
  projectId,
  projectName,
  projectCode,
  projectStatus,
  clientName,
  optionsSubNav,
}: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const sections: ProjectNavSection[] = [
    { label: "Overview",         href: base,               icon: LayoutDashboard },
    { label: "Canvas",           href: `${base}/canvas`,   icon: Palette },
    { label: "Project Options",  href: `${base}/options`,  icon: Package },
    { label: "Team",             href: `${base}/team`,     icon: Users },
    { label: "Settings",         href: `${base}/settings`, icon: Settings },
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
          const hasChildSection = sections.some(
            (s) => s.href !== section.href && s.href.startsWith(section.href + "/")
          );
          const isActive = section.href === base
            ? pathname === base
            : hasChildSection
              ? pathname === section.href
              : pathname.startsWith(section.href);
          const isOptions = section.href === `${base}/options`;
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
                <>
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

                  {/* Sub-nav: shown when on Project Options */}
                  {isOptions && isActive && optionsSubNav && (
                    <div className="flex flex-col gap-0.5 mt-0.5 mb-1" style={{ paddingLeft: 28 }}>
                      {optionsSubNav.categories.map(({ label, count }) => (
                        <Link
                          key={label}
                          href={`${base}/options?s=${encodeURIComponent(label)}`}
                          className="flex items-center justify-between px-2 py-1 rounded-md transition-colors hover:bg-black/[0.04]"
                          style={{ textDecoration: "none", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}
                        >
                          <span className="truncate">{label}</span>
                          {count > 0 && <span style={{ fontSize: 11, color: "#C0BEBB", flexShrink: 0, marginLeft: 4 }}>{count}</span>}
                        </Link>
                      ))}
                      <Link
                        href={`${base}/options?s=inspiration`}
                        className="flex items-center justify-between px-2 py-1 rounded-md transition-colors hover:bg-black/[0.04]"
                        style={{ textDecoration: "none", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}
                      >
                        <span>Inspiration</span>
                        {optionsSubNav.inspirationCount > 0 && <span style={{ fontSize: 11, color: "#C0BEBB", flexShrink: 0, marginLeft: 4 }}>{optionsSubNav.inspirationCount}</span>}
                      </Link>
                      <Link
                        href={`${base}/options?s=sketch`}
                        className="flex items-center justify-between px-2 py-1 rounded-md transition-colors hover:bg-black/[0.04]"
                        style={{ textDecoration: "none", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}
                      >
                        <span>Sketches</span>
                        {optionsSubNav.sketchCount > 0 && <span style={{ fontSize: 11, color: "#C0BEBB", flexShrink: 0, marginLeft: 4 }}>{optionsSubNav.sketchCount}</span>}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
