const fs = require('fs');
const { backupKey, msUntilNextRun, runBackup } = require('../backup');

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
