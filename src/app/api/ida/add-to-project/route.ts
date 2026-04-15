/**
 * POST /api/ida/add-to-project
 *
 * Adds an existing library spec to a project's default schedule.
 * Called from IdaWidget after a spec is saved, when the user is inside a project.
 *
 * Body: { spec_id: string, project_id: string }
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const studioId = await getCurrentStudioId();
  if (!studioId) return Response.json({ error: "No studio context" }, { status: 400 });

  const body = await req.json() as { spec_id?: string; project_id?: string };
  const { spec_id, project_id } = body;

  if (!spec_id || !project_id) {
    return Response.json({ error: "spec_id and project_id are required" }, { status: 400 });
  }

  // Verify the project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .eq("studio_id", studioId)
    .single();

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  // Verify the spec belongs to this studio
  const { data: spec } = await supabase
    .from("specs")
    .select("id")
    .eq("id", spec_id)
    .eq("studio_id", studioId)
    .single();

  if (!spec) return Response.json({ error: "Spec not found in your library" }, { status: 404 });

  // Resolve or create the default project option
  let optionId: string | null = null;

  const { data: existingOption } = await supabase
    .from("project_options")
    .select("id")
    .eq("project_id", project_id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();

  if (existingOption) {
    optionId = existingOption.id;
  } else {
    const { data: newOption } = await supabase
      .from("project_options")
      .insert({
        studio_id: studioId,
        project_id,
        name: "Option A",
        label: "A",
        sort_order: 0,
        is_default: true,
      })
      .select("id")
      .single();
    optionId = newOption?.id ?? null;
  }

  if (!optionId) return Response.json({ error: "Could not resolve project option" }, { status: 500 });

  const { error: insertError } = await supabase.from("project_specs").insert({
    project_id,
    project_option_id: optionId,
    studio_id: studioId,
    spec_id,
    item_type: null,   // no schedule type assigned yet — user can categorise later
    status: "draft",
    drawing_id: null,
    notes: null,
  });

  if (insertError) {
    // Unique constraint = already in project — treat as success
    if (insertError.code === "23505") {
      return Response.json({ ok: true, already_in_project: true });
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
