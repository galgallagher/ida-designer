#!/usr/bin/env node
/**
 * scripts/migrate.js
 *
 * Applies any pending SQL migrations from supabase/migrations/ to the remote DB.
 * Tracks applied migrations in a _migration_history table so each file only runs once.
 *
 * Usage:
 *   npm run migrate
 *
 * The DATABASE_URL is read from .env.local automatically.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not found in .env.local");
  process.exit(1);
}

// ── Helper: run SQL via psql ─────────────────────────────────────────────────
function psql(sql) {
  // Decode percent-encoded password in the URL for PGPASSWORD env var
  const url = new URL(DATABASE_URL);
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  const safeUrl = DATABASE_URL.replace(/:([^@]+)@/, ":***@");
  try {
    return execSync(`psql "${DATABASE_URL}" -c "${sql.replace(/"/g, '\\"')}"`, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
  } catch (err) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

function psqlFile(filePath) {
  const url = new URL(DATABASE_URL);
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  try {
    return execSync(`psql "${DATABASE_URL}" -f "${filePath}"`, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
  } catch (err) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

// ── Ensure tracking table exists ─────────────────────────────────────────────
psql(`
  CREATE TABLE IF NOT EXISTS public._migration_history (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

// ── Read applied migrations ───────────────────────────────────────────────────
const url = new URL(DATABASE_URL);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const appliedRaw = execSync(
  `psql "${DATABASE_URL}" -t -A -c "SELECT filename FROM public._migration_history ORDER BY filename"`,
  { env, stdio: ["pipe", "pipe", "pipe"] }
).toString();
const applied = new Set(appliedRaw.split("\n").map((s) => s.trim()).filter(Boolean));

// ── Find pending migration files ──────────────────────────────────────────────
const migrationsDir = path.join(__dirname, "../supabase/migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // numeric order: 001_, 002_, …

const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log("✅  No pending migrations.");
  process.exit(0);
}

console.log(`🚀  Applying ${pending.length} migration(s):\n`);

for (const file of pending) {
  const filePath = path.join(migrationsDir, file);
  process.stdout.write(`   → ${file} … `);
  try {
    psqlFile(filePath);
    psql(`INSERT INTO public._migration_history (filename) VALUES ('${file}') ON CONFLICT DO NOTHING`);
    console.log("done");
  } catch (err) {
    console.log("FAILED");
    console.error(`\n❌  Migration failed: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}

console.log("\n✅  All migrations applied.");
