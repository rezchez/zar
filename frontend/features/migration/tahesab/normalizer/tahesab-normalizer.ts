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

    const goldBal = parseNum(row.JamV_T || row.tahesabtala, 0);
    const rialBal = Math.round(parseNum(row.JamV_P || row.tahesabriali, 0));

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

    const headerMetalCode = parseText(hRow.Jens_Felez);
    const docMetalType = headerMetalCode === '2' ? 'silver' : 'gold';
    const currency = parseText(hRow.Arz) || 'IRR';

    const childDetailRows = detailsByFactor.get(factorCode) || [];
    const lines: NormalizedDocumentLine[] = [];

    let lineSeq = 0;
    for (const dRow of childDetailRows) {
      lineSeq++;
      const vazn = parseNum(dRow.vazn, 0);
      const rowNo = parseText(dRow.no);
      const dSharh = parseText(dRow.Sharh);
      const dNoKar = parseText(dRow.NO_kar);
      const isStone = rowNo.includes('سنگ') || dNoKar.includes('سنگ') || dSharh.includes('سنگ');

      const dJens = parseText(dRow.Jens_Felez);
      const metalCode = dJens || headerMetalCode;
      const rawAyar = parseNum(dRow.ayar, 0);

      const isSilver =
        metalCode === '2' ||
        rawAyar === 925 ||
        dSharh.includes('نقره') ||
        dNoKar.includes('نقره') ||
        parseText(hRow.Rec).includes('نقره');

      const tv = parseNum(dRow.tabdil750_v, 0);
      const tkh = parseNum(dRow.tabdil750_kh, 0);
      const rv = Math.round(parseNum(dRow.rial_V, 0));
      const rkh = Math.round(parseNum(dRow.rial_kh, 0));

      const tabdil = tv > 0 ? tv : tkh > 0 ? tkh : 0;
      let ayar = rawAyar;

      let metalType: 'gold' | 'silver' | 'none' = 'none';
      if (tabdil > 0) {
        metalType = isSilver ? 'silver' : 'gold';
        if (ayar <= 0 && vazn > 0) {
          const baseKaratForDeduction = metalType === 'silver' ? 925 : 750;
          ayar = Math.round((tabdil * baseKaratForDeduction) / vazn);
        } else if (ayar <= 0) {
          ayar = metalType === 'silver' ? 999 : 750;
        }
      } else if (isStone || rowNo.includes('کالا') || dNoKar.includes('رزین')) {
        metalType = 'none';
      } else if (isSilver) {
        metalType = 'silver';
      } else if (vazn > 0 && !rowNo.includes('وجه') && !rowNo.includes('بانک') && !rowNo.includes('ارز')) {
        metalType = 'gold';
      }

      const baseKaratForConv = metalType === 'silver' ? 999 : 750;
      const converted750 = tabdil > 0
        ? tabdil
        : (vazn > 0 && ayar > 0 && !isStone && metalType !== 'none')
        ? Math.round(((vazn * ayar) / baseKaratForConv) * 1000) / 1000
        : 0;

      const isUsd = parseText(dRow.Arz) === 'USD' || parseText(hRow.Arz) === 'USD';
      const foreignAmt = isUsd ? parseNum(dRow.rial_V || dRow.rial_kh, 0) : undefined;
      const amountIrr = !isUsd ? (rv > 0 ? rv : rkh > 0 ? rkh : 0) : 0;

      // Determine Gold Direction (ورود / خروج)
      let goldNature: 'received' | 'paid' | 'none' = 'none';
      if (metalType === 'none' || converted750 === 0) {
        goldNature = 'none';
      } else if (tv > 0) {
        goldNature = 'received';
      } else if (tkh > 0) {
        goldNature = 'paid';
      } else if (converted750 > 0) {
        if (rowNo.includes('ورود') || rowNo.includes('خرید') || rowNo.includes('بدهی')) {
          goldNature = 'received';
        } else if (rowNo.includes('خروج') || rowNo.includes('فروش') || rowNo.includes('طلب') || rowNo.includes('درصد')) {
          goldNature = 'paid';
        } else if (parseNum(hRow.geram_v, 0) > 0) {
          goldNature = 'received';
        } else if (parseNum(hRow.geram_kh, 0) > 0) {
          goldNature = 'paid';
        } else {
          goldNature = 'received';
        }
      }

      // Determine Money Direction (ورود / خروج)
      let moneyNature: 'received' | 'paid' | 'none' = 'none';
      if (rv > 0) {
        moneyNature = 'received';
      } else if (rkh > 0) {
        moneyNature = 'paid';
      } else if (amountIrr > 0 || (foreignAmt && foreignAmt > 0)) {
        if (rowNo.includes('ورود') || rowNo.includes('خرید') || rowNo.includes('بدهی')) {
          moneyNature = 'received';
        } else if (rowNo.includes('خروج') || rowNo.includes('فروش') || rowNo.includes('طلب')) {
          moneyNature = 'paid';
        } else if (parseNum(hRow.rial_v, 0) > 0) {
          moneyNature = 'received';
        } else if (parseNum(hRow.rial_kh, 0) > 0) {
          moneyNature = 'paid';
        } else {
          moneyNature = 'received';
        }
      }

      const signedGoldAmount = goldNature === 'received' ? converted750 : goldNature === 'paid' ? -converted750 : 0;
      const signedRialAmount = moneyNature === 'received' ? amountIrr : moneyNature === 'paid' ? -amountIrr : 0;
      const signedForeignAmount = foreignAmt ? (moneyNature === 'received' ? foreignAmt : -foreignAmt) : 0;

      const nature: 'received' | 'paid' =
        goldNature === 'received' || moneyNature === 'received' ? 'received' : 'paid';

      // Party side in double-entry:
      // If customer brings gold or pays cash -> customer is Creditor (بستانکار)
      // If customer receives gold or gets cash, or is charged for goods/services -> customer is Debtor (بدهکار)
      const partySide: 'debtor' | 'creditor' =
        (moneyNature === 'received' || (moneyNature === 'none' && goldNature === 'received')) ? 'creditor' : 'debtor';

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
      const isConditional = shSharti !== '' && shSharti !== '0';

      let kind: NormalizedDocumentLine['kind'] = 'general_metal';
      if (transferToken) {
        kind = 'claim';
      } else if (isConditional) {
        kind = 'conditional';
      } else if (isAbshode) {
        kind = 'melted';
      } else if (isUsd || rowNo.includes('ارز')) {
        kind = 'currency';
      } else if (amountIrr > 0 && vazn === 0) {
        kind = 'cash';
      } else if (rowNo.includes('فروش')) {
        kind = 'sale';
      } else if (rowNo.includes('خرید')) {
        kind = 'purchase';
      } else if (rowNo.includes('درصد') || rowNo.includes('اجرت')) {
        kind = 'wage';
      } else if (rowNo === 'از قبل') {
        kind = 'opening';
      }

      lines.push({
        sourceFactorCode: factorCode,
        lineNumber: lineSeq,
        dateIso,
        dateJalali,
        nature,
        kind,
        metalType,
        weight: vazn,
        grade: ayar,
        convertedWeight750: converted750,
        amountIrr,
        foreignAmount: foreignAmt,
        foreignCurrency: foreignAmt ? 'USD' : undefined,
        assayStampNumber: shSharti || undefined,
        assayLabName: parseText(dRow.name_az) || undefined,
        transferToken,
        transferSide,
        transferPartnerName: parseText(dRow.name_az) || undefined,
        description: parseText(dRow.Sharh) || parseText(dRow.NO_kar),
        isConditional,
        signedGoldAmount,
        signedRialAmount,
        signedForeignAmount,
        goldNature,
        moneyNature,
        partySide,
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
      metalType: docMetalType,
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
