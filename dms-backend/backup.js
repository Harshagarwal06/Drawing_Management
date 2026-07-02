/* ── Automated DB backups to a private R2 bucket ─────────────────────
   Daily snapshot of dms.db → gzip → R2_BACKUP_BUCKET, 30-day retention.
   Spec: docs/superpowers/specs/2026-07-03-db-backups-design.md          */
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const zlib = require('zlib');
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

module.exports = { backupKey, msUntilNextRun, RETENTION_DAYS, BACKUP_PREFIX };
