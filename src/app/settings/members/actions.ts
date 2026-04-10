"use server";

/**
 * Server actions for /settings/members — studio team management.
 * All mutations are admin/owner-only via adminGuard().
 */

import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-guard";
import type { StudioMemberRole } from "@/types/database";

// ── Add member to roster (no auth account needed yet) ─────────────────────────

export async function addMember(
  firstName: string,
  lastName: string,
  email: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("studio_members")
    .insert({
      studio_id: studioId,
      user_id: null,
      role: "designer",
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
    });

  if (dbError) {
    if (dbError.code === "23505") return { error: "Someone with that email is already in the studio." };
    return { error: dbError.message };
  }

  revalidatePath("/settings/members");
  return { error: null };
}

// ── Update access role ────────────────────────────────────────────────────────

export async function updateMemberAccessRole(
  memberId: string,
  newRole: StudioMemberRole
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Prevent removing the last owner
  if (newRole !== "owner") {
    const { count } = await supabase
      .from("studio_members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("role", "owner");

    const { data: target } = await supabase
      .from("studio_members")
      .select("role")
      .eq("id", memberId)
      .single();

    if (target?.role === "owner" && (count ?? 0) <= 1) {
      return { error: "Cannot demote the only owner. Promote another member first." };
    }
  }

  const { error: dbError } = await supabase
    .from("studio_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/members");
  return { error: null };
}

// ── Update job title (studio_role) ────────────────────────────────────────────

export async function updateMemberJobTitle(
  memberId: string,
  studioRoleId: string | null
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await adminGuard();
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { error: dbError } = await supabase
    .from("studio_members")
    .update({ studio_role_id: studioRoleId })
    .eq("id", memberId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/members");
  return { error: null };
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<{ error: string | null }> {
  const { error, supabase, studioId, user } = await adminGuard();
  if (error || !supabase || !studioId || !user) return { error: error ?? "Not authorised." };

  const { data: target } = await supabase
    .from("studio_members")
    .select("user_id, role")
    .eq("id", memberId)
    .single();

  // Prevent self-removal
  if (target?.user_id === user.id) {
    return { error: "You cannot remove yourself from the studio." };
  }

  // Prevent removing the last owner
  if (target?.role === "owner") {
    const { count } = await supabase
      .from("studio_members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return { error: "Cannot remove the only owner." };
    }
  }

  const { error: dbError } = await supabase
    .from("studio_members")
    .delete()
    .eq("id", memberId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/settings/members");
  return { error: null };
}
