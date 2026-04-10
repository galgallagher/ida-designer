/**
 * Spec Detail — /specs/[id]
 *
 * Shows full spec: image, all field values, supplier(s), tags,
 * cost estimate, and projects that use this spec.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ExternalLink, Tag, Package, Pencil } from "lucide-react";
import AppShell from "@/components/AppShell";
import type { SpecRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SpecDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch spec
  const { data: specData } = await supabase.from("specs").select("*").eq("id", id).single();
  if (!specData) notFound();
  const spec = specData;

  // Fetch category
  const { data: catData } = spec.category_id
    ? await supabase.from("spec_categories").select("*").eq("id", spec.category_id).single()
    : { data: null };

  // Fetch template fields + values
  const { data: fieldsData } = await supabase
    .from("spec_template_fields")
    .select("*")
    .eq("template_id", spec.template_id)
    .order("order_index");
  const fields = fieldsData ?? [];

  const { data: valuesData } = await supabase
    .from("spec_field_values")
    .select("*")
    .eq("spec_id", id);
  const values = valuesData ?? [];
  const valueMap = new Map(values.map((v) => [v.template_field_id, v.value]));

  // Fetch tags
  const { data: tagsData } = await supabase
    .from("spec_tags").select("tag").eq("spec_id", id);
  const tags = (tagsData ?? []).map((t) => t.tag);

  // Fetch suppliers via junction
  const { data: specSupData } = await supabase
    .from("spec_suppliers")
    .select("supplier_id, supplier_code, unit_cost")
    .eq("spec_id", id);

  const supplierIds = (specSupData ?? []).map((s) => s.supplier_id);
  type SupplierDisplay = { id: string; name: string; website: string | null; supplier_code: string | null; unit_cost: number | null };
  let suppliers: SupplierDisplay[] = [];
  if (supplierIds.length > 0) {
    const { data: supData } = await supabase
      .from("contact_companies").select("id, name, website").in("id", supplierIds);
    suppliers = (supData ?? []).map((sup) => {
      const junction = specSupData?.find((s) => s.supplier_id === sup.id);
      return { ...sup, supplier_code: junction?.supplier_code ?? null, unit_cost: junction?.unit_cost ?? null };
    });
  }

  // Fetch projects that use this spec
  const { data: projectSpecData } = await supabase
    .from("project_specs")
    .select("project_id")
    .eq("spec_id", id);

  const projectIds = (projectSpecData ?? []).map((p) => p.project_id);
  let projects: { id: string; name: string; code: string | null; client_id: string; status: string }[] = [];
  if (projectIds.length > 0) {
    const { data: projData } = await supabase.from("projects").select("*").in("id", projectIds);
    projects = projData ?? [];
  }

  const createdDate = new Date(spec.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppShell>
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6" style={{ fontSize: 12, color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}>
        <Link href="/specs" className="flex items-center gap-1 hover:text-[#1A1A1A] transition-colors" style={{ color: "#9A9590", textDecoration: "none" }}>
          <ArrowLeft size={11} /> Spec Library
        </Link>
        <span>/</span>
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{spec.name}</span>
      </div>

      <div className="flex gap-8">
        {/* ── Left: image ── */}
        <div className="flex-shrink-0" style={{ width: 280 }}>
          <div
            className="flex items-center justify-center"
            style={{ width: 280, height: 280, borderRadius: 14, backgroundColor: "#F0EEEB", backgroundImage: spec.image_url ? `url(${spec.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 2px 12px rgba(26,26,26,0.08)" }}
          >
            {!spec.image_url && <Package size={40} style={{ color: "#D4D2CF" }} />}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1" style={{ backgroundColor: "#F0EEEB", borderRadius: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                  <Tag size={9} />{tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="mt-4" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB" }}>
            Added {createdDate}
          </div>
        </div>

        {/* ── Right: details ── */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {catData && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                  {catData.name}
                </p>
              )}
              <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 24, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2 }}>
                {spec.name}
              </h1>
              {spec.description && (
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 6, lineHeight: 1.6 }}>
                  {spec.description}
                </p>
              )}
            </div>
            <Link
              href={`/specs/${id}/edit`}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", textDecoration: "none" }}
            >
              <Pencil size={12} /> Edit
            </Link>
          </div>

          {/* Cost */}
          {(spec.cost_from || spec.cost_to) && (
            <div className="mb-6 p-4 bg-white" style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Estimated cost</p>
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
                {spec.cost_from && spec.cost_to
                  ? `£${Number(spec.cost_from).toLocaleString()} – £${Number(spec.cost_to).toLocaleString()}`
                  : spec.cost_from ? `from £${Number(spec.cost_from).toLocaleString()}` : `up to £${Number(spec.cost_to).toLocaleString()}`}
                {spec.cost_unit && <span style={{ fontSize: 13, fontWeight: 400, color: "#9A9590", marginLeft: 6 }}>{spec.cost_unit}</span>}
              </p>
            </div>
          )}

          {/* Characteristics */}
          {fields.length > 0 && (
            <div className="mb-6">
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Characteristics</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 14, columnGap: 24 }}>
                {fields.map((field) => {
                  const val = valueMap.get(field.id);
                  if (!val) return null;
                  const isUrl = field.field_type === "url";
                  return (
                    <div key={field.id}>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#B0AEA9", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{field.name}</p>
                      {isUrl ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, color: "#6B7280", textDecoration: "none", background: "#F0EEEB", borderRadius: 6, padding: "3px 8px" }}
                        >
                          View <ExternalLink size={9} />
                        </a>
                      ) : (
                        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", lineHeight: 1.4 }}>{val}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {suppliers.length > 0 && (
            <div className="mb-6">
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Supplier{suppliers.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-col gap-3">
                {suppliers.map((sup) => (
                  <div key={sup.id} className="flex items-center justify-between p-3 bg-white" style={{ borderRadius: 10, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
                    <div>
                      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{sup.name}</p>
                      <div className="flex items-center gap-3 mt-1" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                        {sup.supplier_code && <span>Code: {sup.supplier_code}</span>}
                        {sup.unit_cost && <span>£{sup.unit_cost} / unit</span>}
                        {sup.website && (
                          <a href={sup.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline" style={{ color: "#9A9590" }}>
                            Website <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects using this spec */}
          {projects.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Used in {projects.length} project{projects.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-col gap-2">
                {projects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between p-3 bg-white transition-shadow hover:shadow-md" style={{ borderRadius: 10, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", textDecoration: "none" }}>
                    <div className="flex items-center gap-2">
                      {project.code && <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#C0BEBB" }}>{project.code}</span>}
                      <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{project.name}</span>
                    </div>
                    <ArrowLeft size={13} style={{ color: "#C0BEBB", transform: "rotate(180deg)" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </AppShell>
  );
}
