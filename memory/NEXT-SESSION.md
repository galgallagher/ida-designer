# Ida Designer — Next Session Handoff

> Written: 2026-04-10 (session 5). Read this at the start of a new session before touching any code.
> Also read `MEMORY.md` for full project context and `docs/adr/` for architectural decisions.

---

## Where we are

The app is working and running at **http://localhost:3001** (start with `npm run dev` in the project root — it always runs on port 3001).

Sessions 4 + 5 completed:
- **Contacts CRM** — `/contacts` with category sidebar, company list, slide-in detail panel, `/settings/contacts`
- **Spec detail modal** — clicking a spec card opens an overlay, not a new page
- **Spec image upload** — URL input + file upload (max 2 MB) on New Spec + Edit Spec. Storage bucket `spec-images` via migration 020.
- **✅ Full `as any` sweep** — zero casts remaining across the entire codebase. TypeScript compiles clean. Root causes fixed:
  - `@supabase/ssr` upgraded from `0.5.2` → `0.10.2` (was mismatched with `supabase-js@2.102.1`)
  - All missing tables added to `src/types/database.ts` (`contacts`, `user_project_stars`, `spec_categories`, `spec_tags`, `spec_suppliers`)
  - `Insertable<T>` utility type added — nullable columns are now optional in Insert payloads
  - `seed_default_contact_categories` RPC added to `Database.Functions`
  - Update types for `clients` + `contacts` allow `updated_at`
  - Shared `adminGuard()` extracted to `src/lib/admin-guard.ts` (was duplicated in 3 files)
  - Nullable `parent_id` filter uses `.is("parent_id", null)` not `.eq("parent_id", null)`
  - See **ADR 012** for the full story

---

## Recommended next priorities

Pick one, complete it fully, then move to the next.

---

### 1. 🤖 AI spec scraping — "Add from URL"

**What:** User pastes a product URL (tile manufacturer, fabric supplier, etc.) and the app extracts a spec draft — name, description, cost, image, tags — pre-filled for review.

**How to implement:**
1. Add an "Add from URL" button in `SpecLibraryClient.tsx` (alongside the existing "Add Spec" button)
2. A small modal asks for the URL
3. Calls `/api/scrape-spec/route.ts` — a Next.js API route (server-side, never exposes AI key to browser)
4. The route fetches the page HTML, passes it to the Anthropic API with a structured extraction prompt
5. Returns JSON matching the spec form fields: `{ name, description, image_url, cost_from, cost_to, cost_unit, tags, field_values }`
6. Open `NewSpecClient.tsx` pre-filled with the scraped data for user to review + confirm

**Security rules (non-negotiable):**
- `ANTHROPIC_API_KEY` lives in `.env.local` without `NEXT_PUBLIC_` prefix — server-only
- Browser calls `/api/scrape-spec` — never the Anthropic API directly
- The API route is the only place the key is used

**ADR to write:** New ADR 013 for the AI scraping pattern + Anthropic integration.

**Files to create/touch:**
- `src/app/api/scrape-spec/route.ts` — new
- `src/app/specs/SpecLibraryClient.tsx` — add "Add from URL" button + URL modal
- `src/app/specs/new/NewSpecClient.tsx` — accept pre-fill props

---

### 2. 🗂 Project sub-pages — Drawings and Specs

**What:** The project sidebar (`ProjectNav.tsx`) links to `/projects/[id]/specs` and `/projects/[id]/drawings`. Both routes currently 404 or show nothing. These need building.

**`/projects/[id]/specs`:**
- List all `project_specs` for this project (join to `specs` for name, image, category)
- "Add spec" opens a modal to search the studio spec library → add to project
- Click a spec → reuse `SpecDetailModal.tsx`

**`/projects/[id]/drawings`:**
- List `drawings` table rows for this project
- Upload button → Supabase Storage → create drawing row
- Don't build the hotspot viewer yet — just upload + list

**Files to create:**
- `src/app/projects/[id]/specs/page.tsx`
- `src/app/projects/[id]/drawings/page.tsx`

---

### 3. 🏢 Studio settings — team members

**What:** `/settings` exists but Team Members section isn't built. Studios need to invite designers, set roles (owner/admin/designer/viewer), and remove members.

**How:**
1. `studio_members` table exists with roles
2. Supabase Auth `inviteUserByEmail` via the admin API (needs service role key — server-only)
3. Build `/settings/team` — member list + invite form + role change + remove

---

### 4. 🧹 Refactor oversized components (opportunistic — do when in the file anyway)

- `CategoriesClient.tsx` (~918 lines) → split into CategoryTree + FieldsList + FieldEditPanel
- `ContactDetailPanel.tsx` (~612 lines) → split into CompanyForm + TagsSection + PeopleSection
- Merge duplicate `AddProjectModal.tsx` (exists in `/projects/` and `/clients/[id]/`)

---

## Things NOT to do without asking first

- **Do not drop `/specs/[id]` standalone page** — still used for direct URL access
- **Do not change modal animation patterns** — established in ADR 006 (three distinct patterns)
- **Do not add tag management UI** — user hasn't asked for this
- **Do not merge clients + contacts CRM** — intentionally separate systems (ADR 008)
- **Do not replace `src/types/database.ts` with CLI-generated types** without planning — hand-written version is working well and easier to understand

---

## Key files to read before making changes

| Area | File |
|---|---|
| All DB types | `src/types/database.ts` |
| Admin guard (settings actions) | `src/lib/admin-guard.ts` |
| Spec library | `src/app/specs/SpecLibraryClient.tsx`, `src/app/specs/actions.ts` |
| Spec detail modal | `src/app/specs/SpecDetailModal.tsx` |
| Contacts | `src/app/contacts/ContactsClient.tsx`, `src/app/contacts/actions.ts` |
| Navigation | `src/components/SidebarNav.tsx`, `src/components/ProjectNav.tsx` |
| Layout | `src/components/AppShell.tsx` |
| Studio context | `src/lib/studio-context.ts` |

---

## Database quick reference

- **Supabase project ID:** `tsvehxlvmzumcrmstceo`
- **Migrations:** `001` → `020` (015, 016, 017 are missing — next migration file is `021`)
- **RLS helper:** `auth_user_studio_ids()` — returns studio IDs for the current user
- **Test studio ID:** `9c2b2b98-3e63-4d35-a276-a32477364232`

### New table checklist
```sql
-- 1. Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- 2. Add policy using the helper function
CREATE POLICY "Studio members can manage their data"
  ON your_table FOR ALL
  USING (studio_id = ANY(auth_user_studio_ids()))
  WITH CHECK (studio_id = ANY(auth_user_studio_ids()));

-- 3. Add to src/types/database.ts Database.public.Tables block
-- 4. Add Row type + Insertable<Omit<Row, "id"|"created_at"|"updated_at">> Insert type
```

---

## Design tokens (for any new UI)

```
Background:    #EDEDED     Cards:       #FFFFFF
Accent yellow: #FFDE28     Near-black:  #1A1A1A
Secondary:     #9A9590     Muted:       #C0BEBB
Border:        #E4E1DC     Radius:      14px (cards), 8-10px (buttons)
Heading font:  Playfair Display (--font-playfair)
UI font:       Inter (--font-inter)
Card shadow:   0 2px 12px rgba(26,26,26,0.08)
```
