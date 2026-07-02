# Automated Database Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily gzipped snapshots of `dms.db` uploaded to a private R2 bucket with 30-day retention, plus a Director-only status endpoint.

**Architecture:** New dependency-injected module `dms-backend/backup.js` (snapshot via better-sqlite3's online `db.backup()`, gzip via `zlib`, upload/prune via the existing S3 client). server.js wires it in at boot and exposes `GET /api/admin/backup-status`. No new npm dependencies.

**Tech Stack:** Node.js, Express, better-sqlite3, `@aws-sdk/client-s3` (already installed), Jest + Supertest (already installed).

**Spec:** `docs/superpowers/specs/2026-07-03-db-backups-design.md`

**Conventions to follow** (from existing code):
- CommonJS (`require`/`module.exports`).
- Log style: emoji prefixes — `💾` backups, `❌` errors, `⚠️` warnings, `🗑️` deletions.
- Tests live in `dms-backend/__tests__/`, run with `npm test` (jest `--forceExit --detectOpenHandles`).
- All commands below run from `dms-backend/` unless stated otherwise.

---

### Task 1: Pure helpers — `backupKey()` and `msUntilNextRun()`

**Files:**
- Create: `dms-backend/backup.js`
- Create: `dms-backend/__tests__/backup.test.js`

- [ ] **Step 1: Write the failing tests**

Create `dms-backend/__tests__/backup.test.js`:

```js
const fs = require('fs');
const { backupKey, msUntilNextRun } = require('../backup');

describe('backupKey', () => {
  it('formats key as backups/dms-<ISO stamp>Z.db.gz with no colons', () => {
    const key = backupKey(new Date('2026-07-03T22:00:00.000Z'));
    expect(key).toBe('backups/dms-2026-07-03T22-00-00Z.db.gz');
  });
});

describe('msUntilNextRun', () => {
  it('targets 22:00 UTC today when current time is before it', () => {
    const now = new Date('2026-07-03T10:00:00.000Z');
    expect(msUntilNextRun(now)).toBe(12 * 60 * 60 * 1000);
  });

  it('targets 22:00 UTC tomorrow when current time is past it', () => {
    const now = new Date('2026-07-03T23:00:00.000Z');
    expect(msUntilNextRun(now)).toBe(23 * 60 * 60 * 1000);
  });

  it('rolls to tomorrow when current time is exactly 22:00 UTC', () => {
    const now = new Date('2026-07-03T22:00:00.000Z');
    expect(msUntilNextRun(now)).toBe(24 * 60 * 60 * 1000);
  });
});
```

(The `fs` import is unused for now — later tasks in this file use it. Leave it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/backup.test.js -v`
Expected: FAIL — `Cannot find module '../backup'`

- [ ] **Step 3: Write minimal implementation**

Create `dms-backend/backup.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/backup.test.js -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backup.js __tests__/backup.test.js
git commit -m "feat(backup): key naming and daily 22:00 UTC schedule helpers"
```

---

### Task 2: `runBackup()` — snapshot, gzip, upload, cleanup, error capture

**Files:**
- Modify: `dms-backend/backup.js`
- Modify: `dms-backend/__tests__/backup.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `dms-backend/__tests__/backup.test.js`:

```js
const { runBackup } = require('../backup');

/* Fake better-sqlite3 db: online backup writes a snapshot file */
function makeFakeDb() {
  return { backup: jest.fn(async (dest) => fs.writeFileSync(dest, 'fake-sqlite-content')) };
}

/* Fake S3 client: routes by command class name, records calls */
function makeFakeR2(overrides = {}) {
  return {
    send: jest.fn(async (cmd) => {
      const name = cmd.constructor.name;
      if (overrides[name]) return overrides[name](cmd);
      if (name === 'ListObjectsV2Command') return { Contents: [] };
      return {};
    }),
  };
}

describe('runBackup', () => {
  it('snapshots the db, gzips, and uploads to the backup bucket', async () => {
    const db = makeFakeDb();
    const r2 = makeFakeR2();
    const result = await runBackup({ db, r2, bucket: 'dms-backups' });

    expect(db.backup).toHaveBeenCalledTimes(1);
    const put = r2.send.mock.calls
      .map(([cmd]) => cmd)
      .find((cmd) => cmd.constructor.name === 'PutObjectCommand');
    expect(put).toBeDefined();
    expect(put.input.Bucket).toBe('dms-backups');
    expect(put.input.Key).toMatch(/^backups\/dms-.*\.db\.gz$/);
    expect(put.input.ContentType).toBe('application/gzip');
    expect(result.key).toBe(put.input.Key);
    expect(result.error).toBeNull();
  });

  it('removes the temp snapshot file after a successful run', async () => {
    const db = makeFakeDb();
    await runBackup({ db, r2: makeFakeR2(), bucket: 'dms-backups' });
    const tmpFile = db.backup.mock.calls[0][0];
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('captures upload failure without throwing and still removes the temp file', async () => {
    const db = makeFakeDb();
    const r2 = makeFakeR2({
      PutObjectCommand: () => { throw new Error('R2 unreachable'); },
    });
    const result = await runBackup({ db, r2, bucket: 'dms-backups' });
    expect(result.error).toBe('R2 unreachable');
    const tmpFile = db.backup.mock.calls[0][0];
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('is a no-op when bucket is not configured', async () => {
    const db = makeFakeDb();
    const result = await runBackup({ db, r2: makeFakeR2(), bucket: undefined });
    expect(db.backup).not.toHaveBeenCalled();
    expect(result.error).toBe('not configured');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/backup.test.js -v`
Expected: FAIL — `runBackup is not a function`

- [ ] **Step 3: Write the implementation**

In `dms-backend/backup.js`, add after `msUntilNextRun` (before `module.exports`):

```js
/* Last failure message since boot — surfaced by getBackupStatus */
let lastError = null;

/* One backup cycle: snapshot → gzip → upload → prune. Never throws —
   a failed backup must never take down the server. Returns
   { key, error } so callers/tests can inspect the outcome. */
async function runBackup({ db, r2, bucket }) {
  if (!r2 || !bucket) return { key: null, error: 'not configured' };
  const tmpFile = path.join(os.tmpdir(), `dms-backup-${Date.now()}.db`);
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
```

Update the exports line:

```js
module.exports = { backupKey, msUntilNextRun, runBackup, RETENTION_DAYS, BACKUP_PREFIX };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/backup.test.js -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add backup.js __tests__/backup.test.js
git commit -m "feat(backup): runBackup — online snapshot, gzip, R2 upload, error capture"
```

---

### Task 3: Retention pruning behavior

**Files:**
- Modify: `dms-backend/__tests__/backup.test.js` (tests only — `pruneOldBackups` was implemented in Task 2; this task pins its behavior)

- [ ] **Step 1: Write the tests**

Append to `dms-backend/__tests__/backup.test.js`:

```js
describe('retention pruning (via runBackup)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('deletes only backups older than 30 days', async () => {
    const oldKey    = 'backups/dms-old.db.gz';
    const recentKey = 'backups/dms-recent.db.gz';
    const r2 = makeFakeR2({
      ListObjectsV2Command: () => ({
        Contents: [
          { Key: oldKey,    LastModified: new Date(Date.now() - 31 * DAY), Size: 100 },
          { Key: recentKey, LastModified: new Date(Date.now() - 5 * DAY),  Size: 100 },
        ],
      }),
    });
    await runBackup({ db: makeFakeDb(), r2, bucket: 'dms-backups' });

    const deletedKeys = r2.send.mock.calls
      .map(([cmd]) => cmd)
      .filter((cmd) => cmd.constructor.name === 'DeleteObjectCommand')
      .map((cmd) => cmd.input.Key);
    expect(deletedKeys).toEqual([oldKey]);
  });

  it('prune failure does not fail the backup', async () => {
    const r2 = makeFakeR2({
      ListObjectsV2Command: () => { throw new Error('list failed'); },
    });
    const result = await runBackup({ db: makeFakeDb(), r2, bucket: 'dms-backups' });
    expect(result.error).toBeNull(); // upload succeeded; prune failure is non-fatal
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/backup.test.js -v`
Expected: PASS (10 tests). If either new test fails, the Task 2 implementation has a bug — fix `pruneOldBackups` (cutoff comparison or the try/catch around it), not the tests.

- [ ] **Step 3: Commit**

```bash
git add __tests__/backup.test.js
git commit -m "test(backup): pin 30-day prune selection and non-fatal prune failure"
```

---

### Task 4: `getBackupStatus()`

**Files:**
- Modify: `dms-backend/backup.js`
- Modify: `dms-backend/__tests__/backup.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `dms-backend/__tests__/backup.test.js`:

```js
const { getBackupStatus } = require('../backup');

describe('getBackupStatus', () => {
  it('reports configured:false when bucket is missing', async () => {
    const status = await getBackupStatus({ r2: makeFakeR2(), bucket: undefined });
    expect(status).toEqual({ configured: false });
  });

  it('reports count and newest backup from the bucket listing', async () => {
    const r2 = makeFakeR2({
      ListObjectsV2Command: () => ({
        Contents: [
          { Key: 'backups/dms-a.db.gz', LastModified: new Date('2026-07-01T22:00:00Z'), Size: 111 },
          { Key: 'backups/dms-b.db.gz', LastModified: new Date('2026-07-02T22:00:00Z'), Size: 222 },
        ],
      }),
    });
    const status = await getBackupStatus({ r2, bucket: 'dms-backups' });
    expect(status.configured).toBe(true);
    expect(status.count).toBe(2);
    expect(status.latestBackup).toEqual({
      key: 'backups/dms-b.db.gz',
      sizeBytes: 222,
      lastModified: '2026-07-02T22:00:00.000Z',
    });
  });

  it('reports null latestBackup for an empty bucket', async () => {
    const status = await getBackupStatus({ r2: makeFakeR2(), bucket: 'dms-backups' });
    expect(status.count).toBe(0);
    expect(status.latestBackup).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/backup.test.js -v`
Expected: FAIL — `getBackupStatus is not a function`

- [ ] **Step 3: Write the implementation**

In `dms-backend/backup.js`, add after `pruneOldBackups`:

```js
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
```

Update the exports line:

```js
module.exports = { backupKey, msUntilNextRun, runBackup, getBackupStatus, RETENTION_DAYS, BACKUP_PREFIX };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/backup.test.js -v`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add backup.js __tests__/backup.test.js
git commit -m "feat(backup): getBackupStatus — count, newest backup, lastError"
```

---

### Task 5: `startBackupScheduler()` — catch-up on boot + daily timer

**Files:**
- Modify: `dms-backend/backup.js`
- Modify: `dms-backend/__tests__/backup.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `dms-backend/__tests__/backup.test.js`:

```js
const { startBackupScheduler } = require('../backup');

function putCalls(r2) {
  return r2.send.mock.calls
    .map(([cmd]) => cmd)
    .filter((cmd) => cmd.constructor.name === 'PutObjectCommand');
}

describe('startBackupScheduler', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('does nothing when bucket is not configured', async () => {
    const db = makeFakeDb();
    await startBackupScheduler({ db, r2: null, bucket: undefined });
    expect(db.backup).not.toHaveBeenCalled();
  });

  it('runs a catch-up backup when the bucket is empty', async () => {
    const r2 = makeFakeR2(); // lists no Contents
    await startBackupScheduler({ db: makeFakeDb(), r2, bucket: 'dms-backups' });
    expect(putCalls(r2)).toHaveLength(1);
  });

  it('runs a catch-up backup when the newest backup is older than 24h', async () => {
    const r2 = makeFakeR2({
      ListObjectsV2Command: () => ({
        Contents: [{ Key: 'backups/dms-x.db.gz', LastModified: new Date(Date.now() - 2 * DAY), Size: 1 }],
      }),
    });
    await startBackupScheduler({ db: makeFakeDb(), r2, bucket: 'dms-backups' });
    expect(putCalls(r2)).toHaveLength(1);
  });

  it('skips catch-up when the newest backup is fresh', async () => {
    const r2 = makeFakeR2({
      ListObjectsV2Command: () => ({
        Contents: [{ Key: 'backups/dms-x.db.gz', LastModified: new Date(Date.now() - 60 * 60 * 1000), Size: 1 }],
      }),
    });
    await startBackupScheduler({ db: makeFakeDb(), r2, bucket: 'dms-backups' });
    expect(putCalls(r2)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/backup.test.js -v`
Expected: FAIL — `startBackupScheduler is not a function`

- [ ] **Step 3: Write the implementation**

In `dms-backend/backup.js`, add after `getBackupStatus`:

```js
/* Called once from server.js at boot. Catch-up covers deploys/restarts
   that skipped a 2 a.m. slot, then a self-re-arming timer takes over. */
async function startBackupScheduler(deps) {
  if (!deps.r2 || !deps.bucket) {
    console.log('💾 DB backups disabled — set R2_BACKUP_BUCKET to enable');
    return;
  }
  console.log(`💾 Daily DB backups → bucket "${deps.bucket}" at 02:00 Asia/Dubai (22:00 UTC), ${RETENTION_DAYS}-day retention`);
  try {
    const { latest } = await findLatestBackup(deps);
    const staleMs = 24 * 60 * 60 * 1000;
    if (!latest || Date.now() - latest.LastModified.getTime() > staleMs) {
      console.log('💾 No backup in the last 24h — running catch-up backup now');
      await runBackup(deps);
    }
  } catch (err) {
    lastError = err.message;
    console.error(`❌ Backup catch-up check failed: ${err.message}`);
  }
  scheduleNextRun(deps);
}

function scheduleNextRun(deps) {
  const timer = setTimeout(async () => {
    await runBackup(deps);
    scheduleNextRun(deps);
  }, msUntilNextRun());
  timer.unref(); // never hold the process open (clean test/shutdown exit)
}
```

Update the exports line:

```js
module.exports = {
  backupKey, msUntilNextRun, runBackup, getBackupStatus, startBackupScheduler,
  RETENTION_DAYS, BACKUP_PREFIX,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/backup.test.js -v`
Expected: PASS (17 tests)

- [ ] **Step 5: Run the full suite to check nothing else broke**

Run: `npm test`
Expected: PASS (backup.test.js + api.test.js)

- [ ] **Step 6: Commit**

```bash
git add backup.js __tests__/backup.test.js
git commit -m "feat(backup): boot-time catch-up and self-re-arming daily scheduler"
```

---

### Task 6: Wire into server.js — config, boot, status endpoint

**Files:**
- Modify: `dms-backend/server.js` (four small edits: ~line 47 config, ~line 58 startup log, ~line 483 route, ~line 1562 boot — line numbers are pre-edit)
- Modify: `dms-backend/__tests__/api.test.js`

- [ ] **Step 1: Write the failing endpoint tests**

Append to `dms-backend/__tests__/api.test.js` (before the final closing of the file; it uses the existing `directorToken`/`teamToken` from `beforeAll`):

```js
describe('GET /api/admin/backup-status', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/backup-status');
    expect(res.status).toBe(401);
  });

  it('rejects non-Director roles', async () => {
    const res = await request(app)
      .get('/api/admin/backup-status')
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(403);
  });

  it('reports configured:false for Director when R2_BACKUP_BUCKET is unset', async () => {
    const res = await request(app)
      .get('/api/admin/backup-status')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api.test.js -v`
Expected: the three new tests FAIL with 404s where 401/403/200 are expected (route doesn't exist yet; unauthenticated 404 vs 401 depends on gate order — after Step 3 all three must pass as written).

- [ ] **Step 3: Wire up server.js**

Edit 1 — config constant. In the R2 config block (after line 46, `const R2_SECRET = ...`), add:

```js
const R2_BACKUP_BUCKET   = process.env.R2_BACKUP_BUCKET; // private bucket for DB backups
```

Edit 2 — startup log. Inside the `=== DrawVault Storage Configuration ===` block, after the `Storage mode` line (line 58), add:

```js
console.log(`  R2_BACKUP_BUCKET      : ${process.env.R2_BACKUP_BUCKET ? '✅ set' : '❌ NOT SET — DB backups disabled'}`);
```

Edit 3 — require + route. Near the other requires at the top (after line 16, `const helmet = ...`):

```js
const { startBackupScheduler, getBackupStatus } = require('./backup');
```

Then add the route directly after the `GET /api/health` handler (it sits behind the `/api` verifyToken gate at line 475, so only `requireDirector` is needed here):

```js
/* ── GET /api/admin/backup-status — Director-only backup monitoring ─ */
app.get('/api/admin/backup-status', requireDirector, async (req, res) => {
  try {
    res.json(await getBackupStatus({ r2, bucket: R2_BACKUP_BUCKET }));
  } catch (err) {
    console.error('❌ Backup status failed:', err.message);
    res.status(500).json({ error: 'Failed to read backup status.' });
  }
});
```

Edit 4 — boot. In the start block at the bottom (line 1561), start the scheduler alongside `app.listen`:

```js
/* ── Start ──────────────────────────────────────────────────────── */
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 DMS Backend running → http://localhost:${PORT}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
  });
  startBackupScheduler({ db, r2, bucket: R2_BACKUP_BUCKET }); // fire-and-forget; logs its own status
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all api.test.js tests (including the 3 new ones) and all 17 backup.test.js tests.

- [ ] **Step 5: Boot the server locally as a smoke test**

Run: `node server.js` (Ctrl-C after boot; local `.env` has no `R2_BACKUP_BUCKET`)
Expected in output: `R2_BACKUP_BUCKET      : ❌ NOT SET — DB backups disabled` and `💾 DB backups disabled — set R2_BACKUP_BUCKET to enable`. Server must start normally.

- [ ] **Step 6: Commit**

```bash
git add server.js __tests__/api.test.js
git commit -m "feat(backup): wire daily backup scheduler + Director-only status endpoint"
```

---

### Task 7: Restore runbook + docs

**Files:**
- Create: `docs/RESTORE.md` (repo root `docs/`, not `dms-backend/`)
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Write the restore runbook**

Create `docs/RESTORE.md`:

```markdown
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
```

- [ ] **Step 2: Document the env var and endpoint in CLAUDE.md**

In `CLAUDE.md`:

a. In the **Railway (backend)** env var block (after `R2_SECRET_ACCESS_KEY`), add:

```
R2_BACKUP_BUCKET     # Private R2 bucket for daily DB backups (backups disabled if unset)
```

b. In the **Key backend API endpoints** section, add a new subsection after "Users":

```markdown
### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/admin/backup-status` | Director | Backup health: newest backup, count, last error. Daily DB backup to private R2 bucket at 02:00 Dubai, 30-day retention. Restore: see `docs/RESTORE.md` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/RESTORE.md CLAUDE.md
git commit -m "docs(backup): restore runbook + env var and endpoint documentation"
```

---

### Task 8: Manual end-to-end verification against real R2 (requires user)

**Files:** none (verification only)

This task needs the user to create the private bucket — pause here and ask them.

- [ ] **Step 1: User creates the private bucket**

Ask the user to: Cloudflare dashboard → R2 → Create bucket → name `dms-backups` (or similar) → **do not enable public access**. The existing R2 API token already covers it if it was scoped account-wide; if it was scoped to the old bucket only, they must widen the token or issue a new one.

- [ ] **Step 2: Run one real backup locally**

In `dms-backend/.env`, temporarily add `R2_BACKUP_BUCKET=<bucket name>` (the other R2 vars are already there). Then:

```bash
node -e "
require('dotenv').config();
const Database = require('better-sqlite3');
const { S3Client } = require('@aws-sdk/client-s3');
const { runBackup } = require('./backup');
const r2 = new S3Client({
  region: 'auto',
  endpoint: \`https://\${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const db = new Database(process.env.DB_PATH || 'dms.db');
runBackup({ db, r2, bucket: process.env.R2_BACKUP_BUCKET }).then(r => { console.log(r); db.close(); });
"
```

Expected: `💾 Backup uploaded: backups/dms-...db.gz (<n> bytes)` and `{ key: 'backups/...', error: null }`.

- [ ] **Step 3: Verify round-trip integrity**

Download the object from the Cloudflare dashboard, then:

```bash
gunzip -k dms-<timestamp>.db.gz
sqlite3 dms-<timestamp>.db "PRAGMA integrity_check;"
```

Expected: `ok`.

- [ ] **Step 4: Deploy**

Set `R2_BACKUP_BUCKET` in Railway env vars, push `main`, and after the deploy check Railway logs for `💾 Daily DB backups → bucket ...` followed by either the catch-up backup line or (subsequent boots) nothing until 22:00 UTC. Hit `/api/admin/backup-status` with a Director token and confirm `latestBackup` is populated.

- [ ] **Step 5: Remove the temporary local env var**

Remove `R2_BACKUP_BUCKET` from the local `.env` if the user doesn't want local runs backing up to the production bucket (recommended: remove it).
