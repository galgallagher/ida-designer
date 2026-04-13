/**
 * Settings hub — /settings
 *
 * Admin-only section for studio configuration.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import { Layers, Users, ChevronRight, BookUser, Briefcase, Palette, LayoutList } from "lucide-react";

const sections = [
  {
    href: "/settings/categories",
    icon: Layers,
    title: "Spec Categories",
    description: "Add, rename, reorder and deactivate the categories in your spec library.",
  },
  {
    href: "/settings/schedules",
    icon: LayoutList,
    title: "Schedule Types",
    description: "Control which schedule types appear in projects, rename them, and set their order.",
  },
  {
    href: "/settings/finishes",
    icon: Palette,
    title: "Finish Palette",
    description: "Define the finish codes used across drawings and specifications (e.g. WD-01, FB-03).",
  },
  {
    href: "/settings/contacts",
    icon: BookUser,
    title: "Contact Categories",
    description: "Configure the categories used to classify companies and contacts.",
  },
  {
    href: "/settings/roles",
    icon: Briefcase,
    title: "Studio Roles",
    description: "Define job title labels used in your studio (e.g. Senior Designer, Junior).",
  },
  {
    href: "/settings/members",
    icon: Users,
    title: "Team Members",
    description: "View team members, assign job titles, and manage access levels.",
  },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 32 }}>
          Studio configuration and preferences.
        </p>

        <div className="flex flex-col gap-3">
          {sections.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-5 py-4 bg-white transition-shadow hover:shadow-md"
              style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", textDecoration: "none" }}
            >
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: "#F0EEEB", borderRadius: 10 }}>
                <Icon size={18} style={{ color: "#9A9590" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{title}</p>
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 2 }}>{description}</p>
              </div>
              <ChevronRight size={16} style={{ color: "#C0BEBB", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
