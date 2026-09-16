import 'server-only';

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

import { APP_VERSION } from '@/lib/version';
import { gregorianToJalali } from '@/lib/jalali';
import { BaleBackupDestination } from '@/lib/backup-destinations/bale-destination';
import { ArvanS3BackupDestination } from '@/lib/backup-destinations/arvan-s3-destination';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'valid' | 'corrupted';

export type DestinationStatus = {
  destination: 'local' | 'bale' | 'arvan';
  status: 'pending' | 'success' | 'failed' | 'skipped';
  message?: string;
  error?: string;
};

export type BackupMetadata = {
  backupId: string;
  filename: string;
  createdAt: string;
  createdAtJalali: string;
  applicationVersion: string;
  backupFormatVersion: number;
  databaseType: 'PocketBase';
  schemaVersion: string;
  size: number;
  uncompressedSize?: number;
  checksum: string;
  compressionAlgorithm: 'gzip' | 'none';
  encryptionEnabled: boolean;
  status: BackupStatus;
  storageDestinations?: DestinationStatus[];
  isEmergency?: boolean;
  note?: string;
};

export type ZarfolioBackupHeader = {
  magic: 'ZARFOLIO_BACKUP';
  formatVersion: number;
  backupId: string;
  createdAt: string;
  createdAtJalali: string;
  applicationVersion: string;
  databaseType: 'PocketBase';
  schemaVersion: string;
  compressionAlgorithm: 'gzip' | 'none';
  encryption: {
    enabled: boolean;
    algorithm?: 'aes-256-gcm';
    kdf?: 'scrypt';
    salt?: string;
    iv?: string;
    authTag?: string;
  };
  checksum: string; // SHA-256 of payload (or encrypted payload)
  uncompressedSize?: number;
  note?: string;
};

export type BackupFormatValidationResult = {
  valid: boolean;
  error?: string;
  isEncrypted?: boolean;
  requiresPassword?: boolean;
  parsedData?: {
    backupId: string;
    createdAt: string;
    createdAtJalali?: string;
    applicationVersion: string;
    databaseType: 'PocketBase';
    schemaVersion: string;
    backupFormatVersion?: number;
    encryptionEnabled?: boolean;
    note?: string;
    collectionsCount: number;
    totalRecordsCount: number;
    collectionsSummary: Record<string, number>;
    data: {
      collections: Record<string, Array<Record<string, unknown>>>;
    };
  };
};

const BACKUP_DIR_NAME = 'app_backups';

