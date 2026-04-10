# ADR 012 — TypeScript Type Safety Strategy

**Status:** Accepted  
**Date:** 2026-04-10

## Context

The Supabase JavaScript SDK generates query result types from a `Database` type that must be registered when the client is created (`createServerClient<Database>(...)`). If the `Database` type is incomplete or the SDK version is mismatched, TypeScript falls back to `unknown` for all query results, which forced developers to add `as any` casts throughout the codebase — defeating the purpose of TypeScript.

Two problems were identified:

1. **Version mismatch:** `@supabase/ssr@0.5.2` was built for `supabase-js@2.43.x` but `supabase-js@2.102.1` was installed. The type contract between them had changed, causing all Insert types to resolve as `never`. Fixed by upgrading `@supabase/ssr` to `0.10.2`.

2. **Incomplete `Database` type:** `src/types/database.ts` was hand-written and missing several tables (`contacts`, `user_project_stars`, `spec_categories`, `spec_tags`, `spec_suppliers`). Missing tables fell back to `any`. Fixed by adding all missing tables and the `seed_default_contact_categories` RPC to the `Functions` block.

Additionally, the hand-written Insert types used `Omit<Row, "id" | "created_at">` which kept all non-nullable columns required — even columns like `image_url: string | null` that Postgres can store as NULL without being explicitly supplied. This caused TypeScript errors whenever a nullable column was omitted from an insert call.

## Decision

### 1. The `Database` type stays hand-written (for now)

Running `supabase gen types typescript` requires a live Supabase project and CLI setup. The hand-written type in `src/types/database.ts` is sufficient for the current project size and is easier to reason about. The `__InternalSupabase: { PostgrestVersion: "12" }` field must stay in the `Database` type — it tells the SDK which PostgREST version is in use for correct Insert/Update inference.

When the schema stabilises, switch to the CLI-generated type: `npx supabase gen types typescript --project-id tsvehxlvmzumcrmstceo > src/types/database.ts`.

### 2. `Insertable<T>` utility type for Insert types

```typescript
type Insertable<T> = {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];  // nullable → optional
} & {
  [K in keyof T as null extends T[K] ? never : K]: T[K];    // non-nullable → required
};
```

All Insert types (e.g. `SpecInsert`, `ContactCompanyInsert`) now use `Insertable<Omit<Row, "id" | "created_at" | "updated_at">>`. This mirrors the shape that `supabase gen types typescript` would generate and means inserts don't need explicit `null` for every nullable column.

### 3. Shared `adminGuard` in `src/lib/admin-guard.ts`

Three settings action files previously each contained an identical `adminGuard()` function (with slight signature differences). Extracted to a single shared utility that:
- Returns the typed `SupabaseClient<Database>`, `studioId`, and `user` on success
- Runs member + profile queries in parallel with `Promise.all`
- All settings actions (`settings/categories/actions.ts`, `settings/categories/[id]/field-actions.ts`, `settings/contacts/actions.ts`) now import from here

### 4. Nullable parent_id filter pattern

The Supabase SDK does not accept `null` in `.eq("parent_id", null)` — it generates `parent_id=eq.null` which is valid PostgREST syntax but TypeScript rejects the `null` argument. Use `.is("parent_id", null)` for IS NULL checks:

```typescript
const query = parent_id
  ? supabase.from("spec_categories").eq("parent_id", parent_id)
  : supabase.from("spec_categories").is("parent_id", null);
```

### 5. Update types allow `updated_at`

Tables with a manual `updated_at: new Date().toISOString()` in update calls (clients, contacts) use `Partial<Omit<Row, "id" | "created_at">>` as their Update type — not `Partial<Insert>` — so `updated_at` is included.

## Consequences

- **Zero `as any` casts** across the entire codebase (was 91 before this session)
- TypeScript catches column name typos, wrong table names, and missing required fields at compile time
- Insert calls no longer need boilerplate `null` values for nullable columns
- New tables must be added to `src/types/database.ts` before being used — the compiler will catch omissions
- The `__InternalSupabase` field in `Database` must be kept in sync with the actual `@supabase/ssr` + `supabase-js` versions in use
