/**
 * Supabase browser client
 *
 * Use this only in Client Components (files marked "use client").
 * It uses the public anon key which is safe to expose — Supabase Row Level
 * Security (RLS) policies ensure users can only access their own data.
 *
 * NEVER use this file to store the service_role key. That key bypasses RLS
 * and must only ever live on the server.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    // These two values are intentionally public — they identify your Supabase
    // project but do NOT grant privileged access. Security comes from RLS.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
