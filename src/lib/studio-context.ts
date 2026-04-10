/**
 * studio-context.ts
 *
 * Utility for resolving which studio the current user is working in.
 *
 * Priority:
 *   1. `current_studio_id` cookie (set when user logs in or switches studio)
 *   2. Fall back to their first studio membership (by created_at) — and then
 *      writes the cookie so subsequent calls (including server actions) are instant.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentStudioId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch all the studios this user actually belongs to (source of truth)
  const { data: memberships } = await supabase
    .from("studio_members")
    .select("studio_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!memberships || memberships.length === 0) return null;

  const validIds = new Set(memberships.map((m) => m.studio_id));

  // Check if the cookie points to a studio the user still belongs to
  const cookieStore = await cookies();
  const stored = cookieStore.get("current_studio_id")?.value;

  if (stored && validIds.has(stored)) {
    return stored; // Cookie is valid — use it
  }

  // Cookie is missing or stale — return first membership
  // (We can't set cookies from a Server Component; the cookie gets written
  //  on first action call via switchStudio or after sign-in)
  return memberships[0].studio_id;
}
