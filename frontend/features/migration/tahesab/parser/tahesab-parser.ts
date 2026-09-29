import fs from 'node:fs';
import zlib from 'node:zlib';
import { decompressZlibStream, detectTahesabBackup } from '../detector/tahesab-detector';

const cp1256Decoder = new TextDecoder('windows-1256');

/**
 * Normalizes Persian characters:
 * - Arabic Kaf (ك) -> Persian Kaf (ک)
 * - Arabic Yeh (ي) -> Persian Yeh (ی)
 * - Removes non-printable control characters
 */
export function normalizePersianText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    .replace(/\u064A/g, '\u06CC') // ي -> ی
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .trim();
}

/**
 * Parses SQL literal values from the inside of a VALUES (...) clause.
 * Respects N'...' and '...' strings with doubled-quote escapes (''), numeric values, and NULL.
 */
export function parseSqlValues(valStr: string): Array<string | null> {
  const tokens: Array<string | null> = [];
  let i = 0;
  const n = valStr.length;

  while (i < n) {
    while (i < n && (valStr[i] === ' ' || valStr[i] === '\t' || valStr[i] === '\r' || valStr[i] === '\n')) {
      i++;
    }
    if (i >= n) break;

    if (valStr[i] === 'N' && i + 1 < n && valStr[i + 1] === "'") {
      i++; // skip 'N' prefix for unicode string
    }

    if (valStr[i] === "'") {
      i++; // skip opening quote
      let s = '';
      while (i < n) {
        if (valStr[i] === "'") {
          if (i + 1 < n && valStr[i + 1] === "'") {
            s += "'";
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          s += valStr[i];
          i++;
        }
      }
      tokens.push(normalizePersianText(s));

      while (i < n && (valStr[i] === ' ' || valStr[i] === '\t' || valStr[i] === '\r' || valStr[i] === '\n')) {
        i++;
      }
      if (i < n && valStr[i] === ',') {
        i++;
      }
    } else {
      let j = i;
      while (j < n && valStr[j] !== ',') {
        j++;
      }
      const rawTok = valStr.slice(i, j).trim();
      if (rawTok.toUpperCase() === 'NULL' || rawTok === '') {
        tokens.push(null);
      } else {
        tokens.push(rawTok);
      }
      i = j + 1;
    }
  }

  return tokens;
}

export type RawTableRow = Record<string, string | null>;

export interface TahesabRawDatabase {
  moshtarian: RawTableRow[];
  hesab: RawTableRow[];
  hesab_detail: RawTableRow[];
  Hesab_bank: RawTableRow[];
  bank: RawTableRow[];
  Sekeh_Shemsh: RawTableRow[];
  Sang: RawTableRow[];
  raygiri: RawTableRow[];
  khar_sakhte: RawTableRow[];
  Cities: RawTableRow[];
  Hazine_Baabat: RawTableRow[];
  gorooh: RawTableRow[];
  otherTables: Record<string, RawTableRow[]>;
}

export interface ParseBackupOptions {
  maxDetailRows?: number;
  maxKharSakhteRows?: number;
  tablesToInclude?: string[];
  onProgress?: (progressText: string, percent: number) => void;
}

interface ParserCacheItem {
  rawDb: TahesabRawDatabase;
  stats: Record<string, number>;
  maxDetailRows?: number;
}

const parserCache = new Map<string, ParserCacheItem>();

/**
 * Extracts and parses all SQL tables from Tahesab .Mcbk backup.
 * High-speed caching for repetitive batch chunks.
 */
export async function parseTahesabBackup(
  source: string | Buffer,
  options: ParseBackupOptions = {},
): Promise<{
  rawDb: TahesabRawDatabase;
  stats: Record<string, number>;
}> {
  let cacheKey = '';
  if (typeof source === 'string') {
    try {
      const st = fs.statSync(source);
      cacheKey = `${source}:${st.size}:${st.mtimeMs}`;
      const cached = parserCache.get(cacheKey);
      if (cached) {
        if (!options.maxDetailRows || (cached.maxDetailRows && cached.maxDetailRows >= options.maxDetailRows)) {
          return { rawDb: cached.rawDb, stats: cached.stats };
        }
      }
    } catch {
      // ignore
    }
  } else if (Buffer.isBuffer(source)) {
    cacheKey = `buf:${source.length}:${source.readUInt32LE(0)}:${source.readUInt32LE(Math.max(0, source.length - 8))}`;
    const cached = parserCache.get(cacheKey);
    if (cached) {
      if (!options.maxDetailRows || (cached.maxDetailRows && cached.maxDetailRows >= options.maxDetailRows)) {
        return { rawDb: cached.rawDb, stats: cached.stats };
      }
    }
  }

  let buffer: Buffer;
  if (typeof source === 'string') {
    buffer = await fs.promises.readFile(source);
  } else {
    buffer = source;
  }

  const detection = await detectTahesabBackup(buffer);
  if (!detection.isTahesab) {
    throw new Error(detection.error || 'فایل انتخاب‌شده آرشیو معتبر ته‌حساب نیست.');
  }

  options.onProgress?.('در حال استخراج کانتینر فایل‌های پشتیبان...', 10);

  // Extract entries
  const entriesData: Record<string, Buffer> = {};
  let pos = 4;
  while (pos < buffer.length) {
    if (pos + 8 > buffer.length) break;
    const nameLen = buffer.readUInt32LE(pos);
    pos += 4;
    const name = buffer.toString('latin1', pos, pos + nameLen);
    pos += nameLen;
    pos += 4; // skip uncompressedSize field

    const { decompressed, bytesConsumed } = await decompressZlibStream(buffer, pos);
    pos += bytesConsumed;
    entriesData[name.toLowerCase()] = decompressed;
  }

  options.onProgress?.('در حال استخراج پایگاه داده اصلی مالی (BkUp1)...', 25);

  const rawDb: TahesabRawDatabase = {
    moshtarian: [],
    hesab: [],
    hesab_detail: [],
    Hesab_bank: [],
    bank: [],
    Sekeh_Shemsh: [],
    Sang: [],
    raygiri: [],
    khar_sakhte: [],
    Cities: [],
    Hazine_Baabat: [],
    gorooh: [],
    otherTables: {},
  };

  const stats: Record<string, number> = {};

  // Find primary database script: BkUp1.Mbk or xDB.SQL
  let sqlBuffer: Buffer | null = null;
  if (entriesData['bkup1.mbk']) {
    try {
      sqlBuffer = zlib.inflateSync(entriesData['bkup1.mbk']);
    } catch {
      sqlBuffer = entriesData['bkup1.mbk'];
    }
  } else if (entriesData['xdb.sql']) {
    sqlBuffer = entriesData['xdb.sql'];
  }

  if (!sqlBuffer) {
    throw new Error('دیتابیس اصلی مالی در آرشیو ته‌حساب یافت نشد.');
  }

  options.onProgress?.('در حال تجزیه دستورات و ساختارهای داده...', 40);

  // Decode SQL script using Windows-1256 (CP1256)
  const sqlText = cp1256Decoder.decode(sqlBuffer);

  // Regex to extract INSERT statements (supporting multi-line VALUES)
  const insertRegex = /INSERT\s+INTO\s+([^\s\(]+)\s*\(([^\)]+)\)\s*VALUES\s*\(([\s\S]*?)\);\r?\n/gi;

  const tableColumnMap: Record<string, string[]> = {};
  let match: RegExpExecArray | null = null;
  let totalProcessed = 0;

  while ((match = insertRegex.exec(sqlText)) !== null) {
    totalProcessed++;
    const rawTableName = match[1].replace(/[\[\]"']/g, '').trim();
    const rawCols = match[2];
    const rawVals = match[3];

    if (!tableColumnMap[rawTableName]) {
      tableColumnMap[rawTableName] = rawCols
        .split(',')
        .map((c) => c.replace(/[\[\]"']/g, '').trim());
    }

    const colNames = tableColumnMap[rawTableName];
    const colValues = parseSqlValues(rawVals);

    const row: RawTableRow = {};
    for (let c = 0; c < colNames.length; c++) {
      row[colNames[c]] = c < colValues.length ? colValues[c] : null;
    }

    // Direct routing to typed collections
    switch (rawTableName.toLowerCase()) {
      case 'moshtarian':
        rawDb.moshtarian.push(row);
        break;
      case 'hesab':
        rawDb.hesab.push(row);
        break;
      case 'hesab_detail':
        if (!options.maxDetailRows || rawDb.hesab_detail.length < options.maxDetailRows) {
          rawDb.hesab_detail.push(row);
        }
        break;
      case 'hesab_bank':
        rawDb.Hesab_bank.push(row);
        break;
      case 'bank':
        rawDb.bank.push(row);
        break;
      case 'sekeh_shemsh':
        rawDb.Sekeh_Shemsh.push(row);
        break;
      case 'sang':
        rawDb.Sang.push(row);
        break;
      case 'raygiri':
        rawDb.raygiri.push(row);
        break;
      case 'khar_sakhte':
        if (!options.maxKharSakhteRows || rawDb.khar_sakhte.length < options.maxKharSakhteRows) {
          rawDb.khar_sakhte.push(row);
        }
        break;
      case 'cities':
        rawDb.Cities.push(row);
        break;
      case 'hazine_baabat':
        rawDb.Hazine_Baabat.push(row);
        break;
      case 'gorooh':
        rawDb.gorooh.push(row);
        break;
      default:
        if (!rawDb.otherTables[rawTableName]) {
          rawDb.otherTables[rawTableName] = [];
        }
        rawDb.otherTables[rawTableName].push(row);
        break;
    }

    stats[rawTableName] = (stats[rawTableName] || 0) + 1;
  }

  options.onProgress?.('پارس دیتابیس ته‌حساب با موفقیت انجام شد.', 60);

  if (cacheKey) {
    parserCache.set(cacheKey, {
      rawDb,
      stats,
      maxDetailRows: options.maxDetailRows,
    });
  }

  return { rawDb, stats };
}
