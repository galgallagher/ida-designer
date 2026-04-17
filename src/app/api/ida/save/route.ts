/**
 * POST /api/ida/save
 *
 * Direct spec save endpoint — called when the user clicks "Add to library"
 * in Ida's chat UI. Bypasses Claude entirely; just writes to the DB.
 *
 * Two flows:
 *  1. Fresh scrape  — spec data comes directly from the scrape result
 *  2. Global pin    — spec data comes from global_specs (from_global: true)
 *     In the pin flow, global freeform fields are mapped to the studio's
 *     template fields using fuzzy label matching, and global tags are copied.
 *
 * Saves: spec row, tags, template field values, and supplier link.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { extractVisualTags } from "@/lib/ida/extract-visual-tags";
import { resolveTemplateId } from "@/lib/ida/resolve-template";
import { matchFieldsToTemplate } from "@/lib/ida/match-fields";
import { downloadAndStoreImage } from "@/lib/ida/download-image";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    code?: string | null;
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
    // Global library fields
    global_spec_id: string | null;
    from_global?: boolean;
    brand_domain?: string | null;
    // Variant grouping
    variant_group_id?: string | null;
  };

  const studioId = await getCurrentStudioId();
  if (!studioId) return NextResponse.json({ error: "No studio context" }, { status: 400 });

  // ── Resolve template ───────────────────────────────────────────────────────
  const templateId = await resolveTemplateId(supabase, studioId, body.category_id ?? null);
  if (!templateId) return NextResponse.json({ error: "No template" }, { status: 500 });

  // ── Pin flow: load global fields and map to studio template ───────────────
  // When from_global is true, field_values from the request body may be empty
  // (the scrape tool only returns raw fields, not pre-mapped field_values for
  // global hits). We load them from global_spec_fields and map them here.
  let fieldValues = body.field_values ?? [];

  if (body.from_global && body.global_spec_id && fieldValues.length === 0) {
    try {
      // Load global freeform fields
      const { data: globalFields } = await supabase
        .from("global_spec_fields")
        .select("label, value")
        .eq("global_spec_id", body.global_spec_id);

      if (globalFields && globalFields.length > 0) {
        // Load the studio's template fields for this template
        const { data: templateFields } = await supabase
          .from("spec_template_fields")
          .select("id, name, template_id")
          .eq("template_id", templateId);

        if (templateFields && templateFields.length > 0) {
          const matched = matchFieldsToTemplate(globalFields, templateFields);
          fieldValues = matched.map((m) => ({ field_id: m.field_id, value: m.value }));
        }
      }
    } catch { /* non-critical — proceed without field values */ }
  }

  // ── Resolve supplier from brand_domain if not already set ─────────────────
  // In the pin flow, supplier_id may be null if the brand_domain wasn't resolved
  // at scrape time. Try to resolve it here using the same 3-tier strategy.
  let supplierId = body.supplier_id;
  if (!supplierId && body.brand_domain) {
    try {
      const domain = body.brand_domain;
      const { data: companies } = await supabase
        .from("contact_companies")
        .select("id, name, website")
        .eq("studio_id", studioId);

      const domainMatch = (companies ?? []).find((c) => {
        if (!c.website) return false;
        try {
          return new URL(c.website.startsWith("http") ? c.website : `https://${c.website}`)
            .hostname.replace(/^www\./, "") === domain;
        } catch { return false; }
      });

      if (domainMatch) {
        supplierId = domainMatch.id;
      }
      // Note: we do NOT auto-create a company in the save route — only the
      // scrape route auto-creates. The studio can link a supplier manually later.
    } catch { /* non-critical */ }
  }

  // ── Re-host image on Supabase storage ──────────────────────────────────────
  // Supplier CDNs frequently lack permissive CORS headers, which taints the
  // tldraw export canvas and drops the image from PDF exports of project
  // canvases. Re-hosting on Supabase storage (which serves with proper CORS)
  // ensures PDF export works. Falls back to the original URL on failure.
  const rehostedImageUrl = body.image_url
    ? (await downloadAndStoreImage(body.image_url, studioId, supabase)) ?? body.image_url
    : null;

  // ── Insert spec ────────────────────────────────────────────────────────────
  const { data: spec, error } = await supabase
    .from("specs")
    .insert({
      studio_id: studioId,
      template_id: templateId,
      category_id: body.category_id ?? null,
      name: body.name,
      code: body.code ?? null,
      description: body.description ?? null,
      image_url: rehostedImageUrl,
      source_url: body.source_url ?? null,
      global_spec_id: body.global_spec_id ?? null,
      variant_group_id: body.variant_group_id ?? null,
      cost_from: body.cost_from ?? null,
      cost_to: body.cost_to ?? null,
      cost_unit: body.cost_unit ?? null,
    })
    .select("id, name")
    .single();

  if (error || !spec) return NextResponse.json({ error: error?.message }, { status: 500 });

  // ── Tags ───────────────────────────────────────────────────────────────────
  // For pin flow: also copy global tags so Ida's search works on pinned specs
  const visualTags = rehostedImageUrl ? await extractVisualTags(rehostedImageUrl) : [];
  const tags = [...(body.tags ?? []), ...visualTags];
  if (body.source_url) tags.push(`source:${body.source_url}`);

  if (body.from_global && body.global_spec_id) {
    try {
      const { data: globalTags } = await supabase
        .from("global_spec_tags")
        .select("tag")
        .eq("global_spec_id", body.global_spec_id);
      (globalTags ?? []).forEach((t) => tags.push(t.tag));
    } catch { /* non-critical */ }
  }

  // Deduplicate tags
  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length > 0) {
    await supabase.from("spec_tags").insert(uniqueTags.map((tag) => ({ spec_id: spec.id, tag })));
  }

  // ── Template field values ──────────────────────────────────────────────────
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
  if (supplierId) {
    await supabase.from("spec_suppliers").insert({
      spec_id: spec.id,
      supplier_id: supplierId,
      supplier_code: null,
      unit_cost: null,
    });
  }

  return NextResponse.json({ id: spec.id, name: spec.name });
}
