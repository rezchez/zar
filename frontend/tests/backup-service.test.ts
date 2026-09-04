import { describe, expect, it } from 'bun:test';

import {
  calculateChecksum,
  createDatabaseBackup,
  deleteDatabaseBackup,
  listDatabaseBackups,
  validateDatabaseBackup,
} from '../lib/backup-service';

describe('Database Backup & Restore Service Tests', () => {
  it('calculates SHA-256 checksum correctly', () => {
    const buffer = Buffer.from('Zarfolio-Test-Database-Backup', 'utf-8');
    const hash = calculateChecksum(buffer);
    expect(hash).toBeString();
    expect(hash.length).toBe(64); // SHA-256 hex length
  });

  it('creates, lists, validates, and deletes a database backup package', async () => {
    // 1. Create Backup
    const meta = await createDatabaseBackup({
      note: 'تست ایزوله سرویس پشتیبان‌گیری',
    });

    expect(meta.backupId).toBeString();
    expect(meta.checksum).toBeString();
    expect(meta.checksum.length).toBe(64);
    expect(meta.status).toBe('valid');
    expect(meta.size).toBeGreaterThan(0);

    // 2. List Backups
    const backups = await listDatabaseBackups();
    const found = backups.find((b) => b.backupId === meta.backupId);
    expect(found).toBeDefined();
    expect(found?.backupId).toBe(meta.backupId);

    // 3. Validate Integrity
    const validation = await validateDatabaseBackup(meta.backupId);
    expect(validation.valid).toBeTrue();
    expect(validation.metadata?.status).toBe('valid');

    // 4. Delete Backup
    const deleted = await deleteDatabaseBackup(meta.backupId);
    expect(deleted).toBeTrue();

    const afterDelete = await listDatabaseBackups();
    expect(afterDelete.find((b) => b.backupId === meta.backupId)).toBeUndefined();
  });
});
