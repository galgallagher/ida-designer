"use server";

/**
 * adminGuard — shared auth + authorisation check for settings actions.
 *
 * Returns the typed supabase client, studioId, and user when the caller is
 * a studio owner/admin (or super_admin).  Returns an error string otherwise.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type GuardSuccess = {
  error: null;
  supabase: SupabaseClient<Database>;
  studioId: string;
  user: { id: string; email?: string };
};

type GuardFailure = {
  error: string;
  supabase: null;
  studioId: null;
  user: null;
};

export type AdminGuardResult = GuardSuccess | GuardFailure;

export async function adminGuard(): Promise<AdminGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated.", supabase: null, studioId: null, user: null };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found.", supabase: null, studioId: null, user: null };

  const [{ data: member }, { data: profile }] = await Promise.all([
    supabase
      .from("studio_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("studio_id", studioId)
      .single(),
    supabase.from("profiles").select("platform_role").eq("id", user.id).single(),
  ]);

  const isAdmin =
    profile?.platform_role === "super_admin" ||
    member?.role === "owner" ||
    member?.role === "admin";

  if (!isAdmin) return { error: "Not authorised.", supabase: null, studioId: null, user: null };

  return { error: null, supabase, studioId, user };
}
