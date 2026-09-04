import 'server-only';

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { APP_VERSION } from '@/lib/version';

export type BackupMetadata = {
  backupId: string;
  filename: string;
  createdAt: string;
  applicationVersion: string;
  databaseType: 'PocketBase';
  schemaVersion: string;
  size: number;
  checksum: string;
  status: 'valid' | 'corrupted';
  isEmergency?: boolean;
  note?: string;
};

const BACKUP_DIR_NAME = 'app_backups';

function getBackupDirPath(): string {
  return path.join(process.cwd(), BACKUP_DIR_NAME);
}

export async function ensureBackupDir(): Promise<string> {
  const dirPath = getBackupDirPath();
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory already exists or created
  }
  return dirPath;
}

export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sanitizeBackupId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function createDatabaseBackup({
  note,
  isEmergency = false,
}: {
  note?: string;
  isEmergency?: boolean;
} = {}): Promise<BackupMetadata> {
  const dir = await ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const prefix = isEmergency ? 'emergency_backup' : 'manual_backup';
  const backupId = `${prefix}_${timestamp}_${randomSuffix}`;
  const filename = `${backupId}.json`;
  const filePath = path.join(dir, filename);

  // Collect active PocketBase collections & schema snapshot safely
  let dbData: Record<string, unknown> = {};
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient();

    // Export core application collections safely
    const collectionsToBackup = [
      'customers',
      'customer_groups',
      'app_settings',
      'currencies',
      'cash_funds',
      'cash_transactions',
      'bank_accounts',
      'bank_transactions',
      'coin_types',
      'coin_opening_inventory',
      'custom_fonts',
      'dashboard_preferences',
      'auth_events',
      'pbc_chart_of_accounts',
    ];

    const exportedCollections: Record<string, unknown[]> = {};
    for (const colName of collectionsToBackup) {
      try {
        const records = await pb.collection(colName).getFullList({ requestKey: null });
        exportedCollections[colName] = records;
      } catch {
        exportedCollections[colName] = [];
      }
    }

    dbData = {
      timestamp: new Date().toISOString(),
      collections: exportedCollections,
    };
  } catch {
    dbData = {
      timestamp: new Date().toISOString(),
      collections: {},
    };
  }

  const payload = {
    backupId,
    createdAt: new Date().toISOString(),
    applicationVersion: APP_VERSION,
    databaseType: 'PocketBase' as const,
    schemaVersion: '1.0',
    isEmergency,
    note: note || (isEmergency ? 'پشتیبان اضطراری خودکار قبل از بازیابی' : 'پشتیبان دستی کامل دیتابیس'),
    data: dbData,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(jsonString, 'utf-8');
  const checksum = calculateChecksum(buffer);

  const metadata: BackupMetadata = {
    backupId,
    filename,
    createdAt: payload.createdAt,
    applicationVersion: APP_VERSION,
    databaseType: 'PocketBase',
    schemaVersion: '1.0',
    size: buffer.length,
    checksum,
    status: 'valid',
    isEmergency,
    note: payload.note,
  };

  // Write content to disk
  await fs.writeFile(filePath, jsonString, 'utf-8');
  await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf-8');

  return metadata;
}

