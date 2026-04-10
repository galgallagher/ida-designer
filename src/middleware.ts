/**
 * Next.js Middleware — runs on every request before it reaches a page or API route.
 *
 * What it does:
 * 1. Refreshes the user's Supabase session cookie if it's about to expire.
 * 2. Redirects unauthenticated users to /login (except for /login and /api/* themselves).
 * 3. Redirects logged-in users away from /login back to the home page.
 *
 * Middleware runs on the Edge Runtime (very fast, no Node.js APIs) so we use
 * @supabase/ssr's createServerClient with manual cookie handling.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Start with a response we can modify (add cookies to)
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create a Supabase client that can read/write cookies via the middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          // Write cookies onto both the request and the response.
          // The request update ensures downstream code sees the fresh session.
          // The response update ensures the browser stores the refreshed token.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run any logic between createServerClient and getUser().
  // A subtle bug can happen where the session isn't refreshed if you do.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow API routes and auth callback through without checking session
  const isPublicPath =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/login";

  // Not logged in and trying to access a protected page → send to login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in but trying to hit the login page → send to home
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // Pass through — supabaseResponse carries the refreshed session cookie
  return supabaseResponse;
}

// Tell Next.js which paths this middleware should run on.
// We exclude static files and Next.js internals for performance.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
