# ADR 029 — Cached user/studio context per request

**Status:** Accepted
**Date:** 2026-04-29

## Context

Page navigation in the app felt slow. A performance audit found the root cause was structural duplication of the same auth + studio resolution work in three independent places, on every navigation:

1. `AppShell` (server component, wraps every non-project page) fetched: `auth.getUser()` → `profiles` → `studio_members` → `studios` → `studio_members` again (for the role in the current studio).
2. `ProjectLayout` (server component, wraps `/projects/[id]/*`) fetched the same first four queries again.
3. `getCurrentStudioId()` (called from most page handlers) fetched `auth.getUser()` and `studio_members` a third time.

Because Next.js renders layouts and pages in the same request, all three ran on every navigation — typically 6–9 redundant Supabase round-trips before the page even started fetching its own data. None of the three was aware of the others.

The problem was not "we need to add caching." The problem was that the same logic existed in three places. The fix is to consolidate, not to add a caching layer on top.

## Decision

Add a single `getUserContext()` function in `src/lib/user-context.ts` wrapped in React's `cache()`. It returns everything any layout or page needs to render the shell:

```ts
{
  user: User | null,
  profile: ProfileRow | null,
  memberships: { studio_id: string; role: StudioMemberRole }[],
  allStudios: StudioRow[],
  currentStudio: StudioRow | null,
  currentStudioId: string | null,
  studioRole: StudioMemberRole | null,
  isSuperAdmin: boolean,
  isAdmin: boolean,
  displayName: string,
  initials: string,
}
```

`React.cache()` is a built-in primitive (React 19 / Next 15) that memoises the call within a single server request. The first caller pays the cost; every subsequent caller in the same request gets the cached result for free. There is no shared state across requests, no invalidation problem.

`AppShell`, `ProjectLayout`, and any page that previously called `getCurrentStudioId()` now call `getUserContext()`. The duplicated query code is **deleted**, not wrapped.

`getCurrentStudioId()` is kept as a one-line shim (`return (await getUserContext()).currentStudioId`) so existing callers don't need to change. New code should call `getUserContext()` directly.

## Consequences

**Good**
- One canonical place that knows how to resolve "who is the user, what studio are they in, what can they do." Schema changes (e.g. adding RBAC fields) only need to touch one file.
- Per-navigation Supabase round-trips drop from 6–9 to roughly 3 (user, profile, memberships+studios). On project pages, the AppShell vs. ProjectLayout duplication is eliminated entirely.
- Eliminates a class of subtle bugs where AppShell and ProjectLayout could disagree about the current studio (e.g. cookie read at slightly different times).

**Trade-offs**
- `getUserContext()` returns more data than any single caller needs. Net call count is still much lower because the data is shared. We accept the (small) over-fetch in exchange for the consolidation.
- React's `cache()` only dedupes within a single request. Across requests there is no caching — by design. This keeps the pattern boring and avoids stale-cache bugs.

## Related

- Audit findings: list pages without limits, IdaWidget eager-mount, `next.config` missing `optimizePackageImports`, admin/studios N+1. Those are independent fixes addressed in the same change set as this ADR.
