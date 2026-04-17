/**
 * backfill-spec-images.ts
 *
 * Walks the `specs` table and re-hosts every supplier-domain `image_url` on the
 * `spec-images` Supabase Storage bucket. After this runs, every spec's
 * `image_url` points at our CORS-friendly storage so canvas PDF export works.
 *
 * Run with:
 *   npx tsx scripts/backfill-spec-images.ts          # do it
 *   npx tsx scripts/backfill-spec-images.ts --dry    # report only, no writes
 *
 * Idempotent. Safe to re-run. Skips rows already on Supabase storage.
 * On any per-spec failure (network timeout, 4xx, unsupported MIME), the row's
 * `image_url` is left untouched so we never destroy a working URL.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { downloadAndStoreImage } from "../src/lib/ida/download-image";

// Walk up from cwd looking for .env.local. This makes the script work from
// the main repo OR from any git worktree under .claude/worktrees/<name>/,
// without needing to copy or symlink the env file into each worktree.
function findEnvFile(filename: string, maxDepth = 6): string | null {
  let dir = process.cwd();
  for (let i = 0; i < maxDepth; i++) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile(".env.local");
if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`Loaded env from: ${envPath}`);
} else {
  console.error("❌  Could not find .env.local in cwd or any parent directory");
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.argv.includes("--dry") || process.argv.includes("--dry-run");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Match the check inside download-image.ts — kept in sync intentionally. */
function isOnSupabaseStorage(url: string): boolean {
  try {
    return new URL(url).hostname === new URL(SUPABASE_URL).hostname;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log("Loading specs with images…\n");

  const { data: specs, error } = await supabase
    .from("specs")
    .select("id, studio_id, name, image_url")
    .not("image_url", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const all = specs ?? [];
  const todo = all.filter(
    (s) => s.image_url && !isOnSupabaseStorage(s.image_url),
  );
  const alreadyDone = all.length - todo.length;

  console.log(
    `${all.length} specs with images · ${alreadyDone} already on Supabase · ${todo.length} to process\n`,
  );

  if (todo.length === 0) {
    console.log("Nothing to do. All spec images are already on Supabase storage.");
    return;
  }

  let success = 0;
  let failed = 0;
  const failures: { id: string; name: string; url: string }[] = [];

  for (let i = 0; i < todo.length; i++) {
    const spec = todo[i];
    const tag = `[${i + 1}/${todo.length}] ${spec.name.slice(0, 40)}`;

    if (DRY_RUN) {
      console.log(`${tag}  would re-host: ${spec.image_url}`);
      continue;
    }

    process.stdout.write(`${tag}  …`);

    const rehosted = await downloadAndStoreImage(
      spec.image_url,
      spec.studio_id,
      supabase,
    );

    if (!rehosted || rehosted === spec.image_url) {
      console.log("  ⚠  skipped (download or upload failed)");
      failed++;
      failures.push({ id: spec.id, name: spec.name, url: spec.image_url! });
      continue;
    }

    const { error: updErr } = await supabase
      .from("specs")
      .update({ image_url: rehosted })
      .eq("id", spec.id);

    if (updErr) {
      console.log(`  ❌  update failed: ${updErr.message}`);
      failed++;
      failures.push({ id: spec.id, name: spec.name, url: spec.image_url! });
    } else {
      console.log("  ✓");
      success++;
    }

    // Polite delay between supplier fetches to avoid rate-limiting.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("\n────────────────────────────────────────────");
  if (DRY_RUN) {
    console.log(`Dry run complete. Would have processed ${todo.length} specs.`);
  } else {
    console.log(`Done. ${success} succeeded, ${failed} failed.`);
    if (failures.length > 0) {
      console.log("\nFailures (these specs kept their original URL):");
      failures.forEach((f) => {
        console.log(`  ${f.id}  ${f.name.slice(0, 50)}  ${f.url}`);
      });
      console.log(
        "\nRe-run the script to retry failures (it's idempotent), or re-scrape these specs manually.",
      );
    }
  }
}

main().catch((err) => {
  console.error("\nFatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
