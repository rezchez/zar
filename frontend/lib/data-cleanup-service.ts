import 'server-only';

import fs from 'fs/promises';
import existsSync from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

import { gregorianToJalali } from '@/lib/jalali';
import { clearChartOfAccountsCache } from '@/lib/chart-of-accounts-cache';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export function isConfirmationValid(text: string): boolean {
  if (!text) return false;
  const normalized = text
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200b\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ');
  return (
    normalized === 'حذف تایید است' ||
    normalized === 'حذف تأیید است' ||
    normalized === 'حذف تایید است.' ||
    normalized === 'حذف تأیید است.'
  );
}

export type CleanupStatus = 'retained' | 'restored' | 'expired';

export type CleanupMetadata = {
  cleanupId: string;
  filename: string;
  purgedAt: string;
  purgedAtJalali: string;
  expiresAt: string;
  expiresAtJalali: string;
  retentionDays: number;
  status: CleanupStatus;
  purgedBy: {
    id: string;
    name?: string;
    email?: string;
  };
  restoredAt?: string;
  restoredBy?: {
    id: string;
    name?: string;
    email?: string;
  };
  counts: Record<string, number>;
  totalTransactionsCount: number;
  totalAccountsCount: number;
};

export type DatabaseCounts = {
  transactions: number;
  cashTransactions: number;
  bankTransactions: number;
  journalEntries: number;
  journalLines: number;
  checks: number;
  gemstoneInventoryTransactions: number;
  customers: number;
  bankAccounts: number;
  cashFunds: number;
  customAccounts: number;
  totalTransactions: number;
  totalAccounts: number;
};

export type CleanupStatusResponse = {
  hasRetainedData: boolean;
  activeCleanup: (CleanupMetadata & { daysRemaining: number }) | null;
  history: CleanupMetadata[];
  currentCounts: DatabaseCounts;
};

const CLEANUP_DIR_NAME = 'app_cleanups';
const RETENTION_DAYS = 30;

export function getCleanupDirPath(): string {
  const candidates = [
    process.env.DATA_CLEANUP_DIR,
    path.resolve(process.cwd(), 'app_cleanups'),
    path.resolve(process.cwd(), 'frontend/app_cleanups'),
    path.resolve(process.cwd(), '../frontend/app_cleanups'),
    path.resolve(process.cwd(), '../app_cleanups'),
  ].filter(Boolean) as string[];

  // Return the first candidate that exists and has files
  for (const dir of candidates) {
    if (existsSync.existsSync(dir)) {
      try {
        const files = existsSync.readdirSync(dir);
        if (files.some((f) => f.endsWith('.meta.json') || f.endsWith('.json.gz'))) {
          return dir;
        }
      } catch {
        // continue
      }
    }
  }

  for (const dir of candidates) {
    if (existsSync.existsSync(dir)) return dir;
  }

  return candidates[1] || path.resolve(process.cwd(), CLEANUP_DIR_NAME);
}

export async function ensureCleanupDir(): Promise<string> {
  const dirPath = getCleanupDirPath();
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Already exists
  }
  return dirPath;
}

export function getDbPath(): string {
  const candidates = [
    process.env.POCKETBASE_DB_PATH,
    path.resolve(process.cwd(), '../backend/pb_data/data.db'),
    path.resolve(process.cwd(), 'backend/pb_data/data.db'),
    path.resolve(process.cwd(), 'pb_data/data.db'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync.existsSync(p)) return p;
  }
  return candidates[0] || path.resolve(process.cwd(), '../backend/pb_data/data.db');
}

export interface UniversalDb {
  queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): { run(...params: unknown[]): void };
  exec(sql: string): void;
  transaction<R>(fn: () => R): R;
}

function loadSqliteModule():
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'bun'; Database: new (path: string) => any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'node'; DatabaseSync: new (path: string) => any } {
  // 1. Try Bun runtime first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).Bun !== 'undefined') {
    try {
      // Use dynamic require without static literal URL to avoid Turbopack AST URL error
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createRequire } = require('module');
      const req = createRequire(process.cwd());
      const bunModule = ['bun', 'sqlite'].join(':');
      const bunSqlite = req(bunModule);
      if (bunSqlite?.Database) {
        return { type: 'bun', Database: bunSqlite.Database };
      }
    } catch {
      // Fall through to node:sqlite
    }
  }

  // 2. Try Node.js 22+ official built-in module getter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (process as any).getBuiltinModule === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeSqlite = (process as any).getBuiltinModule('node:sqlite');
      if (nodeSqlite?.DatabaseSync) {
        return { type: 'node', DatabaseSync: nodeSqlite.DatabaseSync };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Fallback via createRequire without static string literal
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRequire } = require('module');
    const req = createRequire(process.cwd());
    const nodeModule = ['node', 'sqlite'].join(':');
    const nodeSqlite = req(nodeModule);
    if (nodeSqlite?.DatabaseSync) {
      return { type: 'node', DatabaseSync: nodeSqlite.DatabaseSync };
    }
  } catch {
    // Fall through
  }

  throw new Error('ماژول SQLite در محیط اجرای فعلی در دسترس نمی‌باشد.');
}

