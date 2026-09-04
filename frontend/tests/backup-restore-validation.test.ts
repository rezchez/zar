import { describe, expect, it } from 'bun:test';

import {
  createDatabaseBackup,
  deleteDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackupFromContent,
  validateBackupFileContent,
} from '../lib/backup-service';

describe('Backup Format Validation & File Restore Tests', () => {
  it('rejects empty or whitespace content', () => {
    const res1 = validateBackupFileContent('');
    expect(res1.valid).toBeFalse();
    expect(res1.error).toContain('خالی');

    const res2 = validateBackupFileContent('   \n  ');
    expect(res2.valid).toBeFalse();
  });

  it('rejects malformed non-JSON content', () => {
    const res = validateBackupFileContent('{ invalid: json ,,, }');
    expect(res.valid).toBeFalse();
    expect(res.error).toContain('JSON');
  });

  it('rejects JSON with non-object root or missing databaseType', () => {
    const resArray = validateBackupFileContent(JSON.stringify([1, 2, 3]));
    expect(resArray.valid).toBeFalse();

    const resWrongDb = validateBackupFileContent(
      JSON.stringify({
        databaseType: 'PostgreSQL',
        data: { collections: { customers: [] } },
      }),
    );
    expect(resWrongDb.valid).toBeFalse();
    expect(resWrongDb.error).toContain('PocketBase');
  });

  it('rejects JSON missing data or collections object', () => {
    const resNoData = validateBackupFileContent(
      JSON.stringify({
        databaseType: 'PocketBase',
      }),
    );
    expect(resNoData.valid).toBeFalse();
    expect(resNoData.error).toContain('data');

    const resNoCollections = validateBackupFileContent(
      JSON.stringify({
        databaseType: 'PocketBase',
        data: {},
      }),
    );
    expect(resNoCollections.valid).toBeFalse();
    expect(resNoCollections.error).toContain('collections');
  });

  it('rejects backup with empty collections or non-array collections', () => {
    const resEmpty = validateBackupFileContent(
      JSON.stringify({
        databaseType: 'PocketBase',
        data: { collections: {} },
      }),
    );
    expect(resEmpty.valid).toBeFalse();
    expect(resEmpty.error).toContain('فاقد');

    const resNonArray = validateBackupFileContent(
      JSON.stringify({
        databaseType: 'PocketBase',
        data: {
          collections: {
            customers: 'not-an-array',
          },
        },
      }),
    );
    expect(resNonArray.valid).toBeFalse();
    expect(resNonArray.error).toContain('آرایه‌ای');
  });

  it('validates a correct Zarfolio backup structure accurately', () => {
    const validPayload = {
      backupId: 'manual_backup_1405_test',
      createdAt: new Date().toISOString(),
      applicationVersion: '0.1.0',
      databaseType: 'PocketBase',
      schemaVersion: '1.0',
      note: 'پشتیبان آزمایشی تست',
      data: {
        collections: {
          customers: [
            { id: 'rec_c1', name: 'طرف‌حساب تستی ۱' },
            { id: 'rec_c2', name: 'طرف‌حساب تستی ۲' },
          ],
          cash_funds: [
            { id: 'rec_f1', currency_name: 'IRT' },
          ],
        },
      },
    };

    const res = validateBackupFileContent(JSON.stringify(validPayload));
    expect(res.valid).toBeTrue();
    expect(res.parsedData).toBeDefined();
    expect(res.parsedData?.collectionsCount).toBe(2);
    expect(res.parsedData?.totalRecordsCount).toBe(3);
    expect(res.parsedData?.collectionsSummary.customers).toBe(2);
    expect(res.parsedData?.collectionsSummary.cash_funds).toBe(1);
    expect(res.parsedData?.backupId).toBe('manual_backup_1405_test');
  });

  it('successfully restores valid backup from content and generates emergency backup', async () => {
    const backupContent = {
      backupId: `test_file_restore_${Date.now()}`,
      createdAt: new Date().toISOString(),
      applicationVersion: '0.1.0',
      databaseType: 'PocketBase',
      schemaVersion: '1.0',
      note: 'آزمون بازیابی از فایل محتوا',
      data: {
        collections: {
          currencies: [
            { id: 'curr_test_1', code: 'USD', name: 'دلار تست' },
          ],
        },
      },
    };

    const result = await restoreDatabaseBackupFromContent(JSON.stringify(backupContent), {
      note: 'یادداشت تست بازیابی',
    });

    expect(result.success).toBeTrue();
    expect(result.backupId).toBeDefined();
    expect(result.emergencyBackupId).toBeDefined();
    expect(result.restoredCollectionsCount).toBe(1);
    expect(result.totalRestoredRecords).toBe(1);

    // Verify it was added to database backups list
    const backups = await listDatabaseBackups();
    const importedFound = backups.find((b) => b.backupId === result.backupId);
    expect(importedFound).toBeDefined();

    // Clean up test backup
    if (result.backupId) {
      await deleteDatabaseBackup(result.backupId);
    }
    if (result.emergencyBackupId) {
      await deleteDatabaseBackup(result.emergencyBackupId);
    }
  });

  describe('API Route Handlers: validate-file & restore-file', () => {
    it('POST /api/admin/backups/validate-file enforces auth & role', async () => {
      const { POST: validateHandler } = await import('../app/api/admin/backups/validate-file/route');
      const { setMockAuthUser } = await import('./setup');

      // 1. Unauthenticated -> 401
      setMockAuthUser(null);
      const req1 = new Request('http://localhost:3000/api/admin/backups/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: '{}' }),
      });
      const res1 = await validateHandler(req1);
      expect(res1.status).toBe(401);

      // 2. Regular user -> 403
      setMockAuthUser({
        id: 'u1',
        name: 'کاربر معمولی',
        email: 'user@zar.ir',
        role: 'user',
        status: 'active',
      });
      const req2 = new Request('http://localhost:3000/api/admin/backups/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: '{}' }),
      });
      const res2 = await validateHandler(req2);
      expect(res2.status).toBe(403);

      // 3. Admin with invalid payload -> 400 with error
      setMockAuthUser({
        id: 'admin1',
        name: 'مدیر کل',
        email: 'admin@zar.ir',
        role: 'admin',
        status: 'active',
      });
      const req3 = new Request('http://localhost:3000/api/admin/backups/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: 'invalid-json' }),
      });
      const res3 = await validateHandler(req3);
      expect(res3.status).toBe(400);
      const body3 = await res3.json();
      expect(body3.success).toBeFalse();
      expect(body3.error).toBeDefined();

      // 4. Admin with valid payload -> 200 with preview
      const validContent = JSON.stringify({
        backupId: 'backup_preview_test',
        databaseType: 'PocketBase',
        data: {
          collections: {
            customers: [{ id: 'c1', name: 'تست' }],
          },
        },
      });
      const req4 = new Request('http://localhost:3000/api/admin/backups/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: validContent }),
      });
      const res4 = await validateHandler(req4);
      expect(res4.status).toBe(200);
      const body4 = await res4.json();
      expect(body4.success).toBeTrue();
      expect(body4.valid).toBeTrue();
      expect(body4.preview.collectionsCount).toBe(1);
      expect(body4.preview.totalRecordsCount).toBe(1);
    });

    it('POST /api/admin/backups/restore-file restores database from file', async () => {
      const { POST: restoreHandler } = await import('../app/api/admin/backups/restore-file/route');
      const { setMockAuthUser } = await import('./setup');

      setMockAuthUser({
        id: 'admin1',
        name: 'مدیر کل',
        email: 'admin@zar.ir',
        role: 'admin',
        status: 'active',
      });

      const validContent = JSON.stringify({
        backupId: `restore_route_test_${Date.now()}`,
        databaseType: 'PocketBase',
        data: {
          collections: {
            currencies: [{ id: 'c_usd', code: 'USD' }],
          },
        },
      });

      const req = new Request('http://localhost:3000/api/admin/backups/restore-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: validContent, note: 'تست روت بازیابی' }),
      });

      const res = await restoreHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBeTrue();
      expect(body.backupId).toBeDefined();
      expect(body.emergencyBackupId).toBeDefined();

      // Clean up
      if (body.backupId) {
        await deleteDatabaseBackup(body.backupId);
      }
      if (body.emergencyBackupId) {
        await deleteDatabaseBackup(body.emergencyBackupId);
      }
    });
  });
});
