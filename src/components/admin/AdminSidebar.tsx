"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Layers, Package, ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/admin",                  icon: ShieldCheck, label: "Overview" },
  { href: "/admin/studios",          icon: Building2,   label: "Studios" },
  { href: "/admin/default-finishes", icon: Layers,      label: "Default Finishes" },
  { href: "/admin/global-specs",     icon: Package,     label: "Global Library", soon: true },
];

interface AdminSidebarProps {
  initials: string;
  displayName?: string;
  signOutAction: () => Promise<void>;
}

export default function AdminSidebar({ initials, displayName, signOutAction }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="flex flex-col py-4 flex-shrink-0 overflow-hidden"
        style={{
          width: expanded ? 220 : 56,
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "#1A1A1A",
          color: "#FFFFFF",
          height: "100%",
        }}
      >
        {/* Brand / mode indicator */}
        <div className="flex items-center gap-2.5 px-4 mb-5" style={{ height: 32 }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              backgroundColor: "#FFDE28", color: "#1A1A1A",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ShieldCheck size={14} />
          </div>
          {expanded && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 13, fontWeight: 700 }}>
                Platform Admin
              </p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590", marginTop: 1 }}>
                Ida
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "#333", marginBottom: 8, marginLeft: 12, marginRight: 12 }} />

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            const disabled = item.soon;

            const content = (
              <div
                className="flex items-center gap-2.5 px-3 py-2 transition-colors"
                style={{
                  borderRadius: 8,
                  backgroundColor: isActive ? "rgba(255,222,40,0.12)" : "transparent",
                  color: disabled ? "#555" : isActive ? "#FFDE28" : "#C0BEBB",
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {expanded && (
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                    {item.label}
                  </span>
                )}
                {expanded && item.soon && (
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#333", color: "#9A9590", borderRadius: 4, padding: "1px 5px", marginLeft: "auto" }}>
                    Soon
                  </span>
                )}
              </div>
            );

            if (disabled) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <div>{content}</div>
                  </TooltipTrigger>
                  {!expanded && <TooltipContent side="right">{item.label} (soon)</TooltipContent>}
                </Tooltip>
              );
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href} style={{ textDecoration: "none" }}>
                    {content}
                  </Link>
                </TooltipTrigger>
                {!expanded && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer: Exit admin + Sign out + identity */}
        <div className="flex flex-col gap-1 px-2" style={{ marginTop: 8 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/projects"
                style={{ textDecoration: "none" }}
              >
                <div
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors"
                  style={{
                    borderRadius: 8,
                    color: "#C0BEBB",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 13,
                  }}
                >
                  <ArrowLeft size={16} style={{ flexShrink: 0 }} />
                  {expanded && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                      Exit admin
                    </span>
                  )}
                </div>
              </Link>
            </TooltipTrigger>
            {!expanded && <TooltipContent side="right">Exit admin</TooltipContent>}
          </Tooltip>

          <form action={signOutAction}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors"
                  style={{
                    borderRadius: 8,
                    color: "#C0BEBB",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 13,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={16} style={{ flexShrink: 0 }} />
                  {expanded && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>Sign out</span>
                  )}
                </button>
              </TooltipTrigger>
              {!expanded && <TooltipContent side="right">Sign out</TooltipContent>}
            </Tooltip>
          </form>
        </div>

        {/* Identity */}
        <div
          className="flex items-center gap-2.5 px-3 py-3 mx-2 mt-2"
          style={{ borderTop: "1px solid #333" }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: 7, flexShrink: 0,
              backgroundColor: "#333", color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600,
            }}
          >
            {initials}
          </div>
          {expanded && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600 }}>
                {displayName ?? "Super admin"}
              </p>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, color: "#9A9590", marginTop: 1 }}>
                Super admin
              </p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
