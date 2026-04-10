# ADR 001 — Technology Stack: Next.js 14 + Supabase

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Ida Designer is a SaaS web application for interior design studios. It needs:
- A rich interactive UI (drawing viewer with hotspots, spec management)
- User authentication and multi-tenant data isolation
- File storage (drawing uploads, product images)
- Real-time updates in future phases
- Fast time-to-market for a small team

The stack must be approachable and have a strong ecosystem of resources.

## Decision

### Next.js 14 (App Router)

**Why Next.js:**
- Industry-standard React framework with an excellent developer experience
- The App Router (introduced in Next.js 13) separates server and client code cleanly, which is critical for our security model: API keys and sensitive operations stay server-side
- Built-in TypeScript support, image optimisation, and API routes
- Vercel (the makers of Next.js) provide a deployment platform that requires zero configuration
- Large community and extensive documentation

**Why App Router specifically:**
- Server Components mean most pages make no round-trips to the client for data — better performance
- The clear `"use client"` boundary prevents secrets from accidentally leaking to the browser
- Route Handlers (in `app/api/`) replace the old `pages/api/` pattern cleanly

### Supabase

**Why Supabase:**
- Provides Postgres (a battle-tested relational database), authentication, file storage, and real-time subscriptions in one managed service — eliminating the need to configure and maintain separate services
- Row Level Security (RLS) lets the database itself enforce data access rules, not just the application layer. Even if there is a bug in the app code, the database won't return data the user isn't allowed to see
- Supabase's JavaScript client (`@supabase/supabase-js`) is well-maintained and integrates cleanly with Next.js via `@supabase/ssr`
- The free tier is generous for early development; pricing scales predictably

### Tailwind CSS

**Why Tailwind:**
- Utility-first CSS makes it easy to build custom designs without naming CSS classes
- Works perfectly with React component composition
- The design system is built in the `tailwind.config.ts` file, making it easy to enforce consistent colours, spacing, and typography

## Consequences

- **Positive:** We get auth, database, storage, and real-time in one subscription. No need to integrate separate services (e.g. AWS S3 + Auth0 + PlanetScale).
- **Positive:** The security model (RLS + server-side secrets) is built into the architecture from day one, not retrofitted later.
- **Trade-off:** We are vendor-dependent on Supabase. However, Supabase is built on standard Postgres, so migrating to another Postgres host is feasible if needed.
- **Trade-off:** The Next.js App Router is newer and some third-party libraries haven't fully caught up. We should check compatibility before adding new libraries.
