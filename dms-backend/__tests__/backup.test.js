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
