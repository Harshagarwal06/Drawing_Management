# Restoring the DrawVault database from backup

Backups are gzipped SQLite snapshots in the **private** R2 bucket
(`R2_BACKUP_BUCKET`), key pattern `backups/dms-<timestamp>.db.gz`, taken
daily at 02:00 Dubai time, kept 30 days.

## Check backup health

`GET /api/admin/backup-status` (Director token required) — returns newest
backup key, size, timestamp, count, and last error since boot.

## Restore procedure

1. **Download** the chosen `.db.gz` from the Cloudflare dashboard →
   R2 → backup bucket → `backups/`.
2. **Unpack and verify locally:**
   ```bash
   gunzip dms-<timestamp>.db.gz
   sqlite3 dms-<timestamp>.db "PRAGMA integrity_check;"   # must print: ok
   sqlite3 dms-<timestamp>.db "SELECT COUNT(*) FROM drawings;"  # sanity-check contents
   ```
3. **Replace the live DB on the Railway volume:**
   ```bash
   railway link          # select the backend service
   railway ssh           # shell into the running container
   # inside the container — path is the DB_PATH env var:
   echo $DB_PATH
   exit
   # copy the verified file up (from your machine):
   railway ssh -- bash -c 'cat > "$DB_PATH"' < dms-<timestamp>.db
   ```
4. **Restart** the service from the Railway dashboard so better-sqlite3
   reopens the file.
5. **Verify:** log in to the frontend; check `GET /api/health` and that
   drawings/transmittals look right.

## Notes

- Drawing **files** live in the public R2 bucket and are not part of this
  backup — only the database (register, users, transmittals, folders).
- Restoring rolls back everything to the snapshot time, including users
  and acknowledgment tokens issued after it.
