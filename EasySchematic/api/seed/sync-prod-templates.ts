/**
 * Refresh local D1 templates from production. Called by start-dev.sh on every
 * server start; can also be run manually via `npm run sync:prod-templates`.
 *
 * Behavior (option B from the design discussion):
 *   1. If the cached prod snapshot is older than DEVICE_SYNC_TTL_HOURS (default 24)
 *      or --force was passed, try to refresh it via `wrangler d1 export --remote`.
 *   2. If a snapshot exists (fresh or stale), wipe local templates and load it.
 *   3. If no snapshot exists at all (e.g. first run, offline), fall back to
 *      regenerating from src/deviceLibrary.ts via the existing seed:sql script.
 *
 * The prod snapshot is gitignored — it's reproducible from `wrangler d1 export`
 * and contains community submissions we don't want in source control.
 */

import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiDir, "..");

const SNAPSHOT_PATH = path.join(__dirname, "prod-templates.sql");
const DB_DIR = path.join(apiDir, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const FALLBACK_SQL = path.join(__dirname, "seed-data.sql");

const TTL_HOURS = Number(process.env.DEVICE_SYNC_TTL_HOURS ?? "24");
const FORCE = process.argv.includes("--force") || process.env.DEVICE_SYNC_FORCE === "1";
const OFFLINE = process.argv.includes("--offline") || process.env.DEVICE_SYNC_OFFLINE === "1";

function ageHours(file: string): number {
  return (Date.now() - statSync(file).mtimeMs) / 3_600_000;
}

function isSnapshotStale(): boolean {
  if (!existsSync(SNAPSHOT_PATH)) return true;
  return ageHours(SNAPSHOT_PATH) > TTL_HOURS;
}

function refreshSnapshot(): boolean {
  try {
    process.stdout.write("Refreshing prod templates from Cloudflare D1... ");
    execSync(
      `npx wrangler d1 export easyschematic-db --remote --table=templates --no-schema --output="${SNAPSHOT_PATH}"`,
      { cwd: apiDir, stdio: ["ignore", "pipe", "pipe"] },
    );
    process.stdout.write("done.\n");
    return true;
  } catch (e) {
    const msg = (e as Error).message?.split("\n")[0] ?? String(e);
    process.stdout.write(`failed (${msg.slice(0, 120)}).\n`);
    return false;
  }
}

function findLocalDbFile(): string | null {
  if (!existsSync(DB_DIR)) return null;
  const entries = readdirSync(DB_DIR);
  const sqlite = entries
    .filter((f) => f.endsWith(".sqlite"))
    .map((f) => ({ f, mtime: statSync(path.join(DB_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  return sqlite ? path.join(DB_DIR, sqlite.f) : null;
}

function loadIntoLocal(sqlPath: string, source: string): void {
  const dbFile = findLocalDbFile();
  if (!dbFile) {
    console.warn("WARN  No local D1 SQLite file found — start wrangler dev once first");
    process.exitCode = 1;
    return;
  }
  const db = new DatabaseSync(dbFile);
  try {
    const before = (db.prepare("SELECT COUNT(*) AS n FROM templates").get() as { n: number }).n;
    // FK off + single transaction: prod templates reference users (submitted_by etc.)
    // that aren't replicated locally. Defer-fk inside the dump only works inside a tx.
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    db.exec("DELETE FROM templates");
    db.exec(readFileSync(sqlPath, "utf8"));
    db.exec("COMMIT");
    db.exec("PRAGMA foreign_keys = ON");
    const after = (db.prepare("SELECT COUNT(*) AS n FROM templates").get() as { n: number }).n;
    console.log(`OK  Local D1 templates: ${before} -> ${after} (from ${source})`);
  } finally {
    db.close();
  }
}

function regenerateDeviceLibrarySeed(): boolean {
  try {
    process.stdout.write("Regenerating seed-data.sql from deviceLibrary.ts... ");
    execSync("npm run seed:sql --silent", { cwd: apiDir, stdio: ["ignore", "pipe", "pipe"] });
    process.stdout.write("done.\n");
    return existsSync(FALLBACK_SQL);
  } catch (e) {
    process.stdout.write(`failed (${(e as Error).message?.split("\n")[0]}).\n`);
    return false;
  }
}

function main(): void {
  // Prefer prod snapshot. Refresh when stale or forced (unless offline).
  const stale = isSnapshotStale();
  if (!OFFLINE && (FORCE || stale)) {
    refreshSnapshot();
  } else if (existsSync(SNAPSHOT_PATH)) {
    console.log(`Using cached prod snapshot (age ${ageHours(SNAPSHOT_PATH).toFixed(1)}h, TTL ${TTL_HOURS}h).`);
  }

  if (existsSync(SNAPSHOT_PATH)) {
    loadIntoLocal(SNAPSHOT_PATH, "prod snapshot");
    return;
  }

  // No snapshot available — fall back to deviceLibrary.ts
  console.log("No prod snapshot available; falling back to deviceLibrary.ts seed.");
  if (!regenerateDeviceLibrarySeed()) {
    process.exitCode = 1;
    return;
  }
  loadIntoLocal(FALLBACK_SQL, "deviceLibrary.ts");
}

main();

// Silence unused-var warnings for repoRoot kept for future use (e.g. backup path).
void repoRoot;
