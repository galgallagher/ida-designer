/**
 * downloadAndStoreImage
 *
 * Fetches a remote image and re-hosts it on the studio's `spec-images`
 * Supabase storage bucket. Returns the public Supabase URL.
 *
 * Why this exists: tldraw's PDF export rasterises shapes through an
 * SVG → canvas → PNG pipeline. Cross-origin images without permissive CORS
 * headers taint the canvas and get dropped from the export. Supabase storage
 * serves with proper CORS so re-hosted images survive the export.
 *
 * Behaviour:
 *  - Short-circuits if the URL is already on this project's Supabase storage.
 *  - Strips UTM-style tracking params before hashing/fetching.
 *  - Validates the response is a known image MIME type.
 *  - Uses a deterministic SHA256-based path so repeat calls dedupe naturally.
 *  - Always non-throwing — returns null on any failure so callers can fall
 *    back to the original URL without breaking the scrape/save pipeline.
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const UTM_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid",
];

const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripTracking(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    UTM_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** True when `url` is hosted on this project's Supabase storage. */
function isSupabaseStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    return new URL(url).hostname === new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
}

export async function downloadAndStoreImage(
  imageUrl: string | null | undefined,
  studioId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (isSupabaseStorageUrl(imageUrl)) return imageUrl;

  const cleanUrl = stripTracking(imageUrl);

  try {
    const res = await fetch(cleanUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(
        `[downloadAndStoreImage] non-OK response ${res.status} for ${cleanUrl}`,
      );
      return null;
    }

    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = ALLOWED_TYPES.get(contentType);
    if (!ext) {
      console.warn(
        `[downloadAndStoreImage] unsupported content-type "${contentType}" for ${cleanUrl}`,
      );
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;

    const hash = crypto
      .createHash("sha256")
      .update(cleanUrl)
      .digest("hex")
      .slice(0, 16);
    const path = `${studioId}/${hash}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("spec-images")
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn("[downloadAndStoreImage] upload failed", uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("spec-images")
      .getPublicUrl(path);

    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.warn(
      "[downloadAndStoreImage] failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
