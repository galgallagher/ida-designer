# Ida Designer — Project Memory

> Keep this file under 200 lines. Update it as the project evolves.
> Last updated: 2026-04-11 (session 7)

## What is this project?

A SaaS platform for interior design studios. Studios manage clients, projects, drawings (floor plans), specifications (materials/products), and contacts (suppliers, contractors, consultants, etc.). The key feature is an interactive drawing viewer where "hotspots" link drawings together or pin specifications to locations on a plan.

## Current phase

**Phase 10 — shadcn/ui migration complete.** Foundation (CSS variables, Tailwind tokens, `cn()`) installed in session 6. All Radix UI primitives migrated in session 7: Tooltip (IconRail), Select (MembersClient), DropdownMenu (StudioSwitcher), Dialog (ProjectTeamClient + SpecDetailModal), Sheet (ContactDetailPanel). Visual design unchanged — only behaviour layer replaced. Build clean, zero TypeScript errors.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router |
| Database | Supabase (Postgres + Auth + RLS + Storage) |
| Auth | Supabase Auth + @supabase/ssr@0.10.2 (cookie sessions) |
| CSS | Tailwind CSS + inline style tokens + shadcn/ui (Radix primitives) |
| Language | TypeScript (strict, zero `as any`) |

See `docs/adr/001-tech-stack.md` for full reasoning.

## Key architectural decisions

1. **Studios are the tenant root.** Every table has `studio_id`. RLS enforces isolation.
2. **Clients = project clients (companies). Contacts CRM = separate system.** See ADRs 008 + 010.
3. **RLS uses SECURITY DEFINER functions** to break recursion. `auth_user_studio_ids()` is the main helper. See ADR 007.
4. **Studio context via cookie.** `getCurrentStudioId()` in `src/lib/studio-context.ts`.
5. **Server-side secrets.** Anon key only in browser. Service role key server-only.
6. **Auth via middleware.** Route protection in `src/middleware.ts`.
7. **Spec library uses templates.** Categories → Templates → Fields → Spec values. See ADR 009.
8. **Spec detail is a modal overlay** (not a separate page). See ADR 006.
9. **Free-form tags** across specs (`spec_tags`) and contacts (`contact_tags`). See ADR 011.
10. **Category seeding on first visit** — server component checks count === 0, calls RPC if zero. No `revalidatePath` during render.
11. **`Database` type is hand-written** in `src/types/database.ts`. Uses `Insertable<T>` for optional nullable columns. `__InternalSupabase: { PostgrestVersion: "12" }` required. See ADR 012.
12. **Shared `adminGuard`** in `src/lib/admin-guard.ts` — used by all settings actions. Returns `{ supabase, studioId, user }` or `{ error }`.

## Database schema

- **Platform:** `profiles`
- **Studio:** `studios`, `studio_members`, `studio_roles` (configurable job titles)
- **Project CRM:** `clients`, `contacts` (people at client companies)
- **Project:** `projects`, `drawings`, `drawing_hotspots`, `project_specs`, `project_members`, `user_project_stars`
- **Specs:** `spec_categories`, `spec_templates`, `spec_template_fields`, `specs`, `spec_field_values`, `spec_tags`, `spec_suppliers`
- **Contacts CRM:** `contact_categories`, `contact_companies`, `contact_people`, `contact_tags`

Migrations: `supabase/migrations/001` → `022` (note: 015, 016, 017 numbering exists — next migration is `023`)

Key recent migrations:
- `019_contacts_crm.sql` — drops old suppliers tables, creates contact_companies/people/tags, recreates spec_suppliers
- `020_spec_images_bucket.sql` — creates `spec-images` storage bucket + RLS policies

### RLS helper functions (applied directly in Supabase SQL editor)

```sql
CREATE OR REPLACE FUNCTION auth_user_studio_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT studio_id FROM studio_members WHERE user_id = auth.uid()
$$;
```

## Live environment

- **URL:** http://localhost:3001 (dev — `npm run dev`, port 3001 hardcoded in package.json)
- **Supabase project:** `tsvehxlvmzumcrmstceo`
- **Gal's profile ID:** `8809d913-3132-4b8f-8724-478d77cd1b82` (platform_role: super_admin)
- **Test Studio ID:** `9c2b2b98-3e63-4d35-a276-a32477364232`

## File structure (key files)

