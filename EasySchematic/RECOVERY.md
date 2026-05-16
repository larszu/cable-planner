# D1 Recovery Runbook

Operational guide for recovering the EasySchematic devices database (`easyschematic-db`) from an R2 backup. The DB is on Cloudflare D1 free tier, so **Time Travel is not available** — daily R2 exports are the only recovery path.

## When to use this

- A moderator (or buggy code) approved garbage submissions and corrupted live templates.
- Accidental DELETE via admin token nuked rows.
- D1 database corruption (rare, but possible).
- You need to inspect a historical snapshot to investigate something.

## Backup location

- **Bucket:** `easyschematic-backups` (private R2 bucket in same Cloudflare account).
- **Path:** `db/YYYY/MM/DD/easyschematic-YYYYMMDD-HHMMSS.sql`
- **Cadence:** Daily at 09:00 UTC via `.github/workflows/backup-d1.yml`.
- **Retention:** 365 days (configured via R2 lifecycle rule).

## Step 1 — Find the right backup

List recent backups for a given month:

```bash
cd api
npx wrangler r2 object list easyschematic-backups --prefix=db/2026/04/ --remote
```

Pick the most recent backup **before** the bad event. If you're not sure when the bad event happened, query `mod_actions` to see suspicious moderator activity:

```bash
npx wrangler d1 execute easyschematic-db --remote --command="SELECT id, moderator_id, action, submission_id, datetime(created_at) FROM mod_actions ORDER BY id DESC LIMIT 50;"
```

## Step 2 — Download the backup

```bash
cd api
npx wrangler r2 object get easyschematic-backups/db/2026/04/15/easyschematic-20260415-090000.sql \
  --file=../backups/restore.sql --remote
```

## Step 3 — Verify locally first (always)

Apply the restore to your local D1 (NOT production), then sanity-check counts:

```bash
cd api
# Reset local DB and apply the backup
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute easyschematic-db --local --file=../backups/restore.sql

# Confirm row counts look sane
npx wrangler d1 execute easyschematic-db --local \
  --command="SELECT 'templates' AS t, COUNT(*) FROM templates UNION ALL SELECT 'submissions', COUNT(*) FROM submissions UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'mod_actions', COUNT(*) FROM mod_actions;"
```

## Step 4 — Take a fresh production backup BEFORE restoring

A restore is destructive. Always snapshot the current (broken) prod state first so you can investigate what went wrong later:

```bash
cd api
npx wrangler d1 export easyschematic-db --remote \
  --output=../backups/pre-restore-$(date +%Y%m%d-%H%M%S).sql
```

## Step 5 — Restore production

**This overwrites the live database. Be sure.**

D1 doesn't have a single "restore from SQL" command — `wrangler d1 execute --file` runs the SQL against the existing DB. Since the export contains `CREATE TABLE` and `INSERT` statements, you typically need to drop existing tables first or rebuild fresh.

The safest pattern:

1. Note the migration version your backup corresponds to (check the most recent migration file at the time of the backup).
2. Drop and recreate the database via the Cloudflare dashboard (D1 → easyschematic-db → Settings → Delete). This is the nuclear option but cleanest.
3. Re-create the database with the same name, get the new database_id, update `api/wrangler.toml`.
4. Apply the SQL backup:
   ```bash
   cd api
   npx wrangler d1 execute easyschematic-db --remote --file=../backups/restore.sql
   ```
5. Re-deploy the API worker with the new database_id (`cd api && npx wrangler deploy`).

**Less-nuclear alternative:** If only specific tables are corrupted (e.g., `templates` got mangled but `users` and `submissions` are fine), restore only those tables by extracting their statements from the backup with grep/sed and applying just those.

## Step 6 — Verify production

```bash
cd api
npx wrangler d1 execute easyschematic-db --remote \
  --command="SELECT 'templates' AS t, COUNT(*) FROM templates UNION ALL SELECT 'submissions', COUNT(*) FROM submissions UNION ALL SELECT 'users', COUNT(*) FROM users;"
```

Open `devices.easyschematic.live` in a browser and confirm devices load correctly. Check a few specific recently-edited templates against your expectations.

## Step 7 — Investigate root cause via mod_actions

Every approve/reject/defer is logged in the `mod_actions` table with before/after JSON snapshots. To find what a specific moderator did in a time window:

```bash
npx wrangler d1 execute easyschematic-db --remote \
  --command="SELECT id, action, submission_id, template_id, datetime(created_at), substr(before_data, 1, 80) FROM mod_actions WHERE moderator_id = '<USER_ID>' AND created_at > datetime('now', '-7 days') ORDER BY id DESC;"
```

To revoke moderator access if you've identified a bad actor:

```bash
npx wrangler d1 execute easyschematic-db --remote \
  --command="UPDATE users SET role = 'contributor', banned = 1 WHERE id = '<USER_ID>';"
```

## Manual on-demand backup

If you want a backup right now (without waiting for the daily cron):

```bash
gh workflow run backup-d1.yml
gh run watch
```

Or do it locally:

```bash
cd api
mkdir -p ../backups
npx wrangler d1 export easyschematic-db --remote \
  --output=../backups/easyschematic-$(date +%Y%m%d-%H%M%S).sql
```
