"use server";

/**
 * Server actions for project canvases.
 * Handles CRUD operations, auto-save, and image uploads.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { Json } from "@/types/database";

// ── Save canvas content (debounced auto-save from client) ─────────────────────

export async function saveCanvasContent(canvasId: string, content: Json) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  const { error } = await supabase
    .from("project_canvases")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", canvasId)
    .eq("studio_id", studioId);

  if (error) {
    console.error("[saveCanvasContent]", error);
    return { error: "Failed to save canvas." };
  }

  return { error: null };
}

// ── Load canvas content ───────────────────────────────────────────────────────

export async function loadCanvasContent(canvasId: string) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", content: null };

  const { data, error } = await supabase
    .from("project_canvases")
    .select("content")
    .eq("id", canvasId)
    .eq("studio_id", studioId)
    .single();

  if (error) {
    console.error("[loadCanvasContent]", error);
    return { error: "Failed to load canvas.", content: null };
  }

  return { error: null, content: data.content };
}

// ── Create a new canvas ───────────────────────────────────────────────────────

export async function createCanvas(projectId: string, name: string) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", canvas: null };

  // Get next order_index
  const { data: existing } = await supabase
    .from("project_canvases")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

  const { data: canvas, error } = await supabase
    .from("project_canvases")
    .insert({
      studio_id: studioId,
      project_id: projectId,
      name,
      content: {},
      order_index: nextOrder,
    })
    .select("id, name, order_index, created_at, updated_at")
    .single();

  if (error) {
    console.error("[createCanvas]", error);
    return { error: "Failed to create canvas.", canvas: null };
  }

  revalidatePath(`/projects/${projectId}/canvas`);
  return { error: null, canvas };
}

// ── Rename a canvas ───────────────────────────────────────────────────────────

export async function renameCanvas(canvasId: string, projectId: string, name: string) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Canvas name cannot be empty." };

  const { error } = await supabase
    .from("project_canvases")
    .update({ name: trimmed })
    .eq("id", canvasId)
    .eq("studio_id", studioId);

  if (error) {
    console.error("[renameCanvas]", error);
    return { error: "Failed to rename canvas." };
  }

  revalidatePath(`/projects/${projectId}/canvas`);
  return { error: null };
}

// ── Delete a canvas ───────────────────────────────────────────────────────────

export async function deleteCanvas(canvasId: string, projectId: string) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  // Don't allow deleting the last canvas
  const { data: allCanvases } = await supabase
    .from("project_canvases")
    .select("id")
    .eq("project_id", projectId);

  if (!allCanvases || allCanvases.length <= 1) {
    return { error: "Cannot delete the last canvas." };
  }

  // Clean up all storage images uploaded to this canvas
  const { data: images } = await supabase
    .from("project_images")
    .select("storage_path")
    .eq("canvas_id", canvasId);

  if (images && images.length > 0) {
    const paths = images.map((img) => img.storage_path);
    await supabase.storage.from("canvas-images").remove(paths);
  }

  const { error } = await supabase
    .from("project_canvases")
    .delete()
    .eq("id", canvasId)
    .eq("studio_id", studioId);

  if (error) {
    console.error("[deleteCanvas]", error);
    return { error: "Failed to delete canvas." };
  }

  revalidatePath(`/projects/${projectId}/canvas`);
  return { error: null };
}

// ── List library specs for the picker ────────────────────────────────────────
// Returns all specs in the studio's library, joined with category name, for
// the "Add from Library" canvas picker. Client does the search filtering.

export interface LibrarySpecLite {
  id: string;
  name: string;
  code: string | null;
  image_url: string | null;
  category_name: string | null;
}

export async function getLibrarySpecs(): Promise<{
  error: string | null;
  specs: LibrarySpecLite[];
}> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", specs: [] };

  const { data, error } = await supabase
    .from("specs")
    .select("id, name, code, image_url, category:spec_categories(name)")
    .eq("studio_id", studioId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getLibrarySpecs]", error);
    return { error: error.message, specs: [] };
  }

  // Supabase returns joined rows as either object or array depending on
  // cardinality — normalise to a single category name string.
  const specs: LibrarySpecLite[] = (data ?? []).map((s) => {
    const cat = s.category;
    const categoryName = Array.isArray(cat)
      ? cat[0]?.name ?? null
      : (cat as { name?: string } | null)?.name ?? null;
    return {
      id: s.id,
      name: s.name,
      code: s.code ?? null,
      image_url: s.image_url ?? null,
      category_name: categoryName,
    };
  });

  return { error: null, specs };
}

// ── Upload an image to canvas storage ─────────────────────────────────────────

export async function uploadCanvasImage(
  canvasId: string,
  projectId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context.", url: null, imageId: null };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided.", url: null, imageId: null };
  if (!file.type.startsWith("image/")) return { error: "File must be an image.", url: null, imageId: null };
  if (file.size > 50 * 1024 * 1024) return { error: "Image must be under 50 MB.", url: null, imageId: null };

  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/heic": "heic",
  };
  const ext = MIME_TO_EXT[file.type] ?? file.name.split(".").pop() ?? "jpg";
  const assetId = crypto.randomUUID();
  const path = `${studioId}/${canvasId}/${assetId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("canvas-images")
    .upload(path, file, { upsert: false });

  if (uploadError) {
    console.error("[uploadCanvasImage]", uploadError);
    return { error: "Image upload failed.", url: null, imageId: null };
  }

  const { data: urlData } = supabase.storage
    .from("canvas-images")
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Record in project_images (default type: inspiration — user can retag)
  const { data: imgRecord } = await supabase
    .from("project_images")
    .insert({
      project_id: projectId,
      studio_id: studioId,
      canvas_id: canvasId,
      storage_path: path,
      url: publicUrl,
      type: "inspiration",
    })
    .select("id")
    .single();

  return { error: null, url: publicUrl, imageId: imgRecord?.id ?? null };
}

// ── Tag a project image (inspiration / sketch) ────────────────────────────────

export async function tagProjectImage(
  imageId: string,
  type: "inspiration" | "sketch",
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  const { error } = await supabase
    .from("project_images")
    .update({ type })
    .eq("id", imageId)
    .eq("studio_id", studioId);

  if (error) return { error: error.message };
  return { error: null };
}

// ── Delete a project image ────────────────────────────────────────────────────
// Removes from project_images, Supabase Storage, and patches the canvas
// snapshot to remove the matching canvas-image shape.

export async function deleteProjectImage(
  imageId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  // Fetch the record to get storage_path and canvas_id before deleting.
  const { data: image } = await supabase
    .from("project_images")
    .select("storage_path, canvas_id")
    .eq("id", imageId)
    .eq("studio_id", studioId)
    .single();

  if (!image) return { error: "Image not found." };

  // Delete the DB record.
  const { error: dbError } = await supabase
    .from("project_images")
    .delete()
    .eq("id", imageId)
    .eq("studio_id", studioId);

  if (dbError) return { error: dbError.message };

  // Delete from Storage (best-effort — don't fail if file is already gone).
  if (image.storage_path) {
    await supabase.storage.from("canvas-images").remove([image.storage_path]);
  }

  // Remove the canvas-image shape from the canvas snapshot.
  if (image.canvas_id) {
    const { data: canvas } = await supabase
      .from("project_canvases")
      .select("content")
      .eq("id", image.canvas_id)
      .eq("studio_id", studioId)
      .single();

    if (canvas?.content) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = canvas.content as any;
      const store = content?.document?.store;
      if (store && typeof store === "object") {
        // Remove all canvas-image shapes whose imageId matches.
        const updated = Object.fromEntries(
          Object.entries(store).filter(([, record]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = record as any;
            return !(r.typeName === "shape" && r.type === "canvas-image" && r.props?.imageId === imageId);
          }),
        );
        content.document.store = updated;

        await supabase
          .from("project_canvases")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", image.canvas_id)
          .eq("studio_id", studioId);
      }
    }
  }

  return { error: null };
}
