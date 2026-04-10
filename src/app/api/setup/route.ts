/**
 * Setup Route — POST /api/setup
 *
 * A one-time-use admin endpoint for bootstrapping the super admin account.
 * Protected by a secret header so it can't be called by anyone without the key.
 *
 * HOW TO USE:
 *   curl -X POST https://your-domain.com/api/setup \
 *     -H "x-setup-key: YOUR_SETUP_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"gal@idadesigner.com","password":"strong-password","firstName":"Gal","lastName":"Admin"}'
 *
 * REQUIRED ENV VARS (server-only, never NEXT_PUBLIC_):
 *   SETUP_KEY               — secret that must be sent in x-setup-key header
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard → Project Settings → API
 *
 * The service role key bypasses RLS and can create users — it MUST stay server-side.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // ── 1. Check the setup key ─────────────────────────────────────────────
  const providedKey = request.headers.get("x-setup-key");
  const expectedKey = process.env.SETUP_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      { error: "SETUP_KEY environment variable is not configured." },
      { status: 500 }
    );
  }

  if (providedKey !== expectedKey) {
    // Return 404 (not 401) to avoid revealing the endpoint exists
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // ── 2. Validate the service role key is present ────────────────────────
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local — find it in your Supabase dashboard under Project Settings → API.",
      },
      { status: 500 }
    );
  }

  // ── 3. Parse the request body ──────────────────────────────────────────
  let body: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { email, password, firstName = "Gal", lastName = "Admin" } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required in the request body." },
      { status: 400 }
    );
  }

  // ── 4. Create an admin Supabase client (service role — server only) ────
  // This client bypasses RLS and can create/manage users.
  // It NEVER leaves this server route.
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // ── 5. Check if user already exists ────────────────────────────────────
  const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  if (existingUser) {
    // User exists — ensure their profile has platform_role = super_admin
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update({ platform_role: "super_admin" })
      .eq("id", existingUser.id);

    if (profileError) {
      return NextResponse.json(
        { error: `User exists but profile update failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "updated",
      message: `User ${email} already existed. Their platform_role has been set to super_admin.`,
      userId: existingUser.id,
    });
  }

  // ── 6. Create the super admin user ─────────────────────────────────────
  const { data: newUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip the confirmation email — admin-created users are pre-verified
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        platform_role: "super_admin",
      },
    });

  if (createError || !newUser?.user) {
    return NextResponse.json(
      { error: `Failed to create user: ${createError?.message ?? "Unknown error"}` },
      { status: 500 }
    );
  }

  // ── 7. Update the profile row (trigger creates it; we ensure the role) ─
  // The on_auth_user_created trigger runs automatically and creates the profile,
  // but we explicitly set super_admin here in case of any timing issue.
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .upsert({
      id: newUser.user.id,
      first_name: firstName,
      last_name: lastName,
      platform_role: "super_admin",
    });

  if (profileError) {
    return NextResponse.json(
      {
        status: "partial",
        message: `User created (${newUser.user.id}) but profile role update failed: ${profileError.message}`,
        userId: newUser.user.id,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({
    status: "created",
    message: `Super admin account created successfully for ${email}.`,
    userId: newUser.user.id,
  });
}
