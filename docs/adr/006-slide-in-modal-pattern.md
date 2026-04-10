# ADR 006 — Modal and Panel Patterns

**Status:** Accepted (updated 2026-04-10 to reflect three distinct patterns now in use)
**Date:** 2026-04-08

## Context

The app needs multiple types of interactive overlays: create forms, full record detail views, and content-preview overlays. These need to feel fast and contextual — the user should not lose their place when opening a record.

Three distinct patterns emerged as the product grew.

## Decision

### Pattern 1 — Centred pop-out modal (create/edit forms)

Used for: AddClientModal, AddProjectModal, AddCompanyModal, etc.

A **centred dialog** (fixed width, mid-screen) that scales in from the centre. Used for forms that collect a small amount of data before creating a record.

```tsx
position: "fixed", top: "50%", left: "50%",
transform: isOpen
  ? "translate(-50%, -50%) scale(1)"
  : "translate(-50%, -52%) scale(0.96)",
opacity: isOpen ? 1 : 0,
transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease"
```

Implementation pattern:
- Server Component page fetches data and passes it down.
- Thin Client Component wrapper owns `isOpen` boolean + renders the "Add" button.
- Modal uses `useActionState` to call a Server Action.
- Server Action handles auth, `studio_id` lookup, DB insert, and `revalidatePath`.

### Pattern 2 — Slide-in detail panel (record detail / edit)

Used for: ContactDetailPanel.

A **full-height right-hand panel** (480px wide) that slides in from the right. Used for rich detail views where the user needs to read, edit, and navigate between sub-sections (e.g. company → people → tags).

```tsx
position: "fixed", right: 0, top: 0, height: "100%",
transform: open ? "translateX(0)" : "translateX(100%)",
transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)"
```

The panel fetches its own data client-side when `companyId` changes, rather than receiving it all via props, because the data is too rich to pass through a list component efficiently.

### Pattern 3 — Full overlay modal (content preview)

Used for: SpecDetailModal.

A **large centred overlay** with a backdrop blur, used when the user wants to inspect a record in detail without leaving the list. The overlay fetches its data via a Server Action (`getSpecDetail`) when opened.

```tsx
// Backdrop
position: "fixed", inset: 0, backdropFilter: "blur(4px)"
// Panel
position: "fixed", top: "50%", left: "50%",
transform: visible ? "translate(-50%,-50%) scale(1)" : "... scale(0.97)"
```

Escape key, X button, and backdrop click all close it. The `visible` state is set after a 10ms delay so the CSS transition actually fires.

## When to use which pattern

| Situation | Pattern |
|---|---|
| Creating or editing a record (short form) | Centred pop-out modal |
| Viewing and editing a rich record with sub-sections | Slide-in detail panel |
| Previewing content from a list without leaving it | Full overlay modal |

## Consequences

- No JS animation library needed — all animation via CSS `transform` + `transition`.
- Escape key and backdrop click close all modal types.
- `useActionState` (React 19) handles pending/error state in forms without extra `useState`.
- TypeScript: hand-written `Database` type requires `as any` casts on Supabase insert calls as a pragmatic workaround until replaced with the CLI-generated version (`supabase gen types typescript`).
