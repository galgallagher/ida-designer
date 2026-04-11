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
    field_values: { field_id: string; label: string; value: string }[] | null;
    supplier_id: string | null;
  };

  const studioId = await getCurrentStudioId();
  if (!studioId) return NextResponse.json({ error: "No studio context" }, { status: 400 });

  // ── Resolve template ───────────────────────────────────────────────────────
  // Prefer the category's own template (so template fields match correctly).
  // Fall back to the first active studio template; create "General" if none exist.
  let templateId: string | null = null;

  if (body.category_id) {
    const { data: catData } = await supabase
      .from("spec_categories")
      .select("template_id")
      .eq("id", body.category_id)
      .single();
    templateId = catData?.template_id ?? null;
  }

  if (!templateId) {
    const { data: templates } = await supabase
      .from("spec_templates")
      .select("id")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);
    templateId = templates?.[0]?.id ?? null;
  }

  if (!templateId) {
    const { data: t } = await supabase
      .from("spec_templates")
      .insert({ studio_id: studioId, name: "General", is_active: true })
      .select("id")
      .single();
    templateId = t?.id ?? null;
  }

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
      cost_from: body.cost_from ?? null,
      cost_to: body.cost_to ?? null,
      cost_unit: body.cost_unit ?? null,
    })
    .select("id, name")
    .single();

  if (error || !spec) return NextResponse.json({ error: error?.message }, { status: 500 });

  // ── Tags ───────────────────────────────────────────────────────────────────
  const tags = [...(body.tags ?? [])];
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
