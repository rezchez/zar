import { formatJalaliDate, gregorianToJalali } from '@/lib/jalali';
import { normalizePersianDigits } from '@/lib/normalize-persian-digits';
import type { TahesabRawDatabase, RawTableRow } from '../parser/tahesab-parser';
import type {
  NormalizedMigrationData,
  NormalizedParty,
  NormalizedDocument,
  NormalizedDocumentLine,
  NormalizedBankAccount,
  NormalizedCoin,
  NormalizedGemstone,
  NormalizedAssayLab,
  NormalizedInventoryItem,
  TahesabBackupInfo,
} from '../types';

function parseNum(val: string | null | undefined, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(normalizePersianDigits(val).replace(/,/g, ''));
  return Number.isFinite(num) ? num : fallback;
}

function parseText(val: string | null | undefined): string {
  if (!val) return '';
  return val.trim();
}

function dateToJalaliString(d: Date): string {
  try {
    const res = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const m = String(res.month).padStart(2, '0');
    const day = String(res.day).padStart(2, '0');
    return `${res.year}/${m}/${day}`;
  } catch {
    return '';
  }
}

const normalizerCache = new WeakMap<TahesabRawDatabase, NormalizedMigrationData>();

/**
 * Normalizes Tahesab raw database into standard migration models.
 * Memoized via WeakMap for sub-millisecond retrieval on repetitive chunked calls.
 */
