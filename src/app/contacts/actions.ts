"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import type { ContactPersonRow } from "@/types/database";

// ── getSupplierSpecs ──────────────────────────────────────────────────────────

export interface SupplierSpec {
  id: string;
  name: string;
  image_url: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  category_name: string | null;
}

export async function getSupplierSpecs(companyId: string): Promise<SupplierSpec[]> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return [];

  // Step 1: get spec IDs linked to this supplier
  const { data: links } = await supabase
    .from("spec_suppliers")
    .select("spec_id")
    .eq("supplier_id", companyId);

  if (!links || links.length === 0) return [];

  const specIds = links.map((l) => l.spec_id);

  // Step 2: fetch those specs (studio scoped) with their categories
  const { data: specs } = await supabase
    .from("specs")
    .select("id, name, image_url, cost_from, cost_to, cost_unit, category_id")
    .eq("studio_id", studioId)
    .in("id", specIds)
    .order("name");

  if (!specs || specs.length === 0) return [];

  // Step 3: fetch category names for any non-null category_ids
  const catIds = [...new Set(specs.map((s) => s.category_id).filter(Boolean))] as string[];
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from("spec_categories")
      .select("id, name")
      .in("id", catIds);
    (cats ?? []).forEach((c) => catMap.set(c.id, c.name));
  }

  return specs.map((s) => ({
    id: s.id,
    name: s.name,
    image_url: s.image_url,
    cost_from: s.cost_from,
    cost_to: s.cost_to,
    cost_unit: s.cost_unit,
    category_name: s.category_id ? (catMap.get(s.category_id) ?? null) : null,
  }));
}

type Result = { error?: string };

// ── helpers ───────────────────────────────────────────────────────────────────

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, studioId: null };
  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found.", supabase: null, studioId: null };
  return { error: null, supabase, studioId };
}

function revalidate() {
  revalidatePath("/contacts");
}

// ── getContactDetail ──────────────────────────────────────────────────────────

export interface ContactDetailData {
  company: {
    id: string; name: string; category_id: string | null;
    website: string | null; email: string | null; phone: string | null;
    street: string | null; city: string | null; country: string | null;
    notes: string | null; created_at: string;
  };
  people: ContactPersonRow[];
  tags: string[];
  allStudioTags: string[]; // for autocomplete
}

export async function getContactDetail(id: string): Promise<ContactDetailData | null> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return null;

  const { data: company } = await supabase
    .from("contact_companies").select("*").eq("id", id).eq("studio_id", studioId).single();
  if (!company) return null;

  const { data: peopleData } = await supabase
    .from("contact_people").select("*").eq("company_id", id).order("created_at");

  const { data: tagsData } = await supabase
    .from("contact_tags").select("tag").eq("company_id", id);

  // All tags used by this studio (for autocomplete) — fetch company IDs first, then tags
  const { data: companyIdsData } = await supabase
    .from("contact_companies").select("id").eq("studio_id", studioId);
  const { data: allTagsData } = await supabase
    .from("contact_tags").select("tag")
    .in("company_id", (companyIdsData ?? []).map((c) => c.id));

  const allStudioTags = [...new Set<string>(
    (allTagsData ?? []).map((t) => t.tag)
  )].sort();

  return {
    company,
    people: (peopleData ?? []) as ContactPersonRow[],
    tags: (tagsData ?? []).map((t) => t.tag),
    allStudioTags,
  };
}

// ── createContactCompany ──────────────────────────────────────────────────────

export async function createContactCompany(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const category_id = (formData.get("category_id") as string | null)?.trim() || null;
  const website = (formData.get("website") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const city = (formData.get("city") as string | null)?.trim() || null;
  const country = (formData.get("country") as string | null)?.trim() || null;

  const { data, error: insertError } = await supabase
    .from("contact_companies")
    .insert({ studio_id: studioId, name, category_id, website, email, phone, city, country, street: null, notes: null })
    .select("id")
    .single();

  if (insertError || !data) return { error: "Failed to create contact." };
  revalidate();
  return { id: data.id };
}

// ── updateContactCompany ──────────────────────────────────────────────────────

export async function updateContactCompany(id: string, formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const category_id = (formData.get("category_id") as string | null)?.trim() || null;
  const website = (formData.get("website") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const street = (formData.get("street") as string | null)?.trim() || null;
  const city = (formData.get("city") as string | null)?.trim() || null;
  const country = (formData.get("country") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { error: updateError } = await supabase
    .from("contact_companies")
    .update({ name, category_id, website, email, phone, street, city, country, notes })
    .eq("id", id).eq("studio_id", studioId);

  if (updateError) return { error: "Failed to update contact." };
  revalidate();
  return {};
}

// ── deleteContactCompany ──────────────────────────────────────────────────────

export async function deleteContactCompany(id: string): Promise<Result> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const { error: deleteError } = await supabase
    .from("contact_companies").delete().eq("id", id).eq("studio_id", studioId);

  if (deleteError) return { error: "Failed to delete contact." };
  revalidate();
  return {};
}

// ── updateContactTags ─────────────────────────────────────────────────────────

export async function updateContactTags(companyId: string, tags: string[]): Promise<Result> {
  const { error, supabase } = await guard();
  if (error || !supabase) return { error: error ?? "Unknown error." };

  await supabase.from("contact_tags").delete().eq("company_id", companyId);

  if (tags.length > 0) {
    await supabase.from("contact_tags")
      .insert(tags.map((tag) => ({ company_id: companyId, tag })));
  }

  revalidate();
  return {};
}

// ── createContactPerson ───────────────────────────────────────────────────────

export async function createContactPerson(formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const company_id = (formData.get("company_id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const role = (formData.get("role") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { error: insertError } = await supabase
    .from("contact_people")
    .insert({ company_id, studio_id: studioId, name, role, email, phone, notes });

  if (insertError) return { error: "Failed to add person." };
  revalidate();
  return {};
}

// ── updateContactPerson ───────────────────────────────────────────────────────

export async function updateContactPerson(id: string, formData: FormData): Promise<Result> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Name is required." };

  const role = (formData.get("role") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { error: updateError } = await supabase
    .from("contact_people")
    .update({ name, role, email, phone, notes })
    .eq("id", id).eq("studio_id", studioId);

  if (updateError) return { error: "Failed to update person." };
  revalidate();
  return {};
}

// ── deleteContactPerson ───────────────────────────────────────────────────────

export async function deleteContactPerson(id: string): Promise<Result> {
  const { error, supabase, studioId } = await guard();
  if (error || !supabase || !studioId) return { error: error ?? "Unknown error." };

  const { error: deleteError } = await supabase
    .from("contact_people").delete().eq("id", id).eq("studio_id", studioId);

  if (deleteError) return { error: "Failed to delete person." };
  revalidate();
  return {};
}
