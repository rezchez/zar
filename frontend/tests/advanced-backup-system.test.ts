import { describe, expect, it } from 'bun:test';
import {
  createDatabaseBackup,
  deleteDatabaseBackup,
  listDatabaseBackups,
  validateDatabaseBackup,
  extractBackupPayload,
  unpackZarfolioContainer,
  generateJalaliBackupFilename,
  formatJalaliBackupTimestamp,
  restoreDatabaseBackup,
} from '../lib/backup-service';
import {
  calculateNextBackupTime,
  getDaysInJalaliMonth,
} from '../lib/backup-scheduler';
import { BaleBackupDestination } from '../lib/backup-destinations/bale-destination';
import { ArvanS3BackupDestination } from '../lib/backup-destinations/arvan-s3-destination';

describe('Advanced Backup System & Container Format Tests', () => {
  it('1. Generates correct Jalali timestamp and collision-resistant filename', () => {
    const fixedDate = new Date(Date.UTC(2026, 8, 16, 12, 30, 45)); // 1405-06-25 approx
    const info1 = generateJalaliBackupFilename({ date: fixedDate });
    const info2 = generateJalaliBackupFilename({ date: fixedDate });

    expect(info1.filename).toMatch(/^ZF-1405-06-25-[0-9]{2}-[0-9]{2}-[0-9]{2}-[a-f0-9]{4}\.zfb$/);
    expect(info1.filename.endsWith('.zfb')).toBeTrue();
    expect(info1.createdAtJalali).toContain('1405/06/25');
    // Ensure uniqueness even on exact same second
    expect(info1.filename).not.toBe(info2.filename);
  });

  it('2. Creates unencrypted .zfb backup container and validates container structure', async () => {
    const meta = await createDatabaseBackup({
      note: 'تست پشتیبان بدون رمز استاندارد ZFB',
      dispatchDestinations: false,
    });

    expect(meta.backupId).toBeString();
    expect(meta.filename.endsWith('.zfb')).toBeTrue();
    expect(meta.backupFormatVersion).toBe(1);
    expect(meta.compressionAlgorithm).toBe('gzip');
    expect(meta.encryptionEnabled).toBeFalse();
    expect(meta.status).toBe('valid');
    expect(meta.checksum).toBeString();

    const { buffer } = (await (await import('../lib/backup-service')).getBackupFileBuffer(meta.backupId))!;
    const unpacked = unpackZarfolioContainer(buffer);

    expect(unpacked.header.magic).toBe('ZARFOLIO_BACKUP');
    expect(unpacked.header.formatVersion).toBe(1);
    expect(unpacked.header.encryption.enabled).toBeFalse();
    expect(unpacked.header.compressionAlgorithm).toBe('gzip');

    // Clean up
    await deleteDatabaseBackup(meta.backupId);
  });

  it('3. Creates encrypted .zfb backup with AES-256-GCM and verifies password protection', async () => {
    const password = 'StrongPassword@1405';
    const meta = await createDatabaseBackup({
      note: 'تست پشتیبان رمزگذاری‌شده ZFB',
      password,
      dispatchDestinations: false,
    });

    expect(meta.encryptionEnabled).toBeTrue();
    expect(meta.status).toBe('valid');

    const { buffer } = (await (await import('../lib/backup-service')).getBackupFileBuffer(meta.backupId))!;
    const unpacked = unpackZarfolioContainer(buffer);

    expect(unpacked.header.encryption.enabled).toBeTrue();
    expect(unpacked.header.encryption.algorithm).toBe('aes-256-gcm');
    expect(unpacked.header.encryption.kdf).toBe('scrypt');
    expect(unpacked.header.encryption.salt).toBeDefined();
    expect(unpacked.header.encryption.authTag).toBeDefined();

    // Validation without password reports encrypted
    const validationNoPass = await validateDatabaseBackup(meta.backupId);
    expect(validationNoPass.isEncrypted).toBeTrue();

    // Extraction fails with wrong password
    let failedWrongPass = false;
    try {
      await extractBackupPayload(buffer, 'WrongPassword!');
    } catch {
      failedWrongPass = true;
    }
    expect(failedWrongPass).toBeTrue();

    // Extraction succeeds with correct password
    const extracted = await extractBackupPayload(buffer, password);
    expect(extracted.backupId).toBe(meta.backupId);
    expect(extracted.collectionsCount).toBeGreaterThanOrEqual(0);

    // Clean up
    await deleteDatabaseBackup(meta.backupId);
  });

  it('4. Rejects corrupted or tampered ZFB container', async () => {
    const meta = await createDatabaseBackup({
      note: 'تست فایل آسیب‌دیده',
      dispatchDestinations: false,
    });

    const { buffer } = (await (await import('../lib/backup-service')).getBackupFileBuffer(meta.backupId))!;
    
    // Tamper with payload byte
    const tamperedBuffer = Buffer.from(buffer);
    tamperedBuffer[tamperedBuffer.length - 5] ^= 0xff;

    let errorThrown = false;
    try {
      await extractBackupPayload(tamperedBuffer);
    } catch (err) {
      errorThrown = true;
      expect((err as Error).message).toContain('Checksum');
    }
    expect(errorThrown).toBeTrue();

    // Clean up
    await deleteDatabaseBackup(meta.backupId);
  });

  it('5. Scheduler: calculates interval, daily, weekly, and monthly next backup times accurately', () => {
    const baseTime = new Date('2026-09-16T10:00:00.000Z');

    // Interval (every 4 hours)
    const interval = calculateNextBackupTime({
      backupScheduleType: 'interval',
      backupScheduleIntervalHours: 4,
      backupScheduleTime: '10:00',
      backupScheduleDayOfWeek: 0,
      backupScheduleDayOfMonth: 1,
    }, baseTime);
    expect(interval.nextRunAt.getTime()).toBeGreaterThan(baseTime.getTime());
    expect((interval.nextRunAt.getTime() - baseTime.getTime()) / (1000 * 60 * 60)).toBeGreaterThanOrEqual(3.9);

    // Daily at 02:00
    const daily = calculateNextBackupTime({
      backupScheduleType: 'daily',
      backupScheduleTime: '02:00',
      backupScheduleDayOfWeek: 0,
      backupScheduleDayOfMonth: 1,
    }, baseTime);
    expect(daily.nextRunAt.getHours()).toBe(2);
    expect(daily.nextRunAt.getMinutes()).toBe(0);
    expect(daily.nextRunAt.getTime()).toBeGreaterThan(baseTime.getTime());

    // Weekly
    const weekly = calculateNextBackupTime({
      backupScheduleType: 'weekly',
      backupScheduleTime: '04:30',
      backupScheduleDayOfWeek: 0, // شنبه
      backupScheduleDayOfMonth: 1,
    }, baseTime);
    expect(weekly.nextRunAt.getTime()).toBeGreaterThan(baseTime.getTime());

    // Monthly with 31st day
    const monthly = calculateNextBackupTime({
      backupScheduleType: 'monthly',
      backupScheduleTime: '03:15',
      backupScheduleDayOfWeek: 0,
      backupScheduleDayOfMonth: 31,
    }, baseTime);
    expect(monthly.nextRunAt.getTime()).toBeGreaterThan(baseTime.getTime());
    expect(monthly.nextRunAtJalali).toBeDefined();

    // Month days function
    expect(getDaysInJalaliMonth(1405, 1)).toBe(31);
    expect(getDaysInJalaliMonth(1405, 7)).toBe(30);
  });

  it('6. Destinations: checks configuration guard for Bale and Arvan', async () => {
    // Bale unconfigured
    const unconfiguredBale = new BaleBackupDestination({ token: '', chatId: '' });
    expect(unconfiguredBale.isConfigured()).toBeFalse();
    const baleRes = await unconfiguredBale.upload({
      backupId: 'test',
      filename: 'test.zfb',
      buffer: Buffer.from('test'),
      size: 4,
      checksum: 'abc',
      createdAt: new Date().toISOString(),
      createdAtJalali: '1405/06/25',
      encryptionEnabled: false,
    });
    expect(baleRes.success).toBeFalse();
    expect(baleRes.error).toContain('تنظیمات بله');

    // Arvan unconfigured
    const unconfiguredArvan = new ArvanS3BackupDestination({
      endpoint: '',
      bucket: '',
      accessKey: '',
      secretKey: '',
    });
    expect(unconfiguredArvan.isConfigured()).toBeFalse();
    const arvanRes = await unconfiguredArvan.upload({
      backupId: 'test',
      filename: 'test.zfb',
      buffer: Buffer.from('test'),
      size: 4,
      checksum: 'abc',
      createdAt: new Date().toISOString(),
      createdAtJalali: '1405/06/25',
      encryptionEnabled: false,
    });
    expect(arvanRes.success).toBeFalse();
    expect(arvanRes.error).toContain('آروان');
  });
});
