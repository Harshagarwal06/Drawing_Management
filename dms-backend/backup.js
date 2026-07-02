/* ── Automated DB backups to a private R2 bucket ─────────────────────
   Daily snapshot of dms.db → gzip → R2_BACKUP_BUCKET, 30-day retention.
   Spec: docs/superpowers/specs/2026-07-03-db-backups-design.md          */
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const zlib   = require('zlib');
const crypto = require('crypto');
const { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const RETENTION_DAYS     = 30;
const BACKUP_PREFIX      = 'backups/';
const DAILY_RUN_UTC_HOUR = 22; // 02:00 Asia/Dubai (fixed UTC+4, no DST)

/* backups/dms-2026-07-03T22-00-00Z.db.gz — colons are invalid in some
   S3 tooling, so the time portion uses dashes */
function backupKey(now = new Date()) {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-') + 'Z';
  return `${BACKUP_PREFIX}dms-${stamp}.db.gz`;
}

function msUntilNextRun(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(DAILY_RUN_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/* Last failure message since boot — surfaced by getBackupStatus */
let lastError = null;

/* One backup cycle: snapshot → gzip → upload → prune. Never throws —
   a failed backup must never take down the server. Returns
   { key, error } so callers/tests can inspect the outcome. */
async function runBackup({ db, r2, bucket }) {
  if (!r2 || !bucket) return { key: null, error: 'not configured' };
  const tmpFile = path.join(os.tmpdir(), `dms-backup-${crypto.randomUUID()}.db`);
  try {
    await db.backup(tmpFile); // better-sqlite3 online backup — safe while serving requests
    const gz  = zlib.gzipSync(fs.readFileSync(tmpFile));
    const key = backupKey();
    await r2.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: gz, ContentType: 'application/gzip',
    }));
    console.log(`💾 Backup uploaded: ${key} (${gz.length} bytes)`);
    lastError = null;
    await pruneOldBackups({ r2, bucket });
    return { key, error: null };
  } catch (err) {
    lastError = err.message;
    console.error(`❌ Backup failed: ${err.message}`);
    return { key: null, error: err.message };
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

/* Delete backups older than RETENTION_DAYS. Failures are non-fatal —
   an extra old file beats a missing new one. */
async function pruneOldBackups({ r2, bucket }) {
  try {
    const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX }));
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const stale  = (listed.Contents || []).filter((o) => o.LastModified.getTime() < cutoff);
    for (const obj of stale) {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      console.log(`🗑️  Pruned old backup: ${obj.Key}`);
    }
  } catch (err) {
    console.warn(`⚠️  Backup prune failed: ${err.message}`);
  }
}

/* Newest object under backups/, or null. Listing the bucket (rather than
   in-memory state) keeps this correct across restarts. */
async function findLatestBackup({ r2, bucket }) {
  const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX }));
  const objs = listed.Contents || [];
  if (objs.length === 0) return { latest: null, count: 0 };
  const latest = objs.reduce((a, b) => (a.LastModified > b.LastModified ? a : b));
  return { latest, count: objs.length };
}

async function getBackupStatus({ r2, bucket }) {
  if (!r2 || !bucket) return { configured: false };
  const { latest, count } = await findLatestBackup({ r2, bucket });
  return {
    configured: true,
    count,
    latestBackup: latest ? {
      key: latest.Key,
      sizeBytes: latest.Size,
      lastModified: latest.LastModified.toISOString(),
    } : null,
    lastError,
  };
}

module.exports = { backupKey, msUntilNextRun, runBackup, getBackupStatus, RETENTION_DAYS, BACKUP_PREFIX };
