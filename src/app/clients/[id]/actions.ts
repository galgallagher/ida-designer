"use server";

/**
 * Server Actions for the Client Detail page.
 *
 * addProject — inserts a new project row for the given client.
 * addContact  — inserts a new contact (person) linked to the given client.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { ProjectStatus } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddProjectResult =
  | { success: true; projectId: string }
  | { error: string };

// ── addProject ────────────────────────────────────────────────────────────────

export async function addProject(
  clientId: string,
  formData: FormData
): Promise<AddProjectResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in to add a project." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found for your account. Please contact support." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Project name is required." };

  const code = (formData.get("code") as string | null)?.trim() || null;
  const site_address = (formData.get("site_address") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;

  const rawStatus = (formData.get("status") as string | null)?.trim() ?? "active";
  const validStatuses: ProjectStatus[] = ["active", "on_hold", "completed", "archived"];
  const status: ProjectStatus = validStatuses.includes(rawStatus as ProjectStatus)
    ? (rawStatus as ProjectStatus)
    : "active";

  const { data: newProject, error: insertError } = await supabase
    .from("projects")
    .insert({ studio_id: studioId, client_id: clientId, name, code, site_address, description, status })
    .select("id")
    .single();

  if (insertError || !newProject) {
    console.error("[addProject] insert error:", insertError);
    return { error: "Failed to save project. Please try again." };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true, projectId: newProject.id };
}

// ── updateClient ──────────────────────────────────────────────────────────────

export type UpdateClientResult =
  | { success: true }
  | { error: string };

export async function updateClient(
  clientId: string,
  formData: FormData
): Promise<UpdateClientResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Company name is required." };

  const address = (formData.get("address") as string | null)?.trim() || null;

  const { error: updateError } = await supabase
    .from("clients")
    .update({ name, address, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  if (updateError) {
    console.error("[updateClient] error:", updateError);
    return { error: "Failed to update client. Please try again." };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { success: true };
}

// ── addContact ────────────────────────────────────────────────────────────────

export type AddContactResult =
  | { success: true; contactId: string }
  | { error: string };

export async function addContact(
  clientId: string,
  formData: FormData
): Promise<AddContactResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found for your account." };

  const first_name = (formData.get("first_name") as string | null)?.trim() ?? "";
  if (!first_name) return { error: "First name is required." };

  const last_name = (formData.get("last_name") as string | null)?.trim() || null;
  const role = (formData.get("role") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { data: newContact, error: insertError } = await supabase
    .from("contacts")
    .insert({ client_id: clientId, studio_id: studioId, first_name, last_name, role, email, phone, notes, is_primary: false })
    .select("id")
    .single();

  if (insertError || !newContact) {
    console.error("[addContact] insert error:", insertError);
    return { error: "Failed to save contact. Please try again." };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true, contactId: newContact.id };
}

// ── updateContact ─────────────────────────────────────────────────────────────

export type UpdateContactResult =
  | { success: true }
  | { error: string };

export async function updateContact(
  contactId: string,
  clientId: string,
  formData: FormData
): Promise<UpdateContactResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in." };

  const first_name = (formData.get("first_name") as string | null)?.trim() ?? "";
  if (!first_name) return { error: "First name is required." };

  const last_name = (formData.get("last_name") as string | null)?.trim() || null;
  const role = (formData.get("role") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ first_name, last_name, role, email, phone, notes, updated_at: new Date().toISOString() })
    .eq("id", contactId);

  if (updateError) {
    console.error("[updateContact] error:", updateError);
    return { error: "Failed to update contact. Please try again." };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── deleteContact ─────────────────────────────────────────────────────────────

export type DeleteContactResult =
  | { success: true }
  | { error: string };

export async function deleteContact(
  contactId: string,
  clientId: string
): Promise<DeleteContactResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in." };

  const { error: deleteError } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (deleteError) {
    console.error("[deleteContact] error:", deleteError);
    return { error: "Failed to delete contact. Please try again." };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