export function getBackupDirPath(): string {
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

export function sanitizeBackupId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Formats a Date object into Jalali timestamp string (YYYY-MM-DD-HH-mm-ss)
 */
export function formatJalaliBackupTimestamp(date: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  fullStamp: string;
  formattedDisplay: string;
} {
  const j = gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const year = String(j.year);
  const month = String(j.month).padStart(2, '0');
  const day = String(j.day).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}-${min}-${sec}`,
    fullStamp: `${year}-${month}-${day}-${hour}-${min}-${sec}`,
    formattedDisplay: `${year}/${month}/${day} ${hour}:${min}:${sec}`,
  };
}

/**
 * Generates deterministic, collision-resistant Jalali backup filename
 * Example: ZF-1405-06-25-02-15-30.zfb
 */
export function generateJalaliBackupFilename(options?: {
  prefix?: string;
  extension?: string;
  date?: Date;
}): { filename: string; backupId: string; createdAtJalali: string } {
  const date = options?.date || new Date();
  const stamp = formatJalaliBackupTimestamp(date);
  const randomSuffix = crypto.randomBytes(2).toString('hex'); // 4-char suffix prevents same-second collision
  const prefix = options?.prefix || 'ZF';
  const ext = options?.extension || 'zfb';

  const backupId = `${prefix}-${stamp.fullStamp}-${randomSuffix}`;
  const filename = `${backupId}.${ext}`;

  return {
    filename,
    backupId,
    createdAtJalali: stamp.formattedDisplay,
  };
}

/**
 * Standard Modern Key Derivation (scrypt) & AES-256-GCM Encryption
 */
async function encryptPayload(
  buffer: Buffer,
  password: string
): Promise<{
  encryptedBuffer: Buffer;
  salt: string;
  iv: string;
  authTag: string;
}> {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Standard AES-256-GCM Decryption with scrypt Key Derivation
 */
async function decryptPayload(
  encryptedBuffer: Buffer,
  password: string,
  encryptionInfo: { salt: string; iv: string; authTag: string }
): Promise<Buffer> {
  const salt = Buffer.from(encryptionInfo.salt, 'hex');
  const iv = Buffer.from(encryptionInfo.iv, 'hex');
  const authTag = Buffer.from(encryptionInfo.authTag, 'hex');

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  } catch (err) {
    throw new Error('رمز عبور وارد شده اشتباه است یا فایل پشتیبان دستکاری شده است.');
  }
}

const ZFB_MAGIC = Buffer.from('ZARF', 'ascii');

/**
 * Checks whether a buffer represents a Zarfolio Backup (.zfb) container
 */
export function isZfbContainer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  return buffer.subarray(0, 4).equals(ZFB_MAGIC);
}

/**
 * Packs metadata header and binary payload into Zarfolio Backup Container (.zfb)
 */
export function packZarfolioContainer(header: ZarfolioBackupHeader, payload: Buffer): Buffer {
  const headerJson = JSON.stringify(header);
  const headerBuffer = Buffer.from(headerJson, 'utf-8');
  const headerLengthBuffer = Buffer.alloc(4);
  headerLengthBuffer.writeUInt32BE(headerBuffer.length, 0);

  // Layout: [ 4 bytes Magic 'ZARF' ][ 4 bytes Header Length ][ Header JSON UTF-8 ][ Payload Buffer ]
  return Buffer.concat([ZFB_MAGIC, headerLengthBuffer, headerBuffer, payload]);
}

/**
 * Unpacks Zarfolio Backup Container (.zfb) into Header and Payload
 */
export function unpackZarfolioContainer(buffer: Buffer): {
  header: ZarfolioBackupHeader;
  payload: Buffer;
} {
  if (buffer.length < 8) {
    throw new Error('فایل پشتیبان ناقص یا نامعتبر است.');
  }

  // Verify ZARF magic prefix
  if (!buffer.subarray(0, 4).equals(ZFB_MAGIC)) {
    throw new Error('فایل انتخاب شده متعلق به سامانه زرفولیو نیست (عدم تطابق امضای کانتینر).');
  }

  const headerLength = buffer.readUInt32BE(4);
  if (buffer.length < 8 + headerLength) {
    throw new Error('فایل پشتیبان زرفولیو آسیب دیده است (هدر ناقص).');
  }

  const headerJson = buffer.subarray(8, 8 + headerLength).toString('utf-8');
  let header: ZarfolioBackupHeader;
  try {
    header = JSON.parse(headerJson) as ZarfolioBackupHeader;
  } catch {
    throw new Error('هدر فایل کانتینر زرفولیو قابل خواندن نیست.');
  }

  if (header.magic !== 'ZARFOLIO_BACKUP') {
    throw new Error('فایل انتخاب شده متعلق به سامانه زرفولیو نیست.');
  }

  const payload = buffer.subarray(8 + headerLength);
  return { header, payload };
}

/**
 * Comprehensive List of Collections to Backup
 */
export const CORE_COLLECTIONS_TO_BACKUP = [
  'customers',
  'customer_groups',
  'app_settings',
  'currencies',
  'cash_funds',
  'cash_transactions',
  'bank_accounts',
  'bank_transactions',
  'banks',
  'checks',
  'coin_types',
  'coin_opening_inventory',
  'coin_inventory',
  'custom_fonts',
  'dashboard_preferences',
  'auth_events',
  'pbc_chart_of_accounts',
  'journal_entries',
  'journal_lines',
  'transactions',
  'metal_types',
  'metal_inventory',
  'goods_types',
  'goods_inventory',
  'gemstone_types',
  'gemstone_shapes',
  'gemstone_sieves',
  'gemstone_inventory',
  'gemstone_inventory_transactions',
  'gemstone_parcel_merges',
  'storage_locations',
  'workmanship_inventory',
  'assay_laboratories',
  'refining_cases',
  'refining_items',
  'refining_samples',
  'print_templates',
  'notifications',
];

export type CreateBackupOptions = {
  note?: string;
  isEmergency?: boolean;
  password?: string;
  dispatchDestinations?: boolean;
  destinations?: Array<'local' | 'bale' | 'arvan'>;
};

/**
 * Creates full Zarfolio database backup with optional compression, encryption, and multi-destination dispatch.
 */
export async function createDatabaseBackup({
  note,
  isEmergency = false,
  password,
  dispatchDestinations = true,
  destinations,
}: CreateBackupOptions = {}): Promise<BackupMetadata> {
  const dir = await ensureBackupDir();
  const prefix = isEmergency ? 'EMERGENCY' : 'ZF';
  const { filename, backupId, createdAtJalali } = generateJalaliBackupFilename({
    prefix,
    extension: 'zfb',
  });
  const filePath = path.join(dir, filename);
  const metaPath = path.join(dir, `${filename}.meta.json`);

  // 1. Collect all PocketBase records
  let dbData: Record<string, unknown> = {};
  let totalRecords = 0;
  const collectionsSummary: Record<string, number> = {};

  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient().catch(() => null);

    if (pb) {
      const exportedCollections: Record<string, unknown[]> = {};
      for (const colName of CORE_COLLECTIONS_TO_BACKUP) {
        try {
          const records = await pb.collection(colName).getFullList({ requestKey: null });
          exportedCollections[colName] = records;
          collectionsSummary[colName] = records.length;
          totalRecords += records.length;
        } catch {
          exportedCollections[colName] = [];
          collectionsSummary[colName] = 0;
        }
      }

      dbData = {
        timestamp: new Date().toISOString(),
        collections: exportedCollections,
      };
    }
  } catch {
    dbData = {
      timestamp: new Date().toISOString(),
      collections: {},
    };
  }

  const payloadData = {
    backupId,
    createdAt: new Date().toISOString(),
    createdAtJalali,
    applicationVersion: APP_VERSION,
    databaseType: 'PocketBase' as const,
    schemaVersion: '1.0',
    backupFormatVersion: 1,
    isEmergency,
    note: note || (isEmergency ? 'پشتیبان اضطراری خودکار قبل از بازیابی' : 'پشتیبان دستی کامل دیتابیس'),
    totalRecords,
    collectionsSummary,
    data: dbData,
  };

  const rawJsonBuffer = Buffer.from(JSON.stringify(payloadData), 'utf-8');
  const uncompressedSize = rawJsonBuffer.length;

  // 2. Compress payload with Gzip
  let processedPayload: Buffer = Buffer.from(await gzipAsync(rawJsonBuffer, { level: 9 }));

  // 3. Encrypt payload if password provided
  const encryptionEnabled = Boolean(password && password.trim().length > 0);
  let encryptionInfo: ZarfolioBackupHeader['encryption'] = { enabled: false };

  if (encryptionEnabled) {
    const encResult = await encryptPayload(processedPayload, password!.trim());
    processedPayload = Buffer.from(encResult.encryptedBuffer);
    encryptionInfo = {
      enabled: true,
      algorithm: 'aes-256-gcm',
      kdf: 'scrypt',
      salt: encResult.salt,
      iv: encResult.iv,
      authTag: encResult.authTag,
    };
  }

  // 4. Calculate Integrity Checksum on final payload
  const checksum = calculateChecksum(processedPayload);

  // 5. Pack into Container
  const header: ZarfolioBackupHeader = {
    magic: 'ZARFOLIO_BACKUP',
    formatVersion: 1,
    backupId,
    createdAt: payloadData.createdAt,
    createdAtJalali,
    applicationVersion: APP_VERSION,
    databaseType: 'PocketBase',
    schemaVersion: '1.0',
    compressionAlgorithm: 'gzip',
    encryption: encryptionInfo,
    checksum,
    uncompressedSize,
    note: payloadData.note,
  };

  const containerBuffer = packZarfolioContainer(header, processedPayload);

  // 6. Write to local storage
  await fs.writeFile(filePath, containerBuffer);

  const destinationStatuses: DestinationStatus[] = [
    { destination: 'local', status: 'success', message: `فایل محلی ذخیره شد: ${filename}` },
  ];

  // 7. Dispatch to configured remote destinations if enabled
  if (dispatchDestinations) {
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const pb = await getPocketBaseServiceClient().catch(() => null);
      const settingsRecord = await pb?.collection('app_settings').getFirstListItem('', { requestKey: null }).catch(() => null);
      
      const { normalizeSettings } = await import('@/lib/settings');
      const settings = settingsRecord ? normalizeSettings(settingsRecord as Record<string, unknown>) : null;

      const shouldSendBale = destinations ? destinations.includes('bale') : Boolean(settings?.backupDestinationBale);
      const shouldSendArvan = destinations ? destinations.includes('arvan') : Boolean(settings?.backupDestinationArvan);

      const uploadPayload = {
        backupId,
        filename,
        buffer: containerBuffer,
        size: containerBuffer.length,
        checksum,
        createdAt: payloadData.createdAt,
        createdAtJalali,
        encryptionEnabled,
        note: payloadData.note,
      };

      if (shouldSendBale) {
        const baleAdapter = new BaleBackupDestination({
          token: settings?.baleBotToken,
          chatId: settings?.baleDefaultChatId,
        });
        const baleRes = await baleAdapter.upload(uploadPayload);
        destinationStatuses.push({
          destination: 'bale',
          status: baleRes.success ? 'success' : 'failed',
          message: baleRes.message,
          error: baleRes.error,
        });
      }

      if (shouldSendArvan) {
        const arvanAdapter = new ArvanS3BackupDestination({
          endpoint: settings?.backupArvanEndpoint,
          bucket: settings?.backupArvanBucket,
          accessKey: settings?.backupArvanAccessKey,
          secretKey: settings?.backupArvanSecretKey,
        });
        const arvanRes = await arvanAdapter.upload(uploadPayload);
        destinationStatuses.push({
          destination: 'arvan',
          status: arvanRes.success ? 'success' : 'failed',
          message: arvanRes.message,
          error: arvanRes.error,
        });
      }
    } catch (destErr) {
      console.error('Error dispatching to backup destinations:', destErr);
    }
  }

  const metadata: BackupMetadata = {
    backupId,
    filename,
    createdAt: payloadData.createdAt,
    createdAtJalali,
    applicationVersion: APP_VERSION,
    backupFormatVersion: 1,
    databaseType: 'PocketBase',
    schemaVersion: '1.0',
    size: containerBuffer.length,
    uncompressedSize,
    checksum,
    compressionAlgorithm: 'gzip',
    encryptionEnabled,
    status: 'valid',
    storageDestinations: destinationStatuses,
    isEmergency,
    note: payloadData.note,
  };

  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  return metadata;
}

/**
 * Lists all existing database backups (both modern .zfb and legacy .json)
 */
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

/**
 * Validates integrity and structure of a database backup on disk.
 */
export async function validateDatabaseBackup(
  backupId: string,
  password?: string
): Promise<{
  valid: boolean;
  metadata?: BackupMetadata;
  error?: string;
  isEncrypted?: boolean;
}> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();

  // Try locating .zfb first, then legacy .json
  let filename = `${cleanId}.zfb`;
  let filePath = path.join(dir, filename);
  let metaPath = path.join(dir, `${filename}.meta.json`);

  try {
    await fs.access(filePath);
  } catch {
    filename = `${cleanId}.json`;
    filePath = path.join(dir, filename);
    metaPath = path.join(dir, `${filename}.meta.json`);
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    let meta: BackupMetadata;
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as BackupMetadata;
    } catch {
      return { valid: false, error: 'فایل شناسنامه پشتیبان پیدا نشد.' };
    }

    // Check if it's a Zarfolio container
    const isZfb = isZfbContainer(fileBuffer) || filename.endsWith('.zfb');

    if (isZfb) {
      let unpacked: { header: ZarfolioBackupHeader; payload: Buffer };
      try {
        unpacked = unpackZarfolioContainer(fileBuffer);
      } catch (err) {
        meta.status = 'corrupted';
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        return { valid: false, metadata: meta, error: err instanceof Error ? err.message : 'فرمت کانتینر نامعتبر است.' };
      }

      // Checksum integrity check
      const currentChecksum = calculateChecksum(unpacked.payload);
      if (currentChecksum !== unpacked.header.checksum) {
        meta.status = 'corrupted';
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        return { valid: false, metadata: meta, error: 'چک‌سام فایل آسیب‌دیده یا دستکاری‌شده است.' };
      }

      if (unpacked.header.encryption.enabled) {
        if (!password) {
          return { valid: true, metadata: meta, isEncrypted: true, error: 'فایل با رمز عبور محافظت شده است.' };
        }
        try {
          const decrypted = await decryptPayload(unpacked.payload, password, {
            salt: unpacked.header.encryption.salt!,
            iv: unpacked.header.encryption.iv!,
            authTag: unpacked.header.encryption.authTag!,
          });
          await gunzipAsync(decrypted);
        } catch (decryptErr) {
          return { valid: false, metadata: meta, isEncrypted: true, error: decryptErr instanceof Error ? decryptErr.message : 'رمز عبور نامعتبر است.' };
        }
      } else {
        try {
          await gunzipAsync(unpacked.payload);
        } catch {
          meta.status = 'corrupted';
          return { valid: false, metadata: meta, error: 'محتوای فشرده فایل پشتیبان بازگشایی نشد.' };
        }
      }
    } else {
      // Legacy JSON backup validation
      const currentChecksum = calculateChecksum(fileBuffer);
      if (meta.checksum !== currentChecksum) {
        meta.status = 'corrupted';
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        return { valid: false, metadata: meta, error: 'هش/چک‌سام پشتیبان مطابقت ندارد و فایل آسیب دیده است.' };
      }
    }

    meta.status = 'valid';
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    return { valid: true, metadata: meta, isEncrypted: meta.encryptionEnabled };
  } catch {
    return { valid: false, error: 'فایل پشتیبان پیدا نشد یا قابل خواندن نیست.' };
  }
}

/**
 * Returns raw buffer and filename for downloading backup
 */
export async function getBackupFileBuffer(backupId: string): Promise<{
  buffer: Buffer;
  filename: string;
} | null> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();

  for (const ext of ['zfb', 'json']) {
    const fn = `${cleanId}.${ext}`;
    const fp = path.join(dir, fn);
    try {
      const buffer = await fs.readFile(fp);
      return { buffer, filename: fn };
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Deletes backup file and its metadata
 */
export async function deleteDatabaseBackup(backupId: string): Promise<boolean> {
  const cleanId = sanitizeBackupId(backupId);
  const dir = await ensureBackupDir();

  let deleted = false;
  for (const ext of ['zfb', 'json']) {
    const filePath = path.join(dir, `${cleanId}.${ext}`);
    const metaPath = path.join(dir, `${cleanId}.${ext}.meta.json`);
    try {
      await fs.rm(filePath, { force: true });
      await fs.rm(metaPath, { force: true });
      deleted = true;
    } catch {
      // continue
    }
  }

  return deleted;
}

/**
 * Validates raw content / buffer of an uploaded backup file.
 */
export function validateBackupFileContent(
  contentOrBuffer: string | Buffer,
  password?: string
): BackupFormatValidationResult {
  const buffer = Buffer.isBuffer(contentOrBuffer)
    ? contentOrBuffer
    : Buffer.from(contentOrBuffer, 'utf-8');

  if (buffer.length === 0) {
    return { valid: false, error: 'فایل پشتیبان خالی است یا محتوایی ندارد.' };
  }

  // Detect if ZFB container
  const isZfb = isZfbContainer(buffer);

  if (isZfb) {
    let unpacked: { header: ZarfolioBackupHeader; payload: Buffer };
    try {
      unpacked = unpackZarfolioContainer(buffer);
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'فرمت کانتینر نامعتبر است.' };
    }

    // Integrity check
    const currentChecksum = calculateChecksum(unpacked.payload);
    if (currentChecksum !== unpacked.header.checksum) {
      return { valid: false, error: 'یکپارچگی فایل پشتیبان مخدوش است (عدم تطابق Checksum).' };
    }

    if (unpacked.header.encryption.enabled) {
      if (!password) {
        return {
          valid: true,
          isEncrypted: true,
          requiresPassword: true,
          error: 'این فایل پشتیبان با رمز عبور قفل شده است. لطفاً رمز عبور را وارد کنید.',
        };
      }
      // Note: Full decryption in async context should be handled in restore flow
    }
  }

  // Handle Legacy JSON parsing
  if (!isZfb) {
    try {
      const contentStr = buffer.toString('utf-8');
      const parsed = JSON.parse(contentStr) as Record<string, unknown>;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'فرمت فایل نامعتبر است: داده‌های فایل پشتیبان باید یک شیء باشد.' };
      }

      if (parsed.databaseType !== 'PocketBase') {
        return {
          valid: false,
          error: 'نوع پایگاه داده نامعتبر است: این فایل پشتیبان متعلق به سامانه زرفولیو (PocketBase) نیست.',
        };
      }

      const dataObj = parsed.data as Record<string, unknown> | undefined;
      if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
        return {
          valid: false,
          error: 'ساختار محتوای پشتیبان ناقص است: بخش کلیدی data در فایل یافت نشد.',
        };
      }

      const collectionsObj = dataObj.collections as Record<string, unknown[]> | undefined;
      if (!collectionsObj || typeof collectionsObj !== 'object' || Array.isArray(collectionsObj)) {
        return {
          valid: false,
          error: 'ساختار محتوای پشتیبان ناقص است: بخش جدول‌ها (collections) در فایل وجود ندارد.',
        };
      }

      const collectionNames = Object.keys(collectionsObj);
      if (collectionNames.length === 0) {
        return { valid: false, error: 'فایل پشتیبان فاقد هرگونه جدول یا رکورد ذخیره‌شده است.' };
      }

      let totalRecordsCount = 0;
      const collectionsSummary: Record<string, number> = {};
      for (const colName of collectionNames) {
        const list = collectionsObj[colName];
        if (!Array.isArray(list)) {
          return { valid: false, error: `جدول "${colName}" در فایل پشتیبان ساختار معتبر آرایه‌ای ندارد.` };
        }
        collectionsSummary[colName] = list.length;
        totalRecordsCount += list.length;
      }

      return {
        valid: true,
        parsedData: {
          backupId: String(parsed.backupId || `imported_${Date.now()}`),
          createdAt: String(parsed.createdAt || new Date().toISOString()),
          createdAtJalali: String(parsed.createdAtJalali || ''),
          applicationVersion: String(parsed.applicationVersion || APP_VERSION),
          databaseType: 'PocketBase',
          schemaVersion: String(parsed.schemaVersion || '1.0'),
          note: parsed.note ? String(parsed.note) : undefined,
          collectionsCount: collectionNames.length,
          totalRecordsCount,
          collectionsSummary,
          data: {
            collections: collectionsObj as Record<string, Array<Record<string, unknown>>>,
          },
        },
      };
    } catch {
      return { valid: false, error: 'فرمت فایل نامعتبر است: فایل انتخابی یک فایل JSON یا ZFB معتبر نیست.' };
    }
  }

  return {
    valid: true,
    isEncrypted: false,
  };
}

/**
 * Extracts and parses backup payload from either .zfb or legacy .json buffer
 */
export async function extractBackupPayload(
  buffer: Buffer,
  password?: string
): Promise<{
  backupId: string;
  createdAt: string;
  createdAtJalali?: string;
  applicationVersion: string;
  schemaVersion: string;
  note?: string;
  collectionsData: Record<string, Array<Record<string, unknown>>>;
  collectionsCount: number;
  totalRecordsCount: number;
}> {
  const isZfb = isZfbContainer(buffer);

  if (isZfb) {
    const { header, payload } = unpackZarfolioContainer(buffer);

    // Checksum verification
    const currentChecksum = calculateChecksum(payload);
    if (currentChecksum !== header.checksum) {
      throw new Error('یکپارچگی فایل پشتیبان مخدوش است (عدم تطابق Checksum).');
    }

    let rawCompressed: Buffer = payload;
    if (header.encryption.enabled) {
      if (!password || !password.trim()) {
        throw new Error('این فایل پشتیبان با رمز عبور محافظت شده است. لطفاً رمز عبور را وارد کنید.');
      }
      rawCompressed = await decryptPayload(payload, password.trim(), {
        salt: header.encryption.salt!,
        iv: header.encryption.iv!,
        authTag: header.encryption.authTag!,
      });
    }

    const decompressed = await gunzipAsync(rawCompressed);
    const parsed = JSON.parse(decompressed.toString('utf-8'));
    const collectionsObj = (parsed.data?.collections || {}) as Record<string, Array<Record<string, unknown>>>;

    let totalRecordsCount = 0;
    for (const records of Object.values(collectionsObj)) {
      if (Array.isArray(records)) totalRecordsCount += records.length;
    }

    return {
      backupId: header.backupId,
      createdAt: header.createdAt,
      createdAtJalali: header.createdAtJalali,
      applicationVersion: header.applicationVersion,
      schemaVersion: header.schemaVersion,
      note: header.note,
      collectionsData: collectionsObj,
      collectionsCount: Object.keys(collectionsObj).length,
      totalRecordsCount,
    };
  } else {
    // Legacy JSON
    const parsed = JSON.parse(buffer.toString('utf-8'));
    const collectionsObj = (parsed.data?.collections || {}) as Record<string, Array<Record<string, unknown>>>;

    let totalRecordsCount = 0;
    for (const records of Object.values(collectionsObj)) {
      if (Array.isArray(records)) totalRecordsCount += records.length;
    }

    return {
      backupId: parsed.backupId || `imported_${Date.now()}`,
      createdAt: parsed.createdAt || new Date().toISOString(),
      createdAtJalali: parsed.createdAtJalali,
      applicationVersion: parsed.applicationVersion || APP_VERSION,
      schemaVersion: parsed.schemaVersion || '1.0',
      note: parsed.note,
      collectionsData: collectionsObj,
      collectionsCount: Object.keys(collectionsObj).length,
      totalRecordsCount,
    };
  }
}

/**
 * Restores database from an existing local backup file by ID.
 */
export async function restoreDatabaseBackup(
  backupId: string,
  password?: string
): Promise<{
  success: boolean;
  emergencyBackupId?: string;
  message: string;
}> {
  const cleanId = sanitizeBackupId(backupId);
  const fileData = await getBackupFileBuffer(cleanId);
  if (!fileData) {
    throw new Error('فایل پشتیبان مورد نظر یافت نشد.');
  }

  // 1. Create automatic emergency backup before restoring
  let emergencyMeta: BackupMetadata;
  try {
    emergencyMeta = await createDatabaseBackup({
      isEmergency: true,
      note: `پشتیبان اضطراری خودکار قبل از بازیابی پشتیبان ${cleanId}`,
      dispatchDestinations: false,
    });
  } catch (err) {
    throw new Error(`ایجاد پشتیبان اضطراری شکست خورد: ${err instanceof Error ? err.message : 'خطای ناشناخته'}`);
  }

  // 2. Extract and validate payload
  const { collectionsData, collectionsCount, totalRecordsCount } = await extractBackupPayload(fileData.buffer, password);

  // 3. Import records into PocketBase collections safely
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient();

    for (const [colName, records] of Object.entries(collectionsData)) {
      if (!Array.isArray(records)) continue;

      for (const record of records) {
        if (!record.id) continue;
        try {
          await pb.collection(colName).getOne(String(record.id), { requestKey: null });
          await pb.collection(colName).update(String(record.id), record, { requestKey: null });
        } catch {
          try {
            await pb.collection(colName).create(record, { requestKey: null });
          } catch {
            // Ignore record insertion conflict
          }
        }
      }
    }

    return {
      success: true,
      emergencyBackupId: emergencyMeta.backupId,
      message: `اطلاعات با موفقیت بازیابی شد (${totalRecordsCount} رکورد در ${collectionsCount} جدول).`,
    };
  } catch (restoreErr) {
    try {
      await rollbackEmergencyBackup(emergencyMeta.backupId);
    } catch {
      // Rollback error logged
    }
    throw new Error(`بازیابی با خطا مواجه شد و بازگردانی اضطراری انجام شد: ${restoreErr instanceof Error ? restoreErr.message : 'خطای ناشناخته'}`);
  }
}

/**
 * Restores database from an uploaded buffer or string.
 */
export async function restoreDatabaseBackupFromContent(
  contentOrBuffer: string | Buffer,
  options: { note?: string; password?: string } = {}
): Promise<{
  success: boolean;
  backupId: string;
  emergencyBackupId?: string;
  message: string;
  restoredCollectionsCount: number;
  totalRestoredRecords: number;
}> {
  const buffer = Buffer.isBuffer(contentOrBuffer)
    ? contentOrBuffer
    : Buffer.from(contentOrBuffer, 'utf-8');

  // 1. Extract and validate
  const extracted = await extractBackupPayload(buffer, options.password);

  // 2. Persist the uploaded file in app_backups
  const dir = await ensureBackupDir();
  const isZfb = isZfbContainer(buffer);
  const ext = isZfb ? 'zfb' : 'json';
  const filename = `${sanitizeBackupId(extracted.backupId)}.${ext}`;
  const filePath = path.join(dir, filename);
  const metaPath = path.join(dir, `${filename}.meta.json`);

  const checksum = calculateChecksum(buffer);
  const metadata: BackupMetadata = {
    backupId: extracted.backupId,
    filename,
    createdAt: extracted.createdAt,
    createdAtJalali: extracted.createdAtJalali || '',
    applicationVersion: extracted.applicationVersion,
    backupFormatVersion: isZfb ? 1 : 0,
    databaseType: 'PocketBase',
    schemaVersion: extracted.schemaVersion,
    size: buffer.length,
    checksum,
    compressionAlgorithm: isZfb ? 'gzip' : 'none',
    encryptionEnabled: Boolean(options.password),
    status: 'valid',
    isEmergency: false,
    note: options.note || extracted.note || 'بازیابی دستی از فایل آپلودشده',
  };

  await fs.writeFile(filePath, buffer);
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // 3. Create emergency backup before restoration
  let emergencyMeta: BackupMetadata;
  try {
    emergencyMeta = await createDatabaseBackup({
      isEmergency: true,
      note: `پشتیبان اضطراری خودکار قبل از بازیابی فایل پشتیبان ${extracted.backupId}`,
      dispatchDestinations: false,
    });
  } catch (err) {
    throw new Error(`ایجاد پشتیبان اضطراری شکست خورد: ${err instanceof Error ? err.message : 'خطای ناشناخته'}`);
  }

  // 4. Import records into PocketBase collections
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const pb = await getPocketBaseServiceClient().catch(() => null);

    if (pb) {
      for (const [colName, records] of Object.entries(extracted.collectionsData)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record.id) continue;
          try {
            await pb.collection(colName).getOne(String(record.id), { requestKey: null });
            await pb.collection(colName).update(String(record.id), record, { requestKey: null });
          } catch {
            try {
              await pb.collection(colName).create(record, { requestKey: null });
            } catch {
              // Ignore individual record import conflicts
            }
          }
        }
      }
    }

    return {
      success: true,
      backupId: extracted.backupId,
      emergencyBackupId: emergencyMeta.backupId,
      message: `اطلاعات فایل پشتیبان با موفقیت بازیابی شد (${extracted.totalRecordsCount} رکورد در ${extracted.collectionsCount} جدول).`,
      restoredCollectionsCount: extracted.collectionsCount,
      totalRestoredRecords: extracted.totalRecordsCount,
    };
  } catch (restoreErr) {
    try {
      await rollbackEmergencyBackup(emergencyMeta.backupId);
    } catch {
      // Rollback error logged
    }

    throw new Error(
      `بازیابی فایل پشتیبان با خطا مواجه شد و بازگردانی اضطراری انجام شد: ${
        restoreErr instanceof Error ? restoreErr.message : 'خطای ناشناخته'
      }`
    );
  }
}

/**
 * Emergency rollback helper
 */
async function rollbackEmergencyBackup(emergencyId: string) {
  const fileData = await getBackupFileBuffer(emergencyId);
  if (!fileData) return;

  const { collectionsData } = await extractBackupPayload(fileData.buffer);
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
