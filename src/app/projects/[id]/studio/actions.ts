"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { notFound } from "next/navigation";
import type { Json, StudioModelFormat, StudioModelRow } from "@/types/database";

// ── Upload ────────────────────────────────────────────────────────────────────

export async function getUploadUrl(
  projectId: string,
  fileName: string,
  modelId: string,
): Promise<{ uploadUrl: string; filePath: string }> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const filePath = `${studioId}/${modelId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("studio-models")
    .createSignedUploadUrl(filePath);

  if (error || !data) throw new Error(error?.message ?? "Failed to create upload URL");

  return { uploadUrl: data.signedUrl, filePath };
}

// ── Model record ──────────────────────────────────────────────────────────────

export async function createStudioModel(
  projectId: string,
  modelId: string,
  name: string,
  filePath: string,
  format: StudioModelFormat,
): Promise<StudioModelRow> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data, error } = await supabase
    .from("studio_models")
    .insert({
      id: modelId,
      studio_id: studioId,
      project_id: projectId,
      name,
      file_path: filePath,
      format,
      material_assignments: {},
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create model record");
  return data as StudioModelRow;
}

export async function saveMaterialAssignments(
  modelId: string,
  assignments: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { error } = await supabase
    .from("studio_models")
    .update({ material_assignments: assignments as unknown as Json })
    .eq("id", modelId)
    .eq("studio_id", studioId);

  if (error) throw new Error(error.message);
}

export async function saveMeshLabels(
  modelId: string,
  labels: Record<string, string>,
): Promise<void> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { error } = await supabase
    .from("studio_models")
    .update({ mesh_labels: labels as unknown as Json })
    .eq("id", modelId)
    .eq("studio_id", studioId);

  if (error) throw new Error(error.message);
}

export async function renameStudioModel(modelId: string, name: string): Promise<void> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  const { error } = await supabase
    .from("studio_models")
    .update({ name: trimmed })
    .eq("id", modelId)
    .eq("studio_id", studioId);

  if (error) throw new Error(error.message);
}

export async function deleteStudioModel(modelId: string): Promise<void> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: model } = await supabase
    .from("studio_models")
    .select("file_path")
    .eq("id", modelId)
    .eq("studio_id", studioId)
    .single();

  if (model) {
    await supabase.storage.from("studio-models").remove([model.file_path]);
  }

  await supabase
    .from("studio_models")
    .delete()
    .eq("id", modelId)
    .eq("studio_id", studioId);
}

// ── Signed download URL ───────────────────────────────────────────────────────

export async function getModelDownloadUrl(modelId: string): Promise<string> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: model } = await supabase
    .from("studio_models")
    .select("file_path")
    .eq("id", modelId)
    .eq("studio_id", studioId)
    .single();

  if (!model) notFound();

  const { data, error } = await supabase.storage
    .from("studio-models")
    .createSignedUrl(model.file_path, 3600);

  if (error || !data) throw new Error(error?.message ?? "Failed to create signed URL");
  return data.signedUrl;
}

// ── Specs for material picker ─────────────────────────────────────────────────

export type SpecLite = {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
};

export async function getProjectSpecsForPicker(projectId: string): Promise<SpecLite[]> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return [];

  const { data } = await supabase
    .from("project_options")
    .select("specs(id, name, image_url, spec_categories(name))")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .not("spec_id", "is", null);

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).flatMap((row) => {
    const spec = row.specs;
    if (!spec) return [];
    return [{
      id: spec.id,
      name: spec.name,
      image_url: spec.image_url ?? null,
      category: spec.spec_categories?.name ?? null,
    }];
  });
}
