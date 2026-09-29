import fs from 'node:fs';
import zlib from 'node:zlib';
import type { TahesabArchiveEntry, TahesabBackupInfo } from '../types';

export const TAHESAB_MAGIC_VERSION = 15; // 0x0000000F

export interface DetectionResult {
  isTahesab: boolean;
  version?: string;
  backupInfo?: TahesabBackupInfo;
  entries: TahesabArchiveEntry[];
  totalFileSize: number;
  error?: string;
}

/**
 * Decompresses a single zlib stream from buffer starting at offset
 * and returns the decompressed bytes and count of compressed bytes consumed.
 */
export function decompressZlibStream(
  buffer: Buffer,
  offset: number,
): Promise<{ decompressed: Buffer; bytesConsumed: number }> {
  return new Promise((resolve, reject) => {
    const inflate = zlib.createInflate();
    const chunks: Buffer[] = [];

    inflate.on('data', (chunk: Buffer) => chunks.push(chunk));
    inflate.on('end', () => {
      resolve({
        decompressed: Buffer.concat(chunks),
        bytesConsumed: inflate.bytesRead,
      });
    });
    inflate.on('error', (err) => reject(err));

    inflate.end(buffer.subarray(offset));
  });
}

/**
 * Parses backUp.Info INI text into TahesabBackupInfo object.
 */
export function parseBackupInfo(infoText: string): TahesabBackupInfo {
  const lines = infoText.split(/\r?\n/);
  const map: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      map[key] = val;
    }
  }

  return {
    dateJalali: map['Info.Date'] || '',
    mohitCount: Number.parseInt(map['MohitCount'] || '1', 10),
    dbType: map['DB-TYPE'] || 'SQL',
    version: map['Version'] || '10.0',
    archiveCount: Number.parseInt(map['ArchiveCount'] || '0', 10),
    fromDateJalali: map['Mgold.db.FDate'],
    toDateJalali: map['Mgold.db.TDate'],
  };
}

/**
 * Detects whether a buffer or file path contains a valid Tahesab .Mcbk backup archive.
 */
export async function detectTahesabBackup(
  source: string | Buffer,
): Promise<DetectionResult> {
  try {
    let buffer: Buffer;
    if (typeof source === 'string') {
      if (!fs.existsSync(source)) {
        return {
          isTahesab: false,
          entries: [],
          totalFileSize: 0,
          error: `فایل پشتیبان در مسیر "${source}" یافت نشد.`,
        };
      }
      buffer = await fs.promises.readFile(source);
    } else {
      buffer = source;
    }

    if (buffer.length < 16) {
      return {
        isTahesab: false,
        entries: [],
        totalFileSize: buffer.length,
        error: 'حجم فایل برای بررسی ساختار ته‌حساب بسیار کم است.',
      };
    }

    const magic = buffer.readUInt32LE(0);
    if (magic !== TAHESAB_MAGIC_VERSION) {
      return {
        isTahesab: false,
        entries: [],
        totalFileSize: buffer.length,
        error: `هدر جادویی فایل (${magic}) با ساختار استاندارد ته‌حساب (نسخه 15) همخوانی ندارد.`,
      };
    }

    const entries: TahesabArchiveEntry[] = [];
    let pos = 4;
    let backupInfoText: string | undefined;

    while (pos < buffer.length) {
      if (pos + 8 > buffer.length) break;

      const nameLen = buffer.readUInt32LE(pos);
      pos += 4;
      if (pos + nameLen + 4 > buffer.length) break;

      const name = buffer.toString('latin1', pos, pos + nameLen);
      pos += nameLen;

      const uncompressedSize = buffer.readUInt32LE(pos);
      pos += 4;

      const entryOffset = pos;
      const { decompressed, bytesConsumed } = await decompressZlibStream(buffer, pos);
      pos += bytesConsumed;

      entries.push({
        name,
        uncompressedSize,
        compressedSize: bytesConsumed,
        offset: entryOffset,
      });

      if (name.toLowerCase() === 'backup.info') {
        backupInfoText = decompressed.toString('utf-8');
      }
    }

    const hasMainDb = entries.some(
      (e) => e.name.toLowerCase() === 'bkup1.mbk' || e.name.toLowerCase() === 'xdb.sql',
    );

    if (!hasMainDb) {
      return {
        isTahesab: false,
        entries,
        totalFileSize: buffer.length,
        error: 'آرشیو ته‌حساب فاقد دیتابیس مالی اصلی (BkUp1.Mbk / xDB.SQL) می‌باشد.',
      };
    }

    const backupInfo = backupInfoText
      ? parseBackupInfo(backupInfoText)
      : {
          mohitCount: 1,
          dbType: 'SQL',
          version: '10.0',
          archiveCount: 0,
        };

    return {
      isTahesab: true,
      version: backupInfo.version,
      backupInfo,
      entries,
      totalFileSize: buffer.length,
    };
  } catch (err) {
    return {
      isTahesab: false,
      entries: [],
      totalFileSize: 0,
      error: `خطا در آنالیز فایل پشتیبان ته‌حساب: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
