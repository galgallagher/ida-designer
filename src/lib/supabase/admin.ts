/**
 * Supabase admin client — uses the service_role key, which bypasses RLS.
 *
 * ONLY use this server-side for admin operations that need elevated access
 * (e.g. looking up users by email via auth.admin API).
 *
 * Never import this in client components or expose the key to the browser.
 * The service role key must be set in .env.local as SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey === "your-service-role-key-here") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. " +
      "Add it to .env.local — find it in the Supabase Dashboard under Project Settings → API."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
