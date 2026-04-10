/**
 * Supabase server client
 *
 * Use this in Server Components, Route Handlers, and Server Actions.
 * It reads cookies to identify the logged-in user, so you get the correct
 * RLS context without any extra work.
 *
 * This file runs only on the server — it is safe to use here because:
 * - Server Components are never sent to the browser as code
 * - Route Handlers run in the Node.js environment on the server
 *
 * If you ever need a privileged (service_role) client for admin tasks,
 * create a separate `server-admin.ts` file — NEVER in the browser.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component — cookies can only be
            // modified in Route Handlers and Server Actions, so we silently
            // ignore the error here. Auth middleware handles token refresh.
          }
        },
      },
    }
  );
}
