# ADR 004 — Auth Architecture

**Status:** Accepted  
**Date:** 2026-04-08

## Context

The app needs user authentication. We needed to decide:
1. How sign-in state flows through a Next.js App Router application
2. Where secrets live (browser vs. server)
3. How to protect routes without a per-page check
4. How to bootstrap the first super admin account

## Decision

We use **Supabase Auth with `@supabase/ssr`**, structured as follows:

### Session management
- Session tokens are stored in **HTTP-only cookies** (not localStorage).
- `@supabase/ssr` handles cookie reading/writing automatically in Server Components, Route Handlers, and Middleware.
- The browser never touches the session token directly — the server manages it.

### Route protection via Middleware (`src/middleware.ts`)
- A single Next.js middleware file checks every request (except `/login`, `/api/*`, `/auth/*`).
- If no valid session → redirect to `/login`.
- If session + visiting `/login` → redirect to `/`.
- This is the only place route protection logic lives — no per-page boilerplate needed.

### Sign-in flow
- The login page uses a **Server Action** (`login/actions.ts`) to call `signInWithPassword`.
- The Server Action runs on the server, so the password is never processed in the browser.
- `useActionState` (React 19 hook) wires the form to the server action for error handling.

### Super admin bootstrapping
- A one-time `/api/setup` POST endpoint creates the first admin user using the Supabase service role key.
- The endpoint is protected by a `SETUP_KEY` environment variable (checked via the `x-setup-key` header).
- The service role key is server-only (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix).

### Auto-profile creation
- A Postgres trigger (`on_auth_user_created` in migration 011) automatically creates a `profiles` row for every new auth user.
- This means the app never manually inserts a profile — it happens atomically with sign-up.

## Consequences

**Positive:**
- Session cookies are HttpOnly → immune to XSS token theft.
- Secrets never reach the browser.
- Middleware handles all route protection centrally — easy to audit and change.
- The trigger means profiles always exist when a user logs in.

**Negative / trade-offs:**
- Middleware adds a small latency on every request (typically <5ms on Edge).
- The `/api/setup` endpoint must be called manually after first deploy; it can't auto-run.
- The service role key must be added to `.env.local` before the setup endpoint works.

## Alternatives considered

- **Client-side auth checks (useEffect + redirect):** Rejected — creates flash-of-unauthenticated-content and is harder to secure.
- **Per-page auth guards:** Rejected — too much repetitive boilerplate; easy to forget on a new page.
- **NextAuth.js:** Considered but rejected — Supabase Auth is already included in our stack and integrates directly with RLS.