```
src/
  app/
    page.tsx                             — dashboard
    clients/[id]/                        — client detail, contacts, edit modals
    projects/
      page.tsx + ProjectsPageClient      — list/tile view, search, sort
      [id]/layout.tsx                    — IconRail + ProjectNav (no AppShell)
    specs/
      page.tsx                           — spec library (server)
      SpecLibraryClient.tsx              — sidebar, search, grid/list, modal trigger
      SpecDetailModal.tsx                — spec detail modal overlay
      actions.ts                         — createSpec, updateSpec, deleteSpec, getSpecDetail
      new/page.tsx + NewSpecClient       — 2-step: category picker → form (image URL + upload)
      [id]/edit/page.tsx + EditSpecClient — edit form (image URL + upload)
    contacts/
      page.tsx                           — contacts list (server, seeds on first visit)
      ContactsClient.tsx                 — left sidebar tree, search, company list
      ContactDetailPanel.tsx             — slide-in detail panel
      actions.ts                         — CRUD for companies, people, tags; getContactDetail
    settings/
      contacts/page.tsx + ContactCategoriesClient
      contacts/actions.ts                — CRUD for contact categories
      categories/                        — spec category management
  components/
    AppShell.tsx                         — layout shell (fully typed, no as any)
    SidebarNav.tsx, IconRail.tsx, ProjectNav.tsx
  lib/
    admin-guard.ts                       — shared adminGuard() for settings actions
    studio-context.ts                    — getCurrentStudioId()
    categories.ts                        — getCategoryLabel() utility
  types/database.ts                      — all TypeScript types (hand-written, see ADR 012)
supabase/migrations/                     — SQL 001–020
docs/adr/                               — ADRs 000–012
memory/MEMORY.md                        — this file
```

## Design tokens

```
Background:       #EDEDED     Cards:        #FFFFFF
Accent yellow:    #FFDE28     Near-black:   #1A1A1A
Secondary text:   #9A9590     Muted:        #C0BEBB
Border:           #E4E1DC     Card radius:  14px    Button: 8–10px
Heading font:     Playfair Display (--font-playfair)
UI font:          Inter (--font-inter)
Card shadow:      0 2px 12px rgba(26,26,26,0.08)
```

## Modal / panel patterns

All modals and panels now use shadcn/Radix primitives — Escape, backdrop click, focus trap, scroll lock, and ARIA are all handled automatically.

- **Centred Dialog** — `<Dialog>` + `<DialogContent>` — used for: Add Team Members (ProjectTeamClient), Spec Detail (SpecDetailModal)
- **Slide-in Sheet** — `<Sheet side="right">` — used for: Contact Detail Panel (480px wide)
- **Dropdown** — `<DropdownMenu>` — used for: StudioSwitcher
- **Select** — `<Select>` — used for: Members page job title + access role
- **Tooltip** — `<Tooltip>` — used for: IconRail collapsed icon labels

shadcn components live in `src/components/ui/`. Installed: tooltip, select, dropdown-menu, dialog, sheet.

## Known technical debt (do not fix without planning)

- `CategoriesClient.tsx` is ~918 lines — needs splitting into sub-components (CategoryTree, FieldsList, FieldEditPanel)
- `ContactDetailPanel.tsx` is ~612 lines — CompanyForm, TagsSection, PeopleSection should be separate
- Delete-then-insert for field values/tags is non-atomic — acceptable now, needs RPC transaction later
- Two separate `AddProjectModal.tsx` files (`/clients/[id]/` and `/projects/`) — merge when next feature touches the form
- `src/types/database.ts` is hand-written — replace with `npx supabase gen types typescript` when schema stabilises

## Ida — AI Design Assistant

Persistent chat widget (bottom-right bubble) that lives in AppShell. Always has page context. Built on Vercel AI SDK + Claude.

**Architecture:** `src/lib/ida/skills/` — each skill is a file exporting a tool definition + handler. Route assembles relevant skills based on current page. See ADR 014.

**Skills planned:**
- `scrape-spec` — extract product spec from URL (Jina Reader → Claude Haiku)
- `create-category` — create a new spec category mid-conversation
- `save-spec` — write confirmed spec to DB

**Config page (owner only):** `/settings/ida` — view skill prompts, enable/disable skills, see token usage. Not built yet — flagged as important for Gal to maintain Ida's behaviour over time without touching code.

**Key rules:**
- `ANTHROPIC_API_KEY` is server-only (no NEXT_PUBLIC_)
- Browser → `/api/ida` → Anthropic. Never direct.
- Categories always injected into context at scrape time
- If product category doesn't exist → Ida asks, then calls `create-category` tool

## Next steps (priority order)

- [ ] **Ida widget shell** — floating bubble, expand/collapse, `useChat` hook, streaming. ADR 014.
- [ ] **Ida spec scraping skill** — Jina + Haiku extraction, image picker, category matching, save to library
- [ ] **Ida config page** — `/settings/ida` for viewing/editing skill prompts without touching code
- [ ] **Project sub-pages** — `/projects/[id]/specs` and `/projects/[id]/drawings`
- [ ] **Invite team members** — Supabase Auth `inviteUserByEmail`
- [ ] **Drawing viewer** — upload + hotspot overlay (large feature)
