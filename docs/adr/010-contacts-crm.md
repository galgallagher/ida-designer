# ADR 010 — Contacts CRM Architecture

**Status:** Accepted  
**Date:** 2026-04-10

## Context

Studios need a professional address book — suppliers, contractors, consultants, freelancers, architects, press contacts, and more. This is distinct from "project clients" (see ADR 008). The system needs:

- Categories that the studio configures themselves (not hardcoded)
- Company records with multiple people
- Free-form tags for cross-cutting search
- A settings page to manage the category tree
- Default categories on first use (studios shouldn't start with an empty screen)

## Decision

### Schema (migrations 018 + 019)

**`contact_categories`** — configurable per studio, two-level tree (same self-join pattern as `spec_categories`):
```sql
id uuid PK, studio_id, parent_id (→ self, nullable),
name text, icon text, sort_order int, is_active bool, created_at
```
RLS: `studio_id = ANY(auth_user_studio_ids())`

**`contact_companies`** — replaces old `suppliers` table:
```sql
id uuid PK, studio_id, category_id (→ contact_categories),
name, website, email, phone, street, city, country, notes,
created_at, updated_at (auto-updated by trigger)
```

**`contact_people`** — individuals at a company:
```sql
id uuid PK, company_id (→ contact_companies), studio_id,
name, role, email, phone, notes, created_at, updated_at
```

**`contact_tags`** — free-form tags on companies:
```sql
company_id (→ contact_companies), tag text
PRIMARY KEY (company_id, tag)
```

### Seeding default categories

`seed_default_contact_categories(p_studio_id uuid)` is a PL/pgSQL SECURITY DEFINER function (migration 018) that inserts the default tree. Called on first visit to `/contacts` or `/settings/contacts` — the server component checks if count = 0 and calls the RPC.

**Critical:** The seed RPC is called during server component render. `revalidatePath` must NOT be called from within a function that runs during render — only from Server Actions triggered by user interaction. The seed function therefore does not revalidate.

### Settings UI (`/settings/contacts`)

A collapsible category tree with:
- Expand/collapse chevrons
- Inline "add category" row
- Side panel for editing name, icon, active toggle, delete
- Move up/down buttons using wrapper `async () => { await action() }` functions to satisfy the `form action` void return type requirement

### Contacts UI (`/contacts`)

- **Left sidebar:** category tree with expand/collapse + tag filter chips
- **Main area:** sticky search header + company list
- **AddCompanyModal:** pre-selects the active category as `defaultCategoryId` so the modal isn't blank when browsing a specific category
- **ContactDetailPanel (slide-in):** full company edit form + people list + tags section, fetches own data via `getContactDetail(id)` server action when `companyId` prop changes

### Tag autocomplete

`getContactDetail` returns both the company's tags and `allStudioTags` — a distinct list of all tags used anywhere in the studio's contacts. The tag input uses this for autocomplete dropdown, enabling a shared vocabulary to emerge naturally.

## Consequences

- Every former "supplier" is now a contact record — richer data, visible in the Contacts section
- Studios can customise categories to match how they actually work (a residential studio might have different categories from a commercial one)
- The default category tree covers the most common interior design studio needs
- Seeding on first visit (rather than at studio creation) means new studios always get defaults, even if the studio creation flow is updated later — at the cost of a slight awkwardness in the server component logic
- `contact_tags` uses a delete-all-then-reinsert pattern on save — not atomic, acceptable at current scale