export function normalizeTahesabData(
  rawDb: TahesabRawDatabase,
  backupInfo: TahesabBackupInfo,
): NormalizedMigrationData {
  const cached = normalizerCache.get(rawDb);
  if (cached) {
    return cached;
  }

  // 1. Normalize Parties (moshtarian)
  const parties: NormalizedParty[] = [];
  const seenPartyCodes = new Set<string>();

  for (const row of rawDb.moshtarian) {
    const name = parseText(row.name);
    const code = parseText(row.code);
    if (!name || seenPartyCodes.has(code)) continue;
    seenPartyCodes.add(code);

    const goldBal = parseNum(row.tahesabtala, 0);
    const rialBal = Math.round(parseNum(row.tahesabriali, 0));

    parties.push({
      sourceCode: code,
      name,
      phone1: parseText(row.Tel),
      phone2: parseText(row.Tel2),
      address: parseText(row.add),
      city: parseText(row.City),
      postalCode: parseText(row.PostalCode),
      groupName: parseText(row.gorooh),
      groupId: parseText(row.GID),
      openingGoldWeight: goldBal,
      openingRialBalance: rialBal,
      currency: parseText(row.Arz) || 'IRR',
      raw: row,
    });
  }

  // 2. Normalize Bank Accounts (Hesab_bank)
  const bankAccounts: NormalizedBankAccount[] = [];
  for (const row of rawDb.Hesab_bank) {
    const bankName = parseText(row.n_bank);
    const accNumber = parseText(row.Sh_Hesab);
    if (!bankName && !accNumber) continue;

    const opBal = Math.round(parseNum(row.MojoodiA, 0));
    const curBal = Math.round(parseNum(row.MoJoodi, 0));

    bankAccounts.push({
      bankName: bankName || 'بانک نامشخص',
      accountNumber: accNumber || 'بدون شماره',
      openingBalanceIrr: opBal,
      currentBalanceIrr: curBal,
      openingDateIso: parseText(row.tarikh_Eftetah),
      raw: row,
    });
  }

  // 3. Normalize Coins & Bars (Sekeh_Shemsh)
  const coins: NormalizedCoin[] = [];
  for (const row of rawDb.Sekeh_Shemsh) {
    const name = parseText(row.N);
    if (!name) continue;
    coins.push({
      name,
      weight: parseNum(row.Vazn, 0),
      grade: parseNum(row.ayar, 900),
      isBar: row.Shemsh === '-1' || parseText(row.Shemsh).toLowerCase() === 'true',
      raw: row,
    });
  }

  // 4. Normalize Gemstones (Sang)
  const gemstones: NormalizedGemstone[] = [];
  for (const row of rawDb.Sang) {
    const nameFa = parseText(row.N);
    if (!nameFa) continue;
    gemstones.push({
      nameFa,
      nameEn: parseText(row.EnName),
      raw: row,
    });
  }

  // 5. Normalize Assay Laboratories (raygiri)
  const assayLabs: NormalizedAssayLab[] = [];
  for (const row of rawDb.raygiri) {
    const name = parseText(row.name);
    if (!name) continue;
    assayLabs.push({
      name,
      phone: parseText(row.Tel),
      address: parseText(row.Add),
      raw: row,
    });
  }

  // 6. Normalize Inventory Items (khar_sakhte)
  const inventory: NormalizedInventoryItem[] = [];
  for (const row of rawDb.khar_sakhte) {
    const code = parseText(row.Code);
    const name = parseText(row.name);
    if (!code && !name) continue;
    inventory.push({
      code,
      name: name || `کالای ${code}`,
      weight: parseNum(row.Vazn, 0),
      grade: parseNum(row.Ayar, 750),
      wagePercent: parseNum(row.Darsad, 0),
      raw: row,
    });
  }

  // 7. Group Detail Lines by Factor_Code
  const detailsByFactor = new Map<string, RawTableRow[]>();
  for (const dRow of rawDb.hesab_detail) {
    const factorCode = parseText(dRow.Factor_Code);
    if (!factorCode) continue;
    let list = detailsByFactor.get(factorCode);
    if (!list) {
      list = [];
      detailsByFactor.set(factorCode, list);
    }
    list.push(dRow);
  }

  // 8. Normalize Documents & Lines (hesab + hesab_detail)
  const documents: NormalizedDocument[] = [];

  for (const hRow of rawDb.hesab) {
    const factorCode = parseText(hRow.Factor_Code);
    if (!factorCode) continue;

    const sourceCustCode = parseText(hRow.mcode);
    const rawDate = parseText(hRow.Tarikh);
    let dateIso = rawDate;
    let dateJalali = '';

    if (rawDate) {
      try {
        const d = new Date(rawDate.replace(' ', 'T'));
        if (!Number.isNaN(d.getTime())) {
          dateIso = d.toISOString();
          dateJalali = dateToJalaliString(d);
        } else {
          dateJalali = '';
        }
      } catch {
        dateJalali = '';
      }
    }

    const metalCode = parseText(hRow.Jens_Felez);
    const metalType = metalCode === '2' ? 'silver' : 'gold';
    const currency = parseText(hRow.Arz) || 'IRR';

    const childDetailRows = detailsByFactor.get(factorCode) || [];
    const lines: NormalizedDocumentLine[] = [];

    let lineSeq = 0;
    for (const dRow of childDetailRows) {
      lineSeq++;
      const vazn = parseNum(dRow.vazn, 0);
      const ayar = parseNum(dRow.ayar, metalType === 'silver' ? 999 : 750);
      const tv = parseNum(dRow.tabdil750_v, 0);
      const tkh = parseNum(dRow.tabdil750_kh, 0);
      const rv = Math.round(parseNum(dRow.rial_V, 0));
      const rkh = Math.round(parseNum(dRow.rial_kh, 0));

      const converted750 = tv > 0 ? tv : tkh > 0 ? tkh : vazn > 0 ? Math.round((vazn * ayar) / 750 * 1000) / 1000 : 0;
      const amountIrr = rv > 0 ? rv : rkh > 0 ? rkh : 0;

      const nature: 'received' | 'paid' = tv > 0 || rv > 0 ? 'received' : 'paid';

      // Check Command for transfer tokens
      const cmd = parseText(dRow.Command);
      let transferToken: string | undefined;
      let transferSide: 'source' | 'destination' | undefined;

      if (cmd.startsWith('#HAVALEH#')) {
        transferSide = 'source';
        transferToken = cmd.replace('#HAVALEH#', '');
      } else if (cmd.startsWith('#hshbe#')) {
        transferSide = 'destination';
        transferToken = cmd.replace('#hshbe#', '');
      }

      // Check conditional gold and assay receipt
      const shSharti = parseText(dRow.sh_sharti);
      const isAbshode = dRow.Abshode === '-1' || parseText(dRow.Abshode).toLowerCase() === 'true';
      const isConditional = (shSharti !== '' && shSharti !== '0') || isAbshode;

      let kind: NormalizedDocumentLine['kind'] = 'general_metal';
      if (transferToken) {
        kind = 'claim';
      } else if (isAbshode) {
        kind = 'melted';
      } else if (isConditional) {
        kind = 'conditional';
      } else if (amountIrr > 0 && vazn === 0) {
        kind = 'cash';
      } else if (parseText(dRow.Arz) === 'USD') {
        kind = 'currency';
      }

      const foreignAmt = parseText(dRow.Arz) === 'USD' ? parseNum(dRow.rial_V || dRow.rial_kh, 0) : undefined;

      lines.push({
        sourceFactorCode: factorCode,
        lineNumber: lineSeq,
        dateIso,
        dateJalali,
        nature,
        kind,
        metalType: vazn > 0 ? metalType : 'none',
        weight: vazn,
        grade: ayar,
        convertedWeight750: converted750,
        amountIrr,
        foreignAmount: foreignAmt,
        foreignCurrency: foreignAmt ? 'USD' : undefined,
        assayStampNumber: shSharti || undefined,
        transferToken,
        transferSide,
        transferPartnerName: parseText(dRow.name_az) || undefined,
        description: parseText(dRow.Sharh) || parseText(dRow.NO_kar),
        isConditional,
        raw: dRow,
      });
    }

    documents.push({
      sourceFactorCode: factorCode,
      documentNumber: parseText(hRow.sh_factor) || factorCode,
      sourceCustomerCode: sourceCustCode,
      dateIso,
      dateJalali,
      totalGoldIn: parseNum(hRow.geram_v, 0),
      totalGoldOut: parseNum(hRow.geram_kh, 0),
      totalRialIn: Math.round(parseNum(hRow.rial_v, 0)),
      totalRialOut: Math.round(parseNum(hRow.rial_kh, 0)),
      currency,
      metalType,
      lines,
      raw: hRow,
    });
  }

  const result: NormalizedMigrationData = {
    backupInfo,
    parties,
    documents,
    bankAccounts,
    coins,
    gemstones,
    assayLabs,
    inventory,
  };

  normalizerCache.set(rawDb, result);
  return result;
}
