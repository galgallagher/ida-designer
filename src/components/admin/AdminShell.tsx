import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import AdminSidebar from "./AdminSidebar";

/**
 * AdminShell — wraps every /admin/* page.
 *
 * Distinct from AppShell: no studio context, no project sidebar, no studio
 * switcher. Just the platform-admin nav and a slot for content.
 *
 * Auth + super_admin gate handled in /admin/layout.tsx; this only adds chrome.
 */
export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const displayName = firstName ? `${firstName} ${lastName}`.trim() : (user.email?.split("@")[0] ?? "Admin");
  const initials = firstName
    ? `${firstName[0]}${lastName[0] ?? ""}`.toUpperCase()
    : (user.email?.[0] ?? "A").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#EDEDED" }}>
      <AdminSidebar
        initials={initials}
        displayName={displayName}
        signOutAction={signOut}
      />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#EDEDED" }}>
        {children}
      </main>
    </div>
  );
}
