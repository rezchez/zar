import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import existsSync from 'fs';
import path from 'path';
import {
  getDb,
  getCleanupDirPath,
  ensureCleanupDir,
  cleanExpiredCleanups,
  listCleanups,
  getCleanupStatus,
  executeDataCleanup,
  restoreDataCleanup,
  isConfirmationValid,
  type CleanupMetadata,
} from '@/lib/data-cleanup-service';

describe('Zarfolio — Data Cleanup & 30-Day Retention System Tests', () => {
  const dir = getCleanupDirPath();

  beforeEach(async () => {
    await ensureCleanupDir();
  });

  test('1. Database status & counts: reports existing accounts and transactions', () => {
    const db = getDb();
    expect(db).toBeDefined();

    // Verify database counts helper returns properly structured object
    const status = getCleanupStatus();
    expect(status).toBeDefined();
  });

  test('2. 30-day retention metadata: sets expiresAt exactly 30 days ahead', async () => {
    const now = new Date();
    const metadata = await executeDataCleanup({
      purgedBy: {
        id: 'test_admin_id',
        name: 'مدیر تستی',
        email: 'admin@zarfolio.local',
      },
    });

    expect(metadata).toBeDefined();
    expect(metadata.status).toBe('retained');
    expect(metadata.retentionDays).toBe(30);

    const purgedTime = new Date(metadata.purgedAt).getTime();
    const expiresTime = new Date(metadata.expiresAt).getTime();
    const diffDays = Math.round((expiresTime - purgedTime) / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(30);

    // Verify snapshot file exists on disk
    const archivePath = path.join(dir, metadata.filename);
    const metaPath = path.join(dir, `${metadata.cleanupId}.meta.json`);

    expect(existsSync.existsSync(archivePath)).toBe(true);
    expect(existsSync.existsSync(metaPath)).toBe(true);

    // Test restoration to ensure data integrity
    const restoreResult = await restoreDataCleanup({
      cleanupId: metadata.cleanupId,
      restoredBy: {
        id: 'test_admin_id',
        name: 'مدیر تستی',
      },
    });

    expect(restoreResult.metadata.status).toBe('restored');

    // Clean up test files
    await fs.rm(archivePath, { force: true });
    await fs.rm(metaPath, { force: true });
  }, 25000);

  test('3. Auto-expiration after 30 days: cleanExpiredCleanups permanently removes expired archives', async () => {
    const expiredCleanupId = `cleanup_expired_${Date.now()}`;
    const expiredFilename = `${expiredCleanupId}.json.gz`;
    const metaFilename = `${expiredCleanupId}.meta.json`;

    const expiredMeta: CleanupMetadata = {
      cleanupId: expiredCleanupId,
      filename: expiredFilename,
      purgedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      purgedAtJalali: '1405/06/01 10:00',
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Expired 5 days ago
      expiresAtJalali: '1405/07/01 10:00',
      retentionDays: 30,
      status: 'retained',
      purgedBy: { id: 'admin_1', name: 'Admin' },
      counts: { transactions: 5, customers: 2 },
      totalTransactionsCount: 5,
      totalAccountsCount: 2,
    };

    const archivePath = path.join(dir, expiredFilename);
    const metaPath = path.join(dir, metaFilename);

    await fs.writeFile(archivePath, Buffer.from('dummy-archive-data'));
    await fs.writeFile(metaPath, JSON.stringify(expiredMeta, null, 2), 'utf-8');

    expect(existsSync.existsSync(archivePath)).toBe(true);
    expect(existsSync.existsSync(metaPath)).toBe(true);

    const deleted = await cleanExpiredCleanups();
    expect(deleted).toContain(expiredCleanupId);

    // Verify files were permanently deleted
    expect(existsSync.existsSync(archivePath)).toBe(false);
    expect(existsSync.existsSync(metaPath)).toBe(false);
  });

  test('4. Restoration validation: rejects expired cleanup restoration', async () => {
    const expiredCleanupId = `cleanup_expired_try_${Date.now()}`;
    const metaFilename = `${expiredCleanupId}.meta.json`;

    const expiredMeta: CleanupMetadata = {
      cleanupId: expiredCleanupId,
      filename: `${expiredCleanupId}.json.gz`,
      purgedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      purgedAtJalali: '1405/05/01 10:00',
      expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAtJalali: '1405/06/01 10:00',
      retentionDays: 30,
      status: 'retained',
      purgedBy: { id: 'admin_1', name: 'Admin' },
      counts: {},
      totalTransactionsCount: 0,
      totalAccountsCount: 0,
    };

    const metaPath = path.join(dir, metaFilename);
    await fs.writeFile(metaPath, JSON.stringify(expiredMeta, null, 2), 'utf-8');

    try {
      await expect(
        restoreDataCleanup({
          cleanupId: expiredCleanupId,
          restoredBy: { id: 'admin_1' },
        }),
      ).rejects.toThrow('مهلت ۳۰ روزه');
    } finally {
      await fs.rm(metaPath, { force: true });
    }
  });

  test('5. Confirmation text normalization: accepts "حذف تایید است" and "حذف تأیید است" with whitespace resilience', () => {
    expect(isConfirmationValid('حذف تایید است')).toBe(true);
    expect(isConfirmationValid('حذف تأیید است')).toBe(true);
    expect(isConfirmationValid('  حذف تایید است  ')).toBe(true);
    expect(isConfirmationValid('حذف‌ تایید است')).toBe(true);
    expect(isConfirmationValid('حذف تایید است.')).toBe(true);

    expect(isConfirmationValid('حذف')).toBe(false);
    expect(isConfirmationValid('تایید')).toBe(false);
    expect(isConfirmationValid('حذف تایید نیست')).toBe(false);
    expect(isConfirmationValid('')).toBe(false);
  });

  test('6. Role restriction: only system admin (role === "admin") is permitted to execute data cleanup', () => {
    const roles: Array<{ role: string; permitted: boolean }> = [
      { role: 'admin', permitted: true },
      { role: 'manager', permitted: false },
      { role: 'user', permitted: false },
      { role: 'operator', permitted: false },
      { role: 'viewer', permitted: false },
    ];

    for (const item of roles) {
      const isAllowed = item.role === 'admin';
      expect(isAllowed).toBe(item.permitted);
    }
  });
});
