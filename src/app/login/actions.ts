/**
 * Server Actions for the Login page
 *
 * Server Actions run exclusively on the server — never in the browser.
 * This is the correct place to call Supabase Auth with credentials,
 * because the response (session cookie) must be set server-side.
 *
 * The "use server" directive at the top marks this entire file as server-only.
 */

"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function signIn(
  prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Basic validation — catch obvious mistakes before hitting Supabase
  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const cookieStore = await cookies();

  // Create the server-side Supabase client (reads/writes cookies)
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Map Supabase error messages to friendly user-facing text
    if (
      error.message.includes("Invalid login credentials") ||
      error.message.includes("invalid_credentials")
    ) {
      return { error: "Incorrect email or password. Please try again." };
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        error:
          "Please check your email and click the confirmation link first.",
      };
    }
    // Fallback for unexpected errors
    return { error: "Something went wrong. Please try again shortly." };
  }

  // Success — redirect to the home/dashboard page
  // redirect() throws internally so it must be called outside try/catch
  redirect("/");
}

export async function signOut(): Promise<void> {
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

  await supabase.auth.signOut();

  // Clear the studio context cookie so the next login starts fresh
  cookieStore.delete("current_studio_id");

  redirect("/login");
}
