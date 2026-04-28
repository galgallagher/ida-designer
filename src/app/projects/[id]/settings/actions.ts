"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

const ALLOWED_CURRENCIES = new Set([
  "GBP", "EUR", "USD", "AUD", "CAD", "CHF", "JPY", "AED", "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "ZAR",
]);

export async function updateProjectCurrency(
  projectId: string,
  currency: string,
): Promise<{ error: string | null }> {
  const code = currency.trim().toUpperCase();
  if (!ALLOWED_CURRENCIES.has(code)) return { error: "Unsupported currency code." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const studioId = await getCurrentStudioId();
  if (!studioId) return { error: "No studio context." };

  const { error } = await supabase
    .from("projects")
    .update({ currency: code })
    .eq("id", projectId)
    .eq("studio_id", studioId);

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/specifications`);
  return { error: null };
}
