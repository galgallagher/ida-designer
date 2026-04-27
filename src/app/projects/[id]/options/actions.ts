"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

// ── Shared guard ──────────────────────────────────────────────────────────────

async function getProjectGuard(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, studioId: null };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", supabase: null, studioId: null };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) return { error: "Project not found.", supabase: null, studioId: null };

  return { error: null, supabase, studioId };
}

// ── Add spec to project options ───────────────────────────────────────────────

export async function addSpecToProject(
  projectId: string,
  payload: { spec_id: string }
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", payload.spec_id)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return { error: "Spec not found in your library." };

  // Check for existing entry before inserting to prevent duplicates.
  const { data: existing } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", projectId)
    .eq("spec_id", payload.spec_id)
    .maybeSingle();

  if (existing) return { error: null }; // already in project — not an error

  const { error: dbError } = await supabase.from("project_options").insert({
    project_id: projectId,
    studio_id: studioId,
    spec_id: payload.spec_id,
    notes: null,
    status: "draft",
  });

  if (dbError) {
    if (dbError.code === "23505") return { error: null }; // race condition — already there
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}/options`);
  return { error: null };
}

// ── Remove spec from project ──────────────────────────────────────────────────

export async function removeSpecFromProject(
  projectSpecId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const { error, supabase, studioId } = await getProjectGuard(projectId);
  if (error || !supabase || !studioId) return { error: error ?? "Not authorised." };

  // Fetch the spec_id before deleting so we can remove shapes from canvases.
  const { data: option } = await supabase
    .from("project_options")
    .select("spec_id")
    .eq("id", projectSpecId)
    .eq("studio_id", studioId)
    .single();

  const { error: dbError } = await supabase
    .from("project_options")
    .delete()
    .eq("id", projectSpecId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  // Remove all spec-card shapes with this specId from every canvas in the project.
  if (option?.spec_id) {
    const specId = option.spec_id;
    const { data: canvases } = await supabase
      .from("project_canvases")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("studio_id", studioId);

    if (canvases) {
      for (const canvas of canvases) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = canvas.content as any;
        const store = content?.document?.store;
        if (!store || typeof store !== "object") continue;

        const before = Object.keys(store).length;
        const updated = Object.fromEntries(
          Object.entries(store).filter(([, record]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = record as any;
            return !(r.typeName === "shape" && r.type === "spec-card" && r.props?.specId === specId);
          }),
        );
        if (Object.keys(updated).length === before) continue; // nothing changed

        content.document.store = updated;
        await supabase
          .from("project_canvases")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", canvas.id)
          .eq("studio_id", studioId);
      }
    }
  }

  revalidatePath(`/projects/${projectId}/options`);
  return { error: null };
}
