import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import SpecificationsClient from "./SpecificationsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SpecificationsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [
    { data: projectData },
    slotsResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, currency")
      .eq("id", projectId)
      .eq("studio_id", studioId)
      .single(),
    supabase
      .from("project_specs")
      .select("id, code, sequence, quantity, price, budget, spec_id, notes, category_id, created_at")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .order("category_id")
      .order("sequence"),
    supabase
      .from("spec_categories")
      .select("id, name, abbreviation, parent_id, sort_order, is_active")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);

  if (!projectData) notFound();

  const slots = slotsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  // Fetch all studio specs (for the picker) and project options for this project.
  const [{ data: librarySpecsRaw }, { data: optionRows }] = await Promise.all([
    supabase
      .from("specs")
      .select("id, name, image_url, code, category_id")
      .eq("studio_id", studioId)
      .order("name"),
    supabase
      .from("project_options")
      .select("spec_id")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .not("spec_id", "is", null),
  ]);

  const librarySpecs = (librarySpecsRaw ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    image_url: s.image_url ?? null,
    code: s.code ?? null,
    category_id: s.category_id,
  }));

  const optionSpecIds = new Set(
    (optionRows ?? [])
      .map((o) => o.spec_id)
      .filter((id): id is string => !!id),
  );

  const specMap = new Map<string, { id: string; name: string; image_url: string | null; code: string | null }>();
  librarySpecs.forEach((s) => specMap.set(s.id, { id: s.id, name: s.name, image_url: s.image_url, code: s.code }));

  return (
    <SpecificationsClient
      projectId={projectId}
      projectName={projectData.name}
      currency={projectData.currency ?? "GBP"}
      slots={slots.map((s) => ({
        id: s.id,
        code: s.code,
        sequence: s.sequence,
        quantity: Number(s.quantity ?? 1),
        price: s.price === null ? null : Number(s.price),
        budget: s.budget === null ? null : Number(s.budget),
        notes: s.notes,
        category_id: s.category_id,
        spec: s.spec_id ? specMap.get(s.spec_id) ?? null : null,
      }))}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        abbreviation: c.abbreviation,
        parent_id: c.parent_id,
      }))}
      librarySpecs={librarySpecs}
      optionSpecIds={[...optionSpecIds]}
    />
  );
}
