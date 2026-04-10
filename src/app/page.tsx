/**
 * Dashboard Home Page — Server Component
 *
 * The main authenticated landing page. Uses AppShell for the sidebar + layout.
 * Shows real stats fetched from Supabase: client count, active projects, etc.
 *
 * The middleware (src/middleware.ts) ensures only logged-in users reach here.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import type { ProfileRow } from "@/types/database";

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile for the greeting
  let profile: ProfileRow | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // ── Resolve current studio ───────────────────────────────────────────────
  const studioId = await getCurrentStudioId();

  let studioName: string | null = null;
  if (studioId) {
    const { data: studioData } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();
    studioName = studioData?.name ?? null;
  }

  // ── Real stats from Supabase — scoped to current studio ─────────────────
  const [
    { count: clientCount },
    { count: activeProjectCount },
    { count: totalProjectCount },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("studio_id", studioId ?? ""),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("studio_id", studioId ?? "")
      .eq("status", "active"),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("studio_id", studioId ?? ""),
  ]);

  const firstName = profile?.first_name ?? user?.email?.split("@")[0] ?? "Studio";

  const stats = [
    {
      label: "Total Clients",
      value: clientCount ?? 0,
      href: "/clients",
      linkLabel: "View all clients",
    },
    {
      label: "Active Projects",
      value: activeProjectCount ?? 0,
      href: "/projects",
      linkLabel: "View active projects",
    },
    {
      label: "Total Projects",
      value: totalProjectCount ?? 0,
      href: "/projects",
      linkLabel: "View all projects",
    },
  ];

  return (
    <AppShell>
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: 32,
              fontWeight: 700,
              color: "#1A1A1A",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            Good morning,{" "}
            <span style={{ fontWeight: 300, color: "#C0BEBB" }}>{firstName}</span>
          </h1>
          <p
            className="mt-1"
            style={{
              fontSize: 14,
              color: "#9A9590",
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            Here&apos;s what&apos;s happening in your studio today.
          </p>
        </div>

        {studioName && (
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 10,
              boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#9A9590",
                fontFamily: "var(--font-inter), sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Studio
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1A1A1A",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              {studioName}
            </span>
          </div>
        )}
      </div>

      {/* ── Stats grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-5 flex flex-col justify-between"
            style={{
              borderRadius: 14,
              boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
              minHeight: 120,
            }}
          >
            <p
              className="text-xs uppercase tracking-wider mb-3"
              style={{
                color: "#9A9590",
                fontFamily: "var(--font-inter), sans-serif",
                letterSpacing: "0.06em",
              }}
            >
              {stat.label}
            </p>
            <div className="flex items-end justify-between">
              <p
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </p>
              <Link
                href={stat.href}
                className="text-xs font-medium transition-opacity hover:opacity-60"
                style={{
                  color: "#9A9590",
                  fontFamily: "var(--font-inter), sans-serif",
                  textDecoration: "none",
                }}
              >
                {stat.linkLabel} →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick links ───────────────────────────────────────── */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: 14,
          boxShadow: "0 2px 12px rgba(26,26,26,0.08)",
        }}
      >
        <h2
          className="mb-4"
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 18,
            fontWeight: 600,
            color: "#1A1A1A",
          }}
        >
          Quick actions
        </h2>
        <div className="flex gap-3 flex-wrap">
          <QuickLink href="/clients" label="View Clients" />
          <QuickLink href="/projects" label="View Projects" />
        </div>
      </div>
    </AppShell>
  );
}

// ── QuickLink ─────────────────────────────────────────────────────────────────

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: "#F0EEEB",
        borderRadius: 10,
        color: "#1A1A1A",
        fontFamily: "var(--font-inter), sans-serif",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}
