# ADR 008 — Two Separate Contact Systems: Project Clients vs. Contacts CRM

**Status:** Accepted (updated 2026-04-10 — Contacts CRM added as a separate system)
**Date:** 2026-04-08

## Context

The app has two distinct concepts that both involve "companies and the people at them":

1. **Project clients** — the end customers whose spaces are being designed. Studio A's "Hilton UK" is a project client. They are linked to projects. They are the reason the studio exists.

2. **Trade contacts** — suppliers, contractors, consultants, freelancers, architects, etc. These are the people and companies a studio works *with* to deliver projects. They are not clients; they are part of the studio's professional network.

Initially only project clients existed. As the product grew it became clear that studios need a full address book / CRM for their trade contacts, with categorisation, people records, and tags — essentially a separate thing from project clients.

## Decision

### Project clients (`clients` + `contacts` tables)

The `clients` table represents project client companies. The `contacts` table represents people at those companies. These are tightly coupled to projects.

- `clients`: `id`, `studio_id`, `name`, `address` (legacy fields `email`/`phone`/`company`/`notes` remain in DB but are unused in UI)
- `contacts`: `id`, `client_id`, `studio_id`, `first_name`, `last_name`, `role`, `email`, `phone`, `notes`, `is_primary`
- `studio_id` is denormalised onto `contacts` for efficient RLS without joins

### Contacts CRM (`contact_categories` + `contact_companies` + `contact_people` + `contact_tags`)

A fully separate system for the studio's professional network. Introduced in migrations `018` and `019`.

**`contact_categories`** — a configurable, studio-specific category tree (same self-join pattern as `spec_categories`):
- `id`, `studio_id`, `parent_id` (nullable FK to self), `name`, `icon`, `sort_order`, `is_active`
- Default categories are seeded via `seed_default_contact_categories(p_studio_id)` RPC on first visit

Default category tree:
```
Clients
Suppliers
Contractors
  ├── General Contractors
  ├── Joinery & Carpentry
  ├── Electrical
  ├── Plumbing & Mechanical
  ├── Plastering & Dry Lining
  ├── Tiling & Stone
  └── Painting & Decorating
Consultants
  ├── Structural Engineers
  ├── M&E Engineers
  ├── Project Managers
  ├── Quantity Surveyors
  ├── Lighting Designers
  └── Acoustic Consultants
Architects
Artists & Makers
Press & Media
Freelancers
  ├── Photographers
  ├── Stylists
  ├── Illustrators
  ├── 3D Visualisers
  ├── Copywriters
  └── Social Media
```

**`contact_companies`** — replaces the old `suppliers` table entirely:
- `id`, `studio_id`, `category_id`, `name`, `website`, `email`, `phone`, `street`, `city`, `country`, `notes`
- All spec supplier references (`spec_suppliers.supplier_id`) now point to `contact_companies.id`

**`contact_people`** — people at a contact company (equivalent to `contacts` for project clients):
- `id`, `company_id`, `studio_id`, `name`, `role`, `email`, `phone`, `notes`

**`contact_tags`** — free-form tags on companies (composite PK: `company_id` + `tag`):
- Tags are shared vocabulary within a studio — autocomplete pulls from all existing `contact_tags` for the studio

### Why not merge the two systems?

- Project clients have a fundamentally different lifecycle — they are linked to projects and have a project-centric view
- The CRM contacts are a professional network / address book — no project link required
- Merging would force unnatural categorisation on project clients (are they "Clients" in the CRM category tree, or a different thing entirely?)
- Keeping them separate lets each evolve independently

### Suppliers migration (ADR 009 update)

The old `suppliers` and `supplier_contacts` tables from the spec library were **dropped entirely** in migration `019`. `spec_suppliers.supplier_id` now references `contact_companies.id`. This means every supplier is now a full contact record, visible in the Contacts section of the app.

## UX

- **`/contacts`** — left sidebar with category tree (expand/collapse) + tag filter. Main area: company list. Click a company → ContactDetailPanel slide-in (company fields, people, tags).
- **`/settings/contacts`** — manage the category tree (add/rename/reorder/toggle active/delete categories).
- Category pre-selected in AddCompanyModal when browsing a specific category.

## Consequences

- Every supplier is now a first-class contact record — studios build a proper address book as they add specs.
- Tags are shared across contacts, enabling cross-cutting search by material type, specialty, etc.
- The spec library's "Add supplier" field now creates a `contact_companies` row — no more orphaned supplier records.
- Legacy `clients` fields (`email`, `phone`, `company`, `notes`) are still in the DB schema; they can be dropped in a future cleanup migration.
- Two "people" tables exist (`contacts` for project clients, `contact_people` for CRM) — this is intentional. If a future "link contact to project" feature is needed, a junction table can join `contact_companies` to `projects` without merging the schemas.
