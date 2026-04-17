# ADR 019 — Spec Image Re-hosting

**Status:** Accepted
**Date:** 2026-04-16

## Context

Project Canvas (ADR 018) uses tldraw, which exports the canvas to PDF via an SVG → canvas → PNG pipeline. When an exported page contains a cross-origin `<img>` whose server did not return permissive `Access-Control-Allow-Origin` headers, the browser marks the canvas as "tainted" and silently drops that image from the rasterised output. The PDF page then shows a broken-image placeholder with only the alt text.

Most supplier product CDNs (Kirkby Design, many fabric houses, etc.) do not send CORS headers, because their images are intended to be embedded in normal `<img>` tags, not read pixel-by-pixel from a canvas. Setting `crossOrigin="anonymous"` on the `<img>` does not fix this — it just makes the browser refuse to load the image at all when CORS headers are absent (this was the regression fixed in commit `799e0f9`).

The `spec-images` Supabase Storage bucket (created in migration `020_spec_images_bucket.sql`) already serves with permissive CORS headers and is publicly readable. Images served from there work cleanly with the tldraw export pipeline.

## Decision

At scrape time, download the remote image bytes server-side and re-upload them to the `spec-images` bucket. Store the resulting Supabase public URL on the spec instead of the supplier URL.

### Helper

A single helper, `downloadAndStoreImage(imageUrl, studioId, supabase)` in `src/lib/ida/download-image.ts`:

- Short-circuits when the URL is already on this project's Supabase storage.
- Strips UTM-style tracking params before fetching/hashing.
- Validates the response is a known image MIME type (`image/jpeg`, `image/png`, `image/webp`).
- Uses a deterministic SHA256-based path (`{studio_id}/{hash16}.{ext}`) so repeat scrapes of the same URL dedupe naturally inside the bucket.
- Always non-throwing — returns `null` on any failure so callers fall back to the original supplier URL. Image rehosting must never block scrape or save.

### Wiring

Three server-side call sites:

1. **`POST /api/canvas/scrape-and-add`** (`scrapeUrl`) — re-host `bestImage` after extraction, before writing to `global_specs` and before returning. The downstream `/api/ida/save` call then receives the already-rehosted URL.
2. **`POST /api/ida/save`** — re-host `body.image_url` before inserting the spec row. Covers the Ida chat save flow, which is independent of the canvas paste flow.
3. **`scrapeSpec` skill** (`src/lib/ida/skills/scrape-spec.ts`) — re-host the primary candidate image (`images[0].url`) before writing to `global_specs`. Other studios that later pin this global spec inherit a CORS-safe URL.

### Client-side: data-URI embedding in `toSvg`

Re-hosting alone is not sufficient. The real failure mode in tldraw's export pipeline is **not** CORS tainting — it's that an SVG loaded as the `src` of an `Image` element (which is how tldraw rasterises shapes to PNG) refuses to fetch **any** external resources referenced inside a `<foreignObject>`, regardless of CORS headers or the `crossOrigin` attribute. This is a browser security rule for SVG-used-as-image.

Therefore `SpecCardShape.toSvg` is now `async`: before returning the JSX, it fetches the card's image, base64-encodes it via `FileReader.readAsDataURL`, and substitutes the data URI into the shape passed to `SpecCardBody`. The SVG that tldraw ends up with has the image embedded inline, so the browser doesn't need to fetch anything external during rasterisation.

The fetch uses `mode: "cors"`, which works reliably for Supabase-hosted URLs (the bucket serves permissive CORS). Supplier URLs typically fail here and fall back to the original URL — which then drops from the export, same as before. The rehost + backfill ensure almost every spec's image is on Supabase, so this fallback rarely triggers.

The editor-mode render remains a plain `<img>` with no `crossOrigin` attribute — it's a normal DOM image that never touches a canvas, so CORS rules don't apply. Keeping this unchanged preserves the behaviour that commit `799e0f9` fixed: old supplier URLs still load in the editor for specs that haven't been re-scraped.

### Auth & path scoping

The `spec-images` bucket policy requires the uploader to be a member of the studio whose ID is the first path segment. The helper accepts a `SupabaseClient` so callers can pass their authenticated, cookie-scoped client; no admin/service-role key is required.

### Bucket choice

Reused the existing `spec-images` bucket rather than creating a new one (e.g. `spec-image-cache`). Benefits: no new migration, no new RLS policy surface, semantically consistent (these *are* spec images), and unifies hand-uploaded spec images with auto-rehosted ones.

## Consequences

**Positive**

- Project Canvas PDF export reliably renders supplier images for every supplier — not just those that happen to send CORS headers.
- Specs no longer break if a supplier rotates their CDN URLs.
- Supabase CDN delivery is generally faster than supplier sites for repeat loads.
- Same image URL scraped from multiple specs only stores one copy (deterministic hash path).

**Negative**

- Slight extra latency on first scrape (one extra HTTP roundtrip + storage upload, ~200–500ms typical, capped at 5s by the fetch timeout).
- Supabase storage usage will grow with the spec library. Acceptable trade-off; product images are typically under 200KB each.
- If a supplier image is later updated, our cached copy becomes stale until the spec is re-scraped. Intentional — predictability beats hidden cache invalidation.

**Backfill**

`scripts/backfill-spec-images.ts` (run via `npm run backfill:spec-images` or `npx tsx scripts/backfill-spec-images.ts`) walks the `specs` table and re-hosts any `image_url` not already on Supabase storage. Idempotent and safe to re-run; supports `--dry` to report only. Run once after deploy to migrate pre-fix specs.

**Out of scope (future work)**

- **Backfill of `global_specs`.** Studio specs auto-rehost via `/api/ida/save` when their global parent is pinned, so this is low priority.
- **Image transformation / resizing.** Images are stored at source resolution.