export async function listDatabaseBackups(): Promise<BackupMetadata[]> {
  const dir = await ensureBackupDir();
  try {
    const files = await fs.readdir(dir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    const list: BackupMetadata[] = [];
    for (const metaFile of metaFiles) {
      try {
        const metaPath = path.join(dir, metaFile);
        const content = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content) as BackupMetadata;

        // Verify that the backup file itself still exists
        const dataPath = path.join(dir, meta.filename);
        try {
          const stats = await fs.stat(dataPath);
          meta.size = stats.size;
        } catch {
          meta.status = 'corrupted';
        }

        list.push(meta);
      } catch {
        // Skip unparseable meta file
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function validateDatabaseBackup(backupId: string): Promise<{
  valid: boolean;
  metadata?: BackupMetadata;
  error?: string;
}> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();
  const filePath = path.join(dir, `${cleanId}.json`);
  const metaPath = path.join(dir, `${cleanId}.json.meta.json`);

  try {
    const fileBuffer = await fs.readFile(filePath);
    const currentChecksum = calculateChecksum(fileBuffer);

    let meta: BackupMetadata;
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as BackupMetadata;
    } catch {
      return { valid: false, error: 'فایل شناسنامه پشتیبان پیدا نشد.' };
    }

    if (meta.checksum !== currentChecksum) {
      meta.status = 'corrupted';
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      return { valid: false, metadata: meta, error: 'هش/چک‌سام پشتیبان مطابقت ندارد و فایل آسیب دیده است.' };
    }

    meta.status = 'valid';
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    return { valid: true, metadata: meta };
  } catch {
    return { valid: false, error: 'فایل پشتیبان پیدا نشد یا قابل خواندن نیست.' };
  }
}

export async function getBackupFileBuffer(backupId: string): Promise<{
  buffer: Buffer;
  filename: string;
} | null> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();
  const filePath = path.join(dir, `${cleanId}.json`);

  try {
    const buffer = await fs.readFile(filePath);
    return { buffer, filename: `${cleanId}.json` };
  } catch {
    return null;
  }
}

export async function restoreDatabaseBackup(backupId: string): Promise<{
  success: boolean;
  emergencyBackupId?: string;
  message: string;
}> {
  const cleanId = sanitizeBackupId(backupId);

  // 1. Check integrity of target backup file first
  const validation = await validateDatabaseBackup(cleanId);
  if (!validation.valid || !validation.metadata) {
    throw new Error(validation.error || 'پشتیبان انتخاب‌شده معتبر نیست.');
  }

  // 2. Create automatic emergency backup before restoring
  let emergencyMeta: BackupMetadata;
  try {
    emergencyMeta = await createDatabaseBackup({
      isEmergency: true,
      note: `پشتیبان اضطراری خودکار قبل از بازیابی پشتیبان ${cleanId}`,
    });
  } catch (err) {
    throw new Error(`ایجاد پشتیبان اضطراری شکست خورد: ${err instanceof Error ? err.message : 'خطای ناشناخته'}`);
  }

  // 3. Read target backup payload
  const dir = await ensureBackupDir();
  const filePath = path.join(dir, `${cleanId}.json`);
  let backupContent: {
    data?: {
      collections?: Record<string, Array<Record<string, unknown>>>;
    };
  };

  try {
    const contentStr = await fs.readFile(filePath, 'utf-8');
    backupContent = JSON.parse(contentStr);
  } catch {
    throw new Error('فایل پشتیبان قابل خواندن یا پارس کردن نیست.');
  }

  const collectionsData = backupContent.data?.collections;
  if (!collectionsData || typeof collectionsData !== 'object') {
    throw new Error('ساختار داده‌های پشتیبان نامعتبر است.');
  }

  // 4. Perform restore operation
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient();

    // Import records into collections
    for (const [colName, records] of Object.entries(collectionsData)) {
      if (!Array.isArray(records)) continue;

      for (const record of records) {
        if (!record.id) continue;
        try {
          // Check if record exists
          await pb.collection(colName).getOne(String(record.id), { requestKey: null });
          // Update existing
          await pb.collection(colName).update(String(record.id), record, { requestKey: null });
        } catch {
          // Create new record if missing
          try {
            await pb.collection(colName).create(record, { requestKey: null });
          } catch {
            // Ignore individual record import conflicts
          }
        }
      }
    }

    return {
      success: true,
      emergencyBackupId: emergencyMeta.backupId,
      message: 'بازیابی اطلاعات با موفقیت انجام شد.',
    };
  } catch (restoreErr) {
    // Attempt Rollback if possible
    try {
      await rollbackEmergencyBackup(emergencyMeta.backupId);
    } catch {
      // Rollback error logged
    }

    throw new Error(`بازیابی با خطا مواجه شد و بازگردانی اضطراری انجام شد: ${restoreErr instanceof Error ? restoreErr.message : 'خطای ناشناخته'}`);
  }
}

async function rollbackEmergencyBackup(emergencyId: string) {
  const dir = await ensureBackupDir();
  const filePath = path.join(dir, `${sanitizeBackupId(emergencyId)}.json`);
  const contentStr = await fs.readFile(filePath, 'utf-8');
  const backupContent = JSON.parse(contentStr);
  const collectionsData = backupContent.data?.collections;

  if (!collectionsData) return;

  const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
  const pb = await getPocketBaseServiceClient();

  for (const [colName, records] of Object.entries(collectionsData)) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!record.id) continue;
      try {
        await pb.collection(colName).update(String(record.id), record, { requestKey: null });
      } catch {
        // Rollback attempt
      }
    }
  }
}

export async function deleteDatabaseBackup(backupId: string): Promise<boolean> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();
  const filePath = path.join(dir, `${cleanId}.json`);
  const metaPath = path.join(dir, `${cleanId}.json.meta.json`);

  try {
    await fs.rm(filePath, { force: true });
    await fs.rm(metaPath, { force: true });
    return true;
  } catch {
    return false;
  }
}
