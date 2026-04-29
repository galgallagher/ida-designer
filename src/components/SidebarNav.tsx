"use client";

/**
 * SidebarNav — collapsible hover sidebar
 *
 * Collapsed: 56px icon-only strip (same pattern as IconRail in project pages).
 * Expanded:  240px on hover — shows labels, studio switcher, sub-lists, user card.
 * Transition: width 0.22s cubic-bezier, labels/text fade in with 0.08s delay.
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Users, Briefcase, Package, BookUser, LogOut, Star, Settings, Layers, ShieldCheck } from "lucide-react";
import type { ProfileRow, ClientRow } from "@/types/database";
import StudioSwitcher from "./StudioSwitcher";
import { toggleProjectStar } from "@/app/projects/actions";

// ── Nav items ────────────────────────────────────────────────────────────────

const allNavItems = [
  { label: "Clients",         href: "/clients",  icon: Users,       adminOnly: true,  superAdminOnly: false },
  { label: "Projects",        href: "/projects", icon: Briefcase,   adminOnly: false, superAdminOnly: false },
  { label: "Product Library", href: "/specs",    icon: Package,     adminOnly: false, superAdminOnly: false },
  { label: "Finishes",        href: "/finishes", icon: Layers,      adminOnly: false, superAdminOnly: false },
  { label: "Contacts",        href: "/contacts", icon: BookUser,    adminOnly: false, superAdminOnly: false },
  { label: "Settings",        href: "/settings", icon: Settings,    adminOnly: true,  superAdminOnly: false },
  { label: "Admin",           href: "/admin",    icon: ShieldCheck, adminOnly: false, superAdminOnly: true  },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Studio {
  id: string;
  name: string;
  slug: string;
}

export interface SidebarProject {
  id: string;
  name: string;
  status: string;
  starred: boolean;
}

interface SidebarNavProps {
  profile: ProfileRow | null;
  displayName: string;
  initials: string;
  role: string;
  email: string;
  clients?: ClientRow[];
  projects?: SidebarProject[];
  currentStudio: { id: string; name: string } | null;
  allStudios: Studio[];
  signOutAction: () => Promise<void>;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

// ── Fade helper styles ────────────────────────────────────────────────────────

function fadeStyle(expanded: boolean): React.CSSProperties {
  return {
    opacity: expanded ? 1 : 0,
    transition: "opacity 0.15s ease",
    transitionDelay: expanded ? "0.08s" : "0s",
    whiteSpace: "nowrap",
    overflow: "hidden",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SidebarNav({
  displayName,
  initials,
  role,
  clients = [],
  projects = [],
  currentStudio,
  allStudios,
  signOutAction,
  isAdmin = false,
  isSuperAdmin = false,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const navItems = allNavItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdmin;
    return true;
  });

  const isClientsSection = pathname === "/clients" || pathname.startsWith("/clients/");
  const isProjectsSection = pathname === "/projects" || pathname.startsWith("/projects/");

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="flex flex-col h-full py-5 flex-shrink-0 overflow-hidden"
      style={{
        width: expanded ? 240 : 56,
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: "#EDEDED",
        zIndex: 20,
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <Link
        href="/"
        className="flex items-center gap-3 mb-6 flex-shrink-0"
        style={{ paddingLeft: 12, textDecoration: "none", minWidth: 0 }}
        title={!expanded ? "Home" : undefined}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 32, height: 32, backgroundColor: "#1A1A1A", borderRadius: 8 }}
        >
          <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 600, color: "#FFDE28", lineHeight: 1 }}>
            i
          </span>
        </div>
        <span
          className="text-sm font-medium"
          style={{ ...fadeStyle(expanded), fontFamily: "var(--font-inter), sans-serif", color: "#1A1A1A" }}
        >
          Ida Designer
        </span>
      </Link>

      {/* ── Studio switcher ──────────────────────────────────── */}
      {currentStudio && (
        <div
          style={{
            ...fadeStyle(expanded),
            paddingLeft: 4,
            paddingRight: 8,
            marginBottom: expanded ? 0 : 0,
            // Collapse height when not expanded so it doesn't push nav down
            maxHeight: expanded ? 60 : 0,
            transition: "opacity 0.15s ease, max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: expanded ? "0.06s" : "0s",
          }}
        >
          <StudioSwitcher currentStudio={currentStudio} allStudios={allStudios} />
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <div key={item.label}>
              {/* Main nav item */}
              <Link
                href={item.href}
                title={!expanded ? item.label : undefined}
                className={`flex items-center gap-3 transition-colors ${isActive ? "bg-white" : "hover:bg-black/[0.04]"}`}
                style={{
                  height: 36,
                  paddingLeft: 10,
                  paddingRight: 10,
                  borderRadius: 9,
                  boxShadow: isActive ? "0 2px 8px rgba(26,26,26,0.08)" : "none",
                  color: isActive ? "#1A1A1A" : "#9A9590",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    ...fadeStyle(expanded),
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>
              </Link>

              {/* Client sub-list — only when expanded + on clients section */}
              {expanded && item.href === "/clients" && isClientsSection && clients.length > 0 && (
                <div className="ml-3 mt-0.5 mb-1 relative">
                  <div className="absolute left-3 top-0 bottom-0" style={{ width: 1, backgroundColor: "#D4D2CF" }} />
                  <div className="pl-6 space-y-0.5">
                    {clients.map((client) => {
                      const isClientActive = pathname === `/clients/${client.id}`;
                      return (
                        <Link
                          key={client.id}
                          href={`/clients/${client.id}`}
                          className={`block py-1.5 px-2 text-xs truncate transition-colors ${isClientActive ? "bg-white/70" : "hover:bg-black/[0.04]"}`}
                          style={{
                            borderRadius: 6,
                            color: isClientActive ? "#1A1A1A" : "#9A9590",
                            fontFamily: "var(--font-inter), sans-serif",
                            fontWeight: isClientActive ? 600 : 400,
                            textDecoration: "none",
                          }}
                        >
                          {client.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Project sub-list — only when expanded + on projects section */}
              {expanded && item.href === "/projects" && isProjectsSection && sortedProjects.length > 0 && (
                <div className="ml-3 mt-0.5 mb-1 relative">
                  <div className="absolute left-3 top-0 bottom-0" style={{ width: 1, backgroundColor: "#D4D2CF" }} />
                  <div
                    className="pl-6 space-y-0.5"
                    style={{ maxHeight: 240, overflowY: "auto" }}
                  >
                    {sortedProjects.map((project) => {
                      const isProjectActive = pathname === `/projects/${project.id}`;
                      return (
                        <div key={project.id} className="flex items-center gap-1 group">
                          <Link
                            href={`/projects/${project.id}`}
                            className={`flex-1 py-1.5 px-2 text-xs truncate transition-colors ${isProjectActive ? "bg-white/70" : "hover:bg-black/[0.04]"}`}
                            style={{
                              borderRadius: 6,
                              color: isProjectActive ? "#1A1A1A" : "#9A9590",
                              fontFamily: "var(--font-inter), sans-serif",
                              fontWeight: isProjectActive ? 600 : 400,
                              textDecoration: "none",
                              display: "block",
                            }}
                          >
                            {project.name}
                          </Link>
                          <form action={toggleProjectStar.bind(null, project.id, project.starred)}>
                            <button
                              type="submit"
                              title={project.starred ? "Unstar" : "Star"}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5"
                              style={{ background: "none", border: "none", cursor: "pointer", color: project.starred ? "#FFDE28" : "#C0BEBB" }}
                            >
                              <Star size={10} fill={project.starred ? "#FFDE28" : "none"} />
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-2 mt-auto">
        {/* Avatar + name + role */}
        <div
          className="flex items-center gap-3 overflow-hidden"
          style={{ paddingLeft: 10, minHeight: 36 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-semibold"
            style={{ width: 28, height: 28, backgroundColor: "#FFDE28", color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif" }}
          >
            {initials}
          </div>
          <div style={fadeStyle(expanded)}>
            <p
              className="text-xs font-semibold truncate"
              style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A1A", maxWidth: 160 }}
            >
              {displayName}
            </p>
            <p
              className="capitalize"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590" }}
            >
              {role}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <form action={signOutAction}>
          <button
            type="submit"
            title={!expanded ? "Sign out" : undefined}
            className="flex items-center gap-3 w-full transition-colors hover:text-[#1A1A1A] hover:bg-black/[0.04]"
            style={{
              height: 32, paddingLeft: 10,
              background: "none", border: "none", cursor: "pointer",
              color: "#C0BEBB", borderRadius: 8, overflow: "hidden",
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <span
              style={{
                ...fadeStyle(expanded),
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 12,
              }}
            >
              Sign out
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}
