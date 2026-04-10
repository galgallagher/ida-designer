"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { ProjectStatus } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewProjectContact {
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone: string;
}

export type CreateProjectResult =
  | { success: true; projectId: string }
  | { error: string };

// ── createProject ─────────────────────────────────────────────────────────────
// Creates a project, optionally creating a new client (+ contact) at the same time.

export async function createProject(formData: FormData): Promise<CreateProjectResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found for your account." };

  // ── Resolve client ID ──────────────────────────────────────────────────────
  const clientMode = formData.get("client_mode") as "existing" | "new";
  let clientId: string;

  if (clientMode === "existing") {
    clientId = (formData.get("client_id") as string | null)?.trim() ?? "";
    if (!clientId) return { error: "Please select a client." };
  } else {
    // Create a new client
    const clientName = (formData.get("new_client_name") as string | null)?.trim() ?? "";
    if (!clientName) return { error: "Client name is required." };
    const clientAddress = (formData.get("new_client_address") as string | null)?.trim() || null;

    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({ studio_id: studioId, name: clientName, address: clientAddress })
      .select("id")
      .single();

    if (clientError || !newClient) return { error: "Failed to create client. Please try again." };
    clientId = newClient.id;

    // Optionally create an inline contact
    const contactFirstName = (formData.get("contact_first_name") as string | null)?.trim();
    if (contactFirstName) {
      await supabase.from("contacts").insert({
        client_id: clientId,
        studio_id: studioId,
        first_name: contactFirstName,
        last_name: (formData.get("contact_last_name") as string | null)?.trim() || null,
        role: (formData.get("contact_role") as string | null)?.trim() || null,
        email: (formData.get("contact_email") as string | null)?.trim() || null,
        phone: (formData.get("contact_phone") as string | null)?.trim() || null,
        is_primary: true,
      });
    }
  }

  // ── Create the project ─────────────────────────────────────────────────────
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

  const { data: newProject, error: projectError } = await supabase
    .from("projects")
    .insert({ studio_id: studioId, client_id: clientId, name, code, site_address, description, status })
    .select("id")
    .single();

  if (projectError || !newProject) return { error: "Failed to create project. Please try again." };

  revalidatePath("/projects");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);

  return { success: true, projectId: newProject.id };
}

// ── toggleProjectStar ─────────────────────────────────────────────────────────

export async function toggleProjectStar(projectId: string, currentlyStarred: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (currentlyStarred) {
    await supabase.from("user_project_stars").delete().eq("user_id", user.id).eq("project_id", projectId);
  } else {
    await supabase.from("user_project_stars").insert({ user_id: user.id, project_id: projectId });
  }

  revalidatePath("/projects");
  revalidatePath("/");
}
