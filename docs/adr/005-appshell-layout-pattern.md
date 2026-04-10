# ADR 005 — AppShell Layout Pattern (Server + Client Split)

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Every authenticated page needs a sidebar and a shared layout. The sidebar must:
1. Know the current URL to highlight the active nav item (requires client-side `usePathname()`)
2. Show the signed-in user's name and initials (requires server-side profile data)
3. Show a list of clients for quick navigation (requires a Supabase query)
4. Have a working sign-out button (requires a Server Action)

There is a fundamental tension here: interactive features like `usePathname()` require a Client Component, but data fetching from Supabase should happen on the server to keep credentials and queries out of the browser.

## Decision

Split the layout into two components:

**`AppShell.tsx` (Server Component)**
- Fetches the user profile and client list from Supabase using the server-side client
- Does not have access to the browser URL
- Renders the outer layout (`flex h-screen`) and the main content area
- Passes all data (profile, clients, signOut action) down as props to SidebarNav

**`SidebarNav.tsx` (Client Component)**
- Receives all data as props — never fetches anything itself
- Uses `usePathname()` to determine the active nav item and whether to expand the client sub-list
- Handles the sign-out button click by calling the Server Action passed as a prop

Pages use `<AppShell>` as a wrapper:
```tsx
export default async function ClientsPage() {
  // ... server-side data fetching
  return (
    <AppShell>
      <YourContent />
    </AppShell>
  );
}
```

## Why not use a layout.tsx at the route group level?

A `layout.tsx` in `src/app/(authenticated)/layout.tsx` would be more "Next.js idiomatic" but:
1. We couldn't pass per-page props (like which clients to show in the sidebar sub-list)
2. The client list needs to stay in sync with what the current page shows, making co-location at the page level cleaner
3. The current structure is simpler to understand for a non-engineer audience

This can be revisited when we have more complex per-layout requirements.

## Consequences

**Good:**
- Credentials and DB queries stay on the server
- Interactive sidebar features (active state) work correctly
- Clean, readable code — each component has a single responsibility
- Easy to add new data to the sidebar by adding it to AppShell's fetch

**Trade-off:**
- AppShell re-fetches the client list on every page load (not cached across navigations)
- This is acceptable at current scale; can add caching later with `unstable_cache` or React cache()
