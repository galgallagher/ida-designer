/**
 * Supabase admin (service_role) client
 *
 * Use this ONLY for server-side operations that need to bypass RLS —
 * specifically, writing to platform-level tables like product_library that
 * are read-only for regular users.
 *
 * SECURITY: This key has full database access. Rules:
 *  - NEVER import this in a Client Component or any file that could be bundled for the browser
 *  - NEVER expose the result to the client
 *  - ONLY use inside Server Actions, Route Handlers, or server-only utilities
 *  - The SUPABASE_SERVICE_ROLE_KEY env var must NOT have the NEXT_PUBLIC_ prefix
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. " +
      "The service role client cannot be created."
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      // Disable session persistence — admin client doesn't need cookies
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
