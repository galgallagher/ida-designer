# ADR 002 — Multi-Tenant Schema: Studios as the Tenant Root

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Ida Designer serves multiple interior design studios. Each studio's data must be completely isolated from other studios — a user from Studio A must never see Studio B's clients, projects, or specs.

Several multi-tenancy approaches exist:
1. **Separate databases per tenant** — complete isolation, very high operational complexity
2. **Separate schemas per tenant** — good isolation, complex migrations
3. **Shared tables with a tenant identifier column** — simpler operations, isolation enforced by RLS

We also need to decide how clients relate to users in the system.

## Decision

### Studios as the tenant root (shared tables approach)

Every table in the application (clients, projects, drawings, specs) has a `studio_id` foreign key column. Supabase's Row Level Security (RLS) policies check this column to ensure users can only access rows that belong to a studio they are a member of.

**Why shared tables:**
- Dramatically simpler to operate: one database, one migration path
- Supabase RLS is well-suited to this pattern — it's essentially the recommended approach
- The `studio_members` join table gives us flexible roles (owner/admin/designer/viewer) per studio per user
- A user can belong to multiple studios (e.g. a freelance designer working for two firms), which is not easily supported by separate schemas

**The access chain:**
```
auth.users (Supabase built-in)
    ↓
profiles (extends auth.users, adds platform_role)
    ↓
studio_members (joins profiles → studios, adds studio role)
    ↓
studios (the tenant root)
    ↓
clients, projects, drawings, specs, ... (all scoped by studio_id)
```

### Clients are NOT platform users

**The distinction:**
- **Platform users** (in `profiles`) are interior designers who log in to use Ida Designer
- **Clients** (in the `clients` table) are the end customers of a design studio — the people whose homes or offices are being designed

Clients do not log in to the platform in v1. They are contact records only.

**Why keep them separate:**
- Clients may never want or need platform access
- If we add a "client portal" feature later, clients can be invited as restricted users without changing the core schema
- Conflating clients with users would mean every client email address becomes a login credential, adding authentication complexity and potential security surface
- A single person could theoretically be both a designer (user) and a client of a different studio — separating the concepts handles this cleanly

**Future consideration:** If a client portal is added, we could add a `client_user_id` FK on the `clients` table linking to `profiles`, while keeping the `clients` record as the source of truth for the contact.

## Consequences

- **Positive:** All data isolation is enforced at the database level (RLS), not just in application code. A coding mistake won't expose another studio's data.
- **Positive:** Studio membership and roles are flexible — one user can have different roles in different studios.
- **Positive:** The schema is straightforward to query — every table can be filtered by `studio_id`.
- **Trade-off:** RLS policies need to be written carefully and tested. A missing policy silently blocks all access (which is safe but confusing). See `docs/adr/000-use-adrs.md` for why we document these decisions.
- **Trade-off:** The join chain for deep access checks (e.g. checking access to a hotspot requires joining through drawing → project → studio_member) is slightly verbose. Indexes on FK columns mitigate performance impact.
