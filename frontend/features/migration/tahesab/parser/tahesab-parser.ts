import fs from 'node:fs';
import zlib from 'node:zlib';
import { decompressZlibStream, detectTahesabBackup } from '../detector/tahesab-detector';

const CP1256_MAP = [
  /* 0x80 */ 0x20AC, 0x067E, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0686, 0x2039, 0x0631, 0x0632, 0x0698, 0x0688,
  /* 0x90 */ 0x06AF, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x06A9, 0x2122, 0x06AF, 0x203A, 0x06CC, 0x0688, 0x0688, 0x06C1,
  /* 0xA0 */ 0x00A0, 0x060C, 0x00A2, 0x00A3, 0x00A4, 0x00A5, 0x00A6, 0x00A7, 0x00A8, 0x00A9, 0x06BE, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x00AF,
  /* 0xB0 */ 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B4, 0x00B5, 0x00B6, 0x00B7, 0x00B8, 0x00B9, 0x061B, 0x00BB, 0x00BC, 0x00BD, 0x00BE, 0x061F,
  /* 0xC0 */ 0x06C0, 0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0626, 0x0627, 0x0628, 0x0629, 0x062A, 0x062B, 0x062C, 0x062D, 0x062E, 0x062F,
  /* 0xD0 */ 0x0630, 0x0631, 0x0632, 0x0633, 0x0634, 0x0635, 0x0636, 0x00D7, 0x0637, 0x0638, 0x0639, 0x063A, 0x0640, 0x0641, 0x0642, 0x0643,
  /* 0xE0 */ 0x0644, 0x0645, 0x0646, 0x0647, 0x0648, 0x0649, 0x064A, 0x064B, 0x064C, 0x064D, 0x064E, 0x064F, 0x0650, 0x0651, 0x0652, 0x0653,
  /* 0xF0 */ 0x0654, 0x0655, 0x0656, 0x0657, 0x0658, 0x0659, 0x065A, 0x065B, 0x065C, 0x065D, 0x065E, 0x065F, 0x0660, 0x0661, 0x0662, 0x0663,
];

function decodeCp1256(buf: Uint8Array): string {
  try {
    return new TextDecoder('windows-1256').decode(buf);
  } catch {
    let result = '';
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (b < 0x80) {
        result += String.fromCharCode(b);
      } else {
        const code = CP1256_MAP[b - 0x80] || b;
        result += String.fromCharCode(code);
      }
    }
    return result;
  }
}

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
        const isCacheSufficient = !cached.maxDetailRows || (typeof options.maxDetailRows === 'number' && cached.maxDetailRows >= options.maxDetailRows);
        if (isCacheSufficient) {
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
      const isCacheSufficient = !cached.maxDetailRows || (typeof options.maxDetailRows === 'number' && cached.maxDetailRows >= options.maxDetailRows);
      if (isCacheSufficient) {
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
  const sqlText = decodeCp1256(sqlBuffer);

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