export function getDb(): UniversalDb {
  const dbPath = getDbPath();
  const sqlite = loadSqliteModule();

  if (sqlite.type === 'bun') {
    const db = new sqlite.Database(dbPath);
    return {
      queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
        const stmt = db.query(sql);
        return (params ? stmt.all(...params) : stmt.all()) as T[];
      },
      queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
        const stmt = db.query(sql);
        return (params ? stmt.get(...params) : stmt.get()) as T | null;
      },
      run(sql: string, params?: unknown[]) {
        if (params && params.length > 0) {
          db.run(sql, params);
        } else {
          db.run(sql);
        }
      },
      prepare(sql: string) {
        const stmt = db.prepare(sql);
        return {
          run(...params: unknown[]) {
            stmt.run(...params);
          },
        };
      },
      exec(sql: string) {
        db.exec(sql);
      },
      transaction<R>(fn: () => R): R {
        return db.transaction(fn)();
      },
    };
  }

  // Node DatabaseSync
  const db = new sqlite.DatabaseSync(dbPath);
  return {
    queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const stmt = db.prepare(sql);
      return (params ? stmt.all(...params) : stmt.all()) as T[];
    },
    queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
      const stmt = db.prepare(sql);
      return (params ? stmt.get(...params) : stmt.get()) as T | null;
    },
    run(sql: string, params?: unknown[]) {
      const stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt.run(...params);
      } else {
        stmt.run();
      }
    },
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]) {
          stmt.run(...params);
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
    transaction<R>(fn: () => R): R {
      db.exec('BEGIN TRANSACTION');
      try {
        const res = fn();
        db.exec('COMMIT');
        return res;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

function tableExists(db: UniversalDb, tableName: string): boolean {
  const row = db.queryOne<{ count: number }>(
    "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name = ?",
    [tableName],
  );
  return (row?.count ?? 0) > 0;
}

function formatJalaliDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${j.year}/${String(j.month).padStart(2, '0')}/${String(j.day).padStart(2, '0')} ${h}:${m}`;
  } catch {
    return isoDate;
  }
}

// Collections to be snapshotted and cleaned
export const TRANSACTION_TABLES = [
  'gemstone_inventory_transactions',
  'journal_lines',
  'journal_entries',
  'cash_transactions',
  'bank_transactions',
  'checks',
  'transactions',
] as const;

export const ACCOUNT_TABLES = [
  'favorite_customers',
  'customers',
  'bank_accounts',
  'cash_funds',
] as const;

export function getDatabaseCounts(): DatabaseCounts {
  const db = getDb();

  const getCount = (table: string, whereClause = ''): number => {
    if (!tableExists(db, table)) return 0;
    try {
      const sql = `SELECT count(*) as count FROM "${table}" ${whereClause}`;
      const row = db.queryOne<{ count: number }>(sql);
      return Number(row?.count || 0);
    } catch {
      return 0;
    }
  };

  const txs = getCount('transactions');
  const cashTxs = getCount('cash_transactions');
  const bankTxs = getCount('bank_transactions');
  const jEntries = getCount('journal_entries');
  const jLines = getCount('journal_lines');
  const chks = getCount('checks');
  const gemTxs = getCount('gemstone_inventory_transactions');

  const custs = getCount('customers');
  const bAccounts = getCount('bank_accounts');
  const cFunds = getCount('cash_funds');
  const cAccounts = getCount('chart_of_accounts', "WHERE isSystem = 0 OR isSystem = 'false'");

  const totalTransactions = txs + cashTxs + bankTxs + jEntries + jLines + chks + gemTxs;
  const totalAccounts = custs + bAccounts + cFunds + cAccounts;

  return {
    transactions: txs,
    cashTransactions: cashTxs,
    bankTransactions: bankTxs,
    journalEntries: jEntries,
    journalLines: jLines,
    checks: chks,
    gemstoneInventoryTransactions: gemTxs,
    customers: custs,
    bankAccounts: bAccounts,
    cashFunds: cFunds,
    customAccounts: cAccounts,
    totalTransactions,
    totalAccounts,
  };
}

/**
 * Clean up archives that are older than 30 days.
 * Requirement: "اطلاعات حذف شده باید تا 30 روز باقی بمونه و قابلیت بازگشت داشته باشه و بعد از 30 روز پاک بشه"
 */
export async function cleanExpiredCleanups(): Promise<string[]> {
  const dir = await ensureCleanupDir();
  const deletedFiles: string[] = [];

  try {
    const files = await fs.readdir(dir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));
    const now = Date.now();

    for (const metaFile of metaFiles) {
      const metaPath = path.join(dir, metaFile);
      try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content) as CleanupMetadata;
        const expiresTime = new Date(meta.expiresAt).getTime();

        if (now > expiresTime) {
          // File expired past 30 days! Permanently delete archive and meta
          const archivePath = path.join(dir, meta.filename);
          await fs.rm(archivePath, { force: true }).catch(() => null);
          await fs.rm(metaPath, { force: true }).catch(() => null);
          deletedFiles.push(meta.cleanupId);
        }
      } catch {
        // Skip unparseable
      }
    }
  } catch {
    // Directory reading failure
  }

  return deletedFiles;
}

export async function listCleanups(): Promise<CleanupMetadata[]> {
  await cleanExpiredCleanups();
  const dir = await ensureCleanupDir();
  const cleanups: CleanupMetadata[] = [];

  try {
    const files = await fs.readdir(dir);
    const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      const metaPath = path.join(dir, metaFile);
      try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content) as CleanupMetadata;
        const archivePath = path.join(dir, meta.filename);
        if (existsSync.existsSync(archivePath)) {
          cleanups.push(meta);
        }
      } catch {
        // Ignore corrupted file
      }
    }
  } catch {
    // Ignore error
  }

  // Sort descending by purgedAt
  cleanups.sort((a, b) => new Date(b.purgedAt).getTime() - new Date(a.purgedAt).getTime());
  return cleanups;
}

export async function getCleanupStatus(): Promise<CleanupStatusResponse> {
  const cleanups = await listCleanups();
  const now = Date.now();

  // Find latest active retained cleanup (not expired and status is 'retained')
  const active = cleanups.find((c) => c.status === 'retained' && new Date(c.expiresAt).getTime() > now) || null;

  let activeWithRemaining: (CleanupMetadata & { daysRemaining: number }) | null = null;
  if (active) {
    const msRemaining = new Date(active.expiresAt).getTime() - now;
    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    activeWithRemaining = {
      ...active,
      daysRemaining,
    };
  }

  const currentCounts = getDatabaseCounts();

  return {
    hasRetainedData: Boolean(activeWithRemaining),
    activeCleanup: activeWithRemaining,
    history: cleanups,
    currentCounts,
  };
}

/**
 * Execute Data Cleanup:
 * 1. Collect all rows from transactions & accounts
 * 2. Save compressed JSON archive with 30-day expiration
 * 3. Delete records from database
 */
export async function executeDataCleanup(options: {
  purgedBy: { id: string; name?: string; email?: string };
}): Promise<CleanupMetadata> {
  const dir = await ensureCleanupDir();
  const db = getDb();

  const now = new Date();
  const cleanupId = `cleanup_${now.getTime()}`;
  const filename = `${cleanupId}.json.gz`;
  const metaFilename = `${cleanupId}.meta.json`;

  const purgedAt = now.toISOString();
  const purgedAtJalali = formatJalaliDate(purgedAt);
  const expiresDate = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = expiresDate.toISOString();
  const expiresAtJalali = formatJalaliDate(expiresAt);

  // 1. Collect all data
  const snapshotData: Record<string, Array<Record<string, unknown>>> = {};
  const counts: Record<string, number> = {};

  const allTablesToExport = [
    ...TRANSACTION_TABLES,
    ...ACCOUNT_TABLES,
    'chart_of_accounts',
  ];

  for (const tableName of allTablesToExport) {
    if (!tableExists(db, tableName)) {
      snapshotData[tableName] = [];
      counts[tableName] = 0;
      continue;
    }

    let rows: Array<Record<string, unknown>> = [];
    if (tableName === 'chart_of_accounts') {
      rows = db.queryAll<Record<string, unknown>>(
        'SELECT * FROM "chart_of_accounts" WHERE isSystem = 0 OR isSystem = \'false\'',
      );
    } else {
      rows = db.queryAll<Record<string, unknown>>(`SELECT * FROM "${tableName}"`);
    }

    snapshotData[tableName] = rows;
    counts[tableName] = rows.length;
  }

  const totalTransactionsCount =
    (counts.transactions || 0) +
    (counts.cash_transactions || 0) +
    (counts.bank_transactions || 0) +
    (counts.journal_entries || 0) +
    (counts.journal_lines || 0) +
    (counts.checks || 0) +
    (counts.gemstone_inventory_transactions || 0);

  const totalAccountsCount =
    (counts.customers || 0) +
    (counts.bank_accounts || 0) +
    (counts.cash_funds || 0) +
    (counts.chart_of_accounts || 0);

  const metadata: CleanupMetadata = {
    cleanupId,
    filename,
    purgedAt,
    purgedAtJalali,
    expiresAt,
    expiresAtJalali,
    retentionDays: RETENTION_DAYS,
    status: 'retained',
    purgedBy: options.purgedBy,
    counts,
    totalTransactionsCount,
    totalAccountsCount,
  };

  // 2. Compress and save payload to app_cleanups
  const payload = {
    metadata,
    data: snapshotData,
  };
  const jsonBuffer = Buffer.from(JSON.stringify(payload));
  const compressedBuffer = await gzipAsync(jsonBuffer);

  const archivePath = path.join(dir, filename);
  const metaPath = path.join(dir, metaFilename);

  await fs.writeFile(archivePath, compressedBuffer);
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // 3. Atomically delete records from database
  db.transaction(() => {
    // Delete in reverse dependency order:
    // Transactions
    if (tableExists(db, 'gemstone_inventory_transactions')) {
      db.run('DELETE FROM "gemstone_inventory_transactions"');
    }
    if (tableExists(db, 'journal_lines')) {
      db.run('DELETE FROM "journal_lines"');
    }
    if (tableExists(db, 'journal_entries')) {
      db.run('DELETE FROM "journal_entries"');
    }
    if (tableExists(db, 'cash_transactions')) {
      db.run('DELETE FROM "cash_transactions"');
    }
    if (tableExists(db, 'bank_transactions')) {
      db.run('DELETE FROM "bank_transactions"');
    }
    if (tableExists(db, 'checks')) {
      db.run('DELETE FROM "checks"');
    }
    if (tableExists(db, 'transactions')) {
      db.run('DELETE FROM "transactions"');
    }

    // Accounts
    if (tableExists(db, 'favorite_customers')) {
      db.run('DELETE FROM "favorite_customers"');
    }
    if (tableExists(db, 'customers')) {
      db.run('DELETE FROM "customers"');
    }
    if (tableExists(db, 'bank_accounts')) {
      db.run('DELETE FROM "bank_accounts"');
    }
    if (tableExists(db, 'cash_funds')) {
      db.run('DELETE FROM "cash_funds"');
    }
    if (tableExists(db, 'chart_of_accounts')) {
      db.run('DELETE FROM "chart_of_accounts" WHERE isSystem = 0 OR isSystem = \'false\'');
    }
  });

  clearChartOfAccountsCache();

  return metadata;
}

function insertRowsBatch(
  db: UniversalDb,
  tableName: string,
  rows: Array<Record<string, unknown>>,
): number {
  if (rows.length === 0) return 0;
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  if (keys.length === 0) return 0;

  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const sql = `INSERT OR REPLACE INTO "${tableName}" (${cols}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);

  let count = 0;
  for (const row of rows) {
    const values = keys.map((k) => {
      const v = row[k];
      if (v !== null && typeof v === 'object') {
        return JSON.stringify(v);
      }
      if (typeof v === 'boolean') {
        return v ? 1 : 0;
      }
      return v;
    });

    try {
      stmt.run(...values);
      count++;
    } catch {
      // Continue with next row
    }
  }

  return count;
}

/**
 * Restore data from a 30-day retention cleanup snapshot.
 * Requirement: "اطلاعات حذف شده باید تا 30 روز باقی بمونه و قابلیت بازگشت داشته باشه"
 */
export async function restoreDataCleanup(options: {
  cleanupId?: string;
  restoredBy: { id: string; name?: string; email?: string };
}): Promise<{ metadata: CleanupMetadata; restoredCounts: Record<string, number> }> {
  const dir = await ensureCleanupDir();
  const db = getDb();

  // Find metadata
  let targetMeta: CleanupMetadata | null = null;
  let activeDir = dir;

  if (options.cleanupId) {
    const searchDirs = [
      dir,
      path.resolve(process.cwd(), 'app_cleanups'),
      path.resolve(process.cwd(), 'frontend/app_cleanups'),
      path.resolve(process.cwd(), '../frontend/app_cleanups'),
      path.resolve(process.cwd(), '../app_cleanups'),
    ];

    for (const searchDir of searchDirs) {
      const metaPath = path.join(searchDir, `${options.cleanupId}.meta.json`);
      if (existsSync.existsSync(metaPath)) {
        try {
          const content = await fs.readFile(metaPath, 'utf-8');
          targetMeta = JSON.parse(content) as CleanupMetadata;
          activeDir = searchDir;
          break;
        } catch {
          // continue
        }
      }
    }

    if (!targetMeta) {
      throw new Error(`نسخه بازیافت با شناسه ${options.cleanupId} یافت نشد.`);
    }
  } else {
    const status = await getCleanupStatus();
    if (!status.activeCleanup) {
      throw new Error('هیچ اطلاعات پاکسازی‌شده فعالی در مهلت ۳۰ روزه جهت بازگردانی وجود ندارد.');
    }
    targetMeta = status.activeCleanup;
  }

  if (!targetMeta) {
    throw new Error('نسخه پاکسازی‌شده جهت بازیابی یافت نشد.');
  }

  // Check 30-day expiration
  if (new Date(targetMeta.expiresAt).getTime() < Date.now()) {
    throw new Error('مهلت ۳۰ روزه بازگردانی این اطلاعات به پایان رسیده است و قابل بازیابی نیست.');
  }

  // Load compressed payload
  let archivePath = path.join(activeDir, targetMeta.filename);
  if (!existsSync.existsSync(archivePath)) {
    const fallbackDirs = [
      path.resolve(process.cwd(), 'app_cleanups'),
      path.resolve(process.cwd(), 'frontend/app_cleanups'),
      path.resolve(process.cwd(), '../frontend/app_cleanups'),
      path.resolve(process.cwd(), '../app_cleanups'),
    ];
    for (const fDir of fallbackDirs) {
      const candidate = path.join(fDir, targetMeta.filename);
      if (existsSync.existsSync(candidate)) {
        archivePath = candidate;
        break;
      }
    }
  }

  if (!existsSync.existsSync(archivePath)) {
    throw new Error(`فایل فشرده نسخه بازیافت (${targetMeta.filename}) یافت نشد.`);
  }
  let payload: { metadata: CleanupMetadata; data: Record<string, Array<Record<string, unknown>>> };
  try {
    const compressed = await fs.readFile(archivePath);
    const uncompressed = await gunzipAsync(compressed);
    payload = JSON.parse(uncompressed.toString('utf-8'));
  } catch (err) {
    throw new Error(`خطا در خواندن فایل بایگانی: ${err instanceof Error ? err.message : String(err)}`);
  }

  const restoredCounts: Record<string, number> = {};

  // Restore in dependency order:
  // 1. Accounts first
  const restorationOrder = [
    'chart_of_accounts',
    'cash_funds',
    'bank_accounts',
    'customers',
    'favorite_customers',
    'transactions',
    'checks',
    'bank_transactions',
    'cash_transactions',
    'journal_entries',
    'journal_lines',
    'gemstone_inventory_transactions',
  ];

  db.transaction(() => {
    for (const tableName of restorationOrder) {
      const rows = payload.data[tableName];
      if (!Array.isArray(rows) || rows.length === 0) {
        restoredCounts[tableName] = 0;
        continue;
      }

      if (!tableExists(db, tableName)) {
        restoredCounts[tableName] = 0;
        continue;
      }

      restoredCounts[tableName] = insertRowsBatch(db, tableName, rows);
    }
  });

  // Update metadata status
  targetMeta.status = 'restored';
  targetMeta.restoredAt = new Date().toISOString();
  targetMeta.restoredBy = options.restoredBy;

  const metaPath = path.join(dir, `${targetMeta.cleanupId}.meta.json`);
  await fs.writeFile(metaPath, JSON.stringify(targetMeta, null, 2), 'utf-8');

  clearChartOfAccountsCache();

  return {
    metadata: targetMeta,
    restoredCounts,
  };
}
