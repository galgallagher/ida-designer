"use client";

/**
 * IconRail — collapsed 56px icon-only main nav.
 * Expands to 200px on hover, showing labels and pushing ProjectNav right.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Briefcase, Package, LogOut, Settings } from "lucide-react";

const navItems = [
  { href: "/clients",  icon: Users,     label: "Clients",      adminOnly: true  },
  { href: "/projects", icon: Briefcase, label: "Projects",     adminOnly: false },
  { href: "/specs",    icon: Package,   label: "Spec Library", adminOnly: false },
  { href: "/settings", icon: Settings,  label: "Settings",     adminOnly: true  },
];

interface IconRailProps {
  initials: string;
  displayName?: string;
  isAdmin?: boolean;
  signOutAction: () => Promise<void>;
}

export default function IconRail({ initials, displayName, isAdmin = false, signOutAction }: IconRailProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const visible = navItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="flex flex-col py-4 flex-shrink-0 overflow-hidden"
      style={{
        width: expanded ? 200 : 56,
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: "#EDEDED",
        height: "100%",
        zIndex: 10,
      }}
    >
      {/* Logo mark */}
      <Link
        href="/"
        className="flex items-center gap-3 mb-6 flex-shrink-0"
        style={{ paddingLeft: 12, textDecoration: "none", minWidth: 0 }}
        title="Home"
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
          className="font-medium text-sm whitespace-nowrap overflow-hidden"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            color: "#1A1A1A",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.15s ease",
            transitionDelay: expanded ? "0.08s" : "0s",
          }}
        >
          Ida Designer
        </span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 flex-1 px-2">
        {visible.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
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
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 0.15s ease",
                  transitionDelay: expanded ? "0.08s" : "0s",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="flex flex-col gap-1 px-2">
        <div
          className="flex items-center gap-3 overflow-hidden"
          style={{ height: 36, paddingLeft: 10 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-semibold"
            style={{ width: 28, height: 28, backgroundColor: "#FFDE28", color: "#1A1A1A", fontFamily: "var(--font-inter), sans-serif" }}
          >
            {initials}
          </div>
          <span
            className="text-xs font-medium whitespace-nowrap overflow-hidden"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              color: "#1A1A1A",
              opacity: expanded ? 1 : 0,
              transition: "opacity 0.15s ease",
              transitionDelay: expanded ? "0.08s" : "0s",
            }}
          >
            {displayName ?? initials}
          </span>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full transition-colors hover:text-[#1A1A1A]"
            style={{ height: 32, paddingLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#C0BEBB", borderRadius: 8, overflow: "hidden" }}
            title={!expanded ? "Sign out" : undefined}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <span
              className="text-xs whitespace-nowrap"
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                opacity: expanded ? 1 : 0,
                transition: "opacity 0.15s ease",
                transitionDelay: expanded ? "0.08s" : "0s",
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
