# ADR 025 — Canvas Multiplayer with Liveblocks

**Status:** Accepted
**Date:** 2026-04-28

## Context

The project canvas (tldraw, see ADR 018) is a single-user editor backed by debounced Supabase snapshots. Studios increasingly work as small teams; designers want to see each other's cursors and have shape edits propagate live so they can co-design without coordinating saves and refreshes.

tldraw does not offer a managed sync service for production. The official options are:

1. **Self-host the Node `simple-server-example`** on Railway — singleton room, SQLite hot path, Supabase JSONB backup. Requires a separate always-on service, careful single-replica deploy, and ongoing operational work.
2. **Cloudflare Workers + Durable Objects** — tldraw's own production architecture. Correct at scale but adds a second cloud to operate.
3. **Liveblocks** — hosted real-time service with a generous free tier, an official tldraw integration story, a dashboard for inspecting rooms, and SLA-backed websockets.

Ida runs on Vercel + Supabase + Railway. We have no edge platform, no second cloud, and no ops budget for a self-hosted always-on websocket service. We need multiplayer to *feel* free to start; if it grows, we can revisit.

## Decision

Use **Liveblocks** as the real-time transport for the canvas.

### Storage shape

A single `LiveMap<string, JsonObject>` keyed by tldraw record id holds all document-scope records. Each value is a tldraw `TLRecord` cast to `JsonObject` at the boundary (tldraw's record types don't satisfy Liveblocks' `Lson` index-signature constraint — see `src/lib/liveblocks.ts`).

### Sync direction

- **Liveblocks → tldraw:** `useStorage((root) => root.records)` returns a plain immutable snapshot. On every snapshot change, we apply it to the tldraw store inside `store.mergeRemoteChanges(...)` so the changes are tagged `source: "remote"` and don't echo back.
- **tldraw → Liveblocks:** `store.listen` with `{ scope: "document", source: "user" }` fires on local edits only; we push added/updated/removed records into the LiveMap.

The "remote" / "user" source filter is the linchpin — without it, the two directions feed each other and create infinite loops.

### Document vs session scope

Only document-scope records (`document`, `page`, `shape`, `binding`, `asset`) are synced. Session records (`instance`, `camera`, `pointer`, `instance_page_state`, `instance_presence`) stay local per client. Sharing session records caused a `currentPageId of undefined` crash because each client expects its own instance state. The `isDocumentRecord` helper in `TldrawCanvas.tsx` enforces this on both push and apply.

### Seeding

Existing canvases already have a Supabase JSONB snapshot. On first connect to a fresh room (`records.size === 0`), we copy the snapshot's document-scope records into the LiveMap once. Subsequent connects pick up the live state.

### Backup save

The Supabase snapshot save is retained as disaster recovery, debounced to 5 s and only fired on local edits. Liveblocks is the live source of truth; Supabase is the durable cold backup.

### Authorisation and tenant isolation

Rooms are named `canvas-{studioId}-{canvasId}`. The `/api/liveblocks-auth` endpoint:

1. Verifies the Supabase session (`supabase.auth.getUser()`).
2. Resolves the user's current studio via the existing `getCurrentStudioId()` cookie helper.
3. Rejects any room whose prefix doesn't match `canvas-{studioId}-`.
4. Issues a session token with `FULL_ACCESS` to that one room only.

This means a user in studio A literally cannot obtain a token for studio B's rooms — the token-issuing endpoint refuses. Studio members get a stable `userInfo.color` (hashed from their user id) and a display name from `user_metadata.full_name` / `email`.

### Cursor presence

Cursor positions are broadcast as page coordinates via `useMyPresence`. The `CursorsOverlay` component reads `useOthers()`, converts each remote cursor back to screen coordinates with `editor.pageToScreen`, then subtracts `editor.getViewportScreenBounds()` to get container-local coords (the overlay is positioned inside the tldraw container, not the viewport). A `requestAnimationFrame` loop forces re-render so cursors track the camera as it pans and zooms.

### Secrets

`LIVEBLOCKS_SECRET_KEY` is a server-only env var (no `NEXT_PUBLIC_` prefix). The browser obtains short-lived session tokens from `/api/liveblocks-auth` and never sees the secret.

## Consequences

**Good**
- Live cursor presence and live shape sync ship without operating any new infrastructure.
- Studio isolation is enforced server-side by the same studio context the rest of the app uses, so there is no parallel auth surface to maintain.
- Supabase remains the source of truth at rest; if Liveblocks goes down, canvases still load and edit (they just stop being multiplayer until it returns).
- The Liveblocks dashboard gives us per-room observability for free — useful when debugging "did my edit reach the room?" questions.

**Neutral**
- We pay for Liveblocks at scale. The free tier covers small studios indefinitely; pricing climbs with monthly active users and connection-minutes. Worth re-evaluating once we exceed ~50 active studios.

**Risks / trade-offs**
- Liveblocks lags tldraw's release cadence slightly. If we upgrade tldraw to a version with breaking record-schema changes, we may need to clear room storage. The `isDocumentRecord` filter limits the blast radius but doesn't eliminate it.
- Cursor flicker between two tabs of the same browser is expected behaviour: only the focused tab has a real pointer, so the other tab broadcasts `cursor: null` on `pointerleave`. To genuinely test multiplayer, use two windows side-by-side.
- The `useStorage` selector returns Liveblocks' immutable snapshot, which at runtime is a plain JS object (not a `Map`) — even though the LiveMap is the underlying type. We iterate via `Object.keys` / `Object.values`. Don't trust the inferred TypeScript type here; cast explicitly.
- Existing rooms can become contaminated if we change what counts as a document-scope record. Wipe the room from the Liveblocks dashboard (Rooms → ⋯ → Delete) and the canvas will re-seed from Supabase on next open.

## References

- ADR 018 — Project canvas (tldraw)
- `src/lib/liveblocks.ts` — typed room context
- `src/app/api/liveblocks-auth/route.ts` — token endpoint with studio isolation
- `src/app/projects/[id]/canvas/TldrawCanvas.tsx` — sync, seed, presence overlay
- `memory/tldraw_multiplayer.md` — research notes that informed this decision
