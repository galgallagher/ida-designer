import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";

/**
 * Admin section — super-admin only.
 * Wraps every /admin/* route with a role guard + dedicated AdminShell.
 * No studio context applies here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profile?.platform_role !== "super_admin") redirect("/projects");

  return <AdminShell>{children}</AdminShell>;
}
