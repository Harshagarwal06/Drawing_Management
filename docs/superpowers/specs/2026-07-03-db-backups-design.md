# Automated Database Backups — Design

**Date:** 2026-07-03
**Status:** Approved
**Branch:** main

## Problem

DrawVault's entire production dataset is a single SQLite file (`dms.db`) on a
Railway volume. Volume corruption, an accidental wipe, or a bad deploy would
lose every drawing record, transmittal, and user account with no recovery
path. There are currently no backups of any kind.

## Requirements (confirmed with user)

- Store backups in a **separate, private R2 bucket** — the existing bucket is
  public and the DB contains password hashes, user emails, and Slack webhook
  secrets.
- **Daily** backups, **30-day** retention.
- Runs **silently**; a **Director-only status endpoint** reports backup state.
  No frontend UI in this iteration.
- Restore is a **documented manual procedure**, not an API endpoint.

## Approach

In-process scheduler inside the existing backend service (chosen over a
separate Railway cron service or GitHub Actions, because Railway volumes mount
to exactly one service — only the app process can read `dms.db`). Smallest
possible footprint: no new npm dependencies, no new infrastructure.

## Architecture

New file `dms-backend/backup.js` exporting:

| Function | Purpose |
|----------|---------|
| `startBackupScheduler(deps)` | Called once from server.js on boot. Arms the daily timer and runs a catch-up backup if needed. |
| `runBackup(deps)` | Executes one backup cycle (snapshot → gzip → upload → prune). |
| `getBackupStatus(deps)` | Returns status for the API endpoint. |

`deps` = `{ db, r2, bucket, log }` — injected so the module is unit-testable.

## Configuration

One new env var on Railway: `R2_BACKUP_BUCKET` (private bucket, same
Cloudflare account, existing `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`
credentials).

- Unset → scheduler disabled; clear warning in the boot log (same style as the
  existing `R2_CONFIGURED` startup checks). App behaves exactly as today.

## Schedule

- Daily at **02:00 Asia/Dubai = 22:00 UTC** (Dubai is fixed UTC+4, no DST —
  no timezone library needed).
- Implemented as a self-re-arming `setTimeout` chain (no node-cron).
- **Catch-up on boot:** if the newest object in the backup bucket is older
  than 24 h (or the bucket is empty), run a backup immediately. Covers
  restarts/deploys that skip a 2 a.m. slot.

## Backup run — data flow

1. `db.backup(tmpFile)` — better-sqlite3 online backup API; consistent
   snapshot while the server keeps serving requests.
2. Gzip the snapshot with Node's built-in `zlib`.
3. `PutObject` to `R2_BACKUP_BUCKET` with key
   `backups/dms-<ISO timestamp>.db.gz` (e.g. `backups/dms-2026-07-03T22-00-00Z.db.gz`).
4. Prune: `ListObjectsV2` on the `backups/` prefix; delete objects with
   `LastModified` older than 30 days.
5. Remove the temp file in a `finally` block.

## Error handling

- Every run is fully wrapped: a failure logs `❌ Backup failed: <reason>` and
  records `lastError` in memory — it can never crash or block the server.
- Prune failures do not abort the backup (an extra old file beats a missing
  new one).
- The scheduler re-arms for the next day regardless of outcome.

## Status endpoint

`GET /api/admin/backup-status` — guarded by `verifyToken` + `requireDirector`.

```json
{
  "configured": true,
  "count": 30,
  "latestBackup": { "key": "backups/dms-....db.gz", "sizeBytes": 123456, "lastModified": "..." },
  "lastError": null
}
```

- `latestBackup`/`count` come from listing the bucket → correct across
  restarts.
- `lastError` is in-memory since boot.
- Gives a monitoring hook and a future Settings-card data source.

## Restore procedure (manual, documented in docs/RESTORE.md)

1. Download the chosen `.db.gz` from the R2 dashboard.
2. `gunzip` it; verify with `sqlite3 dms.db "PRAGMA integrity_check"`.
3. Replace `dms.db` on the Railway volume (via `railway ssh`) and restart the
   service.

Deliberately **not** an API endpoint — a one-click "overwrite production DB"
is more risk than convenience.

## Testing

Jest unit tests for `backup.js` with a mocked S3 client:

- Backup key naming format.
- Prune selects only objects older than 30 days.
- Catch-up-on-boot: runs when bucket empty / latest > 24 h old; skips when
  fresh.
- Upload failure sets `lastError` and does not throw.

Manual end-to-end verification against the real private bucket before deploy.

## Out of scope

- Frontend Settings UI (future: card fed by the status endpoint).
- Backing up R2 drawing files themselves (they are not on the volume;
  separate concern).
- Restore-via-API.
