"use server";

/**
 * Server Actions for the Clients page.
 *
 * addClient — inserts a new client row plus any inline contacts in one go.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddClientResult =
  | { success: true; clientId: string }
  | { error: string };

export interface InlineContact {
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone: string;
}

// ── addClient ─────────────────────────────────────────────────────────────────

export async function addClient(formData: FormData): Promise<AddClientResult> {
  const supabase = await createClient();

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "You must be logged in to add a client." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio found for your account. Please contact support." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Company name is required." };

  const address = (formData.get("address") as string | null)?.trim() || null;

  // Parse inline contacts (serialised as JSON by the modal before submit)
  let contacts: InlineContact[] = [];
  const contactsJson = formData.get("contacts_json") as string | null;
  if (contactsJson) {
    try { contacts = JSON.parse(contactsJson); } catch { /* ignore bad JSON */ }
  }

  // 1. Insert the client
  const { data: newClient, error: insertError } = await supabase
    .from("clients")
    .insert({ studio_id: studioId, name, address })
    .select("id")
    .single();

  if (insertError || !newClient) {
    console.error("[addClient] insert error:", insertError);
    return { error: "Failed to save client. Please try again." };
  }

  // 2. Insert any inline contacts (best-effort — don't fail the whole request)
  if (contacts.length > 0) {
    const rows = contacts
      .filter((c) => c.first_name?.trim())
      .map((c, i) => ({
        client_id: newClient.id,
        studio_id: studioId,
        first_name: c.first_name.trim(),
        last_name: c.last_name?.trim() || null,
        role: c.role?.trim() || null,
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        is_primary: i === 0, // first contact is primary
      }));

    if (rows.length > 0) {
      const { error: contactsError } = await supabase.from("contacts").insert(rows);
      if (contactsError) console.error("[addClient] contacts insert error:", contactsError);
    }
  }

  revalidatePath("/clients");
  return { success: true, clientId: newClient.id };
}
