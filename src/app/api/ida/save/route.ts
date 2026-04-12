/**
 * POST /api/ida/save
 *
 * Direct spec save endpoint — called when the user clicks "Add to library"
 * in Ida's chat UI. Bypasses Claude entirely; just writes to the DB.
 *
 * Saves: spec row, tags, template field values, and supplier link.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { extractVisualTags } from "@/lib/ida/extract-visual-tags";
import { resolveTemplateId } from "@/lib/ida/resolve-template";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    description: string | null;
    category_id: string | null;
    image_url: string | null;
    cost_from: number | null;
    cost_to: number | null;
    cost_unit: string | null;
    tags: string[];
    source_url: string | null;
    field_values: { field_id: string; value: string }[] | null;
    supplier_id: string | null;
  };

  const studioId = await getCurrentStudioId();
  if (!studioId) return NextResponse.json({ error: "No studio context" }, { status: 400 });

  // ── Resolve template ───────────────────────────────────────────────────────
  const templateId = await resolveTemplateId(supabase, studioId, body.category_id ?? null);
  if (!templateId) return NextResponse.json({ error: "No template" }, { status: 500 });

  // ── Insert spec ────────────────────────────────────────────────────────────
  const { data: spec, error } = await supabase
    .from("specs")
    .insert({
      studio_id: studioId,
      template_id: templateId,
      category_id: body.category_id ?? null,
      name: body.name,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      source_url: body.source_url ?? null,
      cost_from: body.cost_from ?? null,
      cost_to: body.cost_to ?? null,
      cost_unit: body.cost_unit ?? null,
    })
    .select("id, name")
    .single();

  if (error || !spec) return NextResponse.json({ error: error?.message }, { status: 500 });

  // ── Tags (including visual tags from image analysis) ──────────────────────
  const visualTags = body.image_url ? await extractVisualTags(body.image_url) : [];
  const tags = [...(body.tags ?? []), ...visualTags];
  if (body.source_url) tags.push(`source:${body.source_url}`);
  if (tags.length > 0) {
    await supabase.from("spec_tags").insert(tags.map((tag) => ({ spec_id: spec.id, tag })));
  }

  // ── Template field values ──────────────────────────────────────────────────
  const fieldValues = body.field_values ?? [];
  if (fieldValues.length > 0) {
    await supabase.from("spec_field_values").insert(
      fieldValues
        .filter((fv) => fv.field_id && fv.value?.trim())
        .map((fv) => ({
          spec_id: spec.id,
          template_field_id: fv.field_id,
          value: fv.value,
        }))
    );
  }

  // ── Supplier link ──────────────────────────────────────────────────────────
  if (body.supplier_id) {
    await supabase.from("spec_suppliers").insert({
      spec_id: spec.id,
      supplier_id: body.supplier_id,
      supplier_code: null,
      unit_cost: null,
    });
  }

  return NextResponse.json({ id: spec.id, name: spec.name });
}
