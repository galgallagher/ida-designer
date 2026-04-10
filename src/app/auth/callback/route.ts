/**
 * Auth Callback Route Handler
 *
 * Supabase sends users here after they click an email confirmation link
 * or a magic-link sign-in email. The URL contains a short-lived `code`
 * parameter that we exchange for a real session.
 *
 * Flow:
 *   User clicks email link → lands here → we exchange code → redirect to /
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase puts the one-time code in ?code=
  const code = searchParams.get("code");

  // Optional: where to send the user after a successful sign-in
  // Defaults to the home page if not specified
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Exchange the code for a session — this sets the session cookie
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful — send to the intended destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send back to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
