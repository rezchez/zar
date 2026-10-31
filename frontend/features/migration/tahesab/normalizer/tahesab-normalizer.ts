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

function cleanDescription(text: string): string {
  if (!text) return '';
  return text.replace(/#DSD\d+/gi, '').replace(/\s+/g, ' ').trim();
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
      secondaryCurrency: parseText(row.Arz2) || undefined,
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
  for (const row of (rawDb.khar_sakhte || [])) {
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

  const partyMapByCode = new Map<string, NormalizedParty>();
  for (const p of parties) {
    partyMapByCode.set(p.sourceCode, p);
  }

  const bankMapByName = new Map<string, string>();
  for (const b of rawDb.Hesab_bank) {
    const bName = parseText(b.n_bank);
    const acc = parseText(b.Sh_Hesab);
    if (bName && acc) {
      bankMapByName.set(bName, acc);
    }
  }

  const allCurrencies = new Set<string>(['IRR', 'USD']);
  for (const p of parties) {
    if (p.currency && p.currency !== 'IRR') allCurrencies.add(p.currency.toUpperCase());
    if (p.secondaryCurrency && p.secondaryCurrency !== 'IRR') allCurrencies.add(p.secondaryCurrency.toUpperCase());
  }

  for (const hRow of rawDb.hesab) {
    const factorCode = parseText(hRow.Factor_Code);
    if (!factorCode) continue;

    const sourceCustCode = parseText(hRow.mcode) || parseText(hRow.code);
    const rawDate = parseText(hRow.Tarikh) || parseText(hRow.tarikh);
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

    const isDocOpening =
      sourceCustCode === '0' ||
      parseText(hRow.SanadType) === '9' ||
      parseText(hRow.sh_factor) === '0' ||
      parseText(hRow.Rec).includes('موجودی اول') ||
      parseText(hRow.Rec).includes('اولیه');

    const headerMetalCode = parseText(hRow.Jens_Felez);
    const docMetalType = headerMetalCode === '2' ? 'silver' : 'gold';
    const currency = parseText(hRow.Arz) || 'IRR';

    const customerParty = partyMapByCode.get(sourceCustCode);
    const customerSecondaryCurrency =
      customerParty?.secondaryCurrency ||
      (customerParty?.currency && customerParty.currency !== 'IRR' ? customerParty.currency : undefined);
    const customerNameCurrency =
      customerParty?.name?.includes('دلار') || parseText(hRow.Rec).includes('دلار')
        ? 'USD'
        : customerParty?.name?.includes('یورو') || parseText(hRow.Rec).includes('یورو')
        ? 'EUR'
        : customerParty?.name?.includes('درهم') || parseText(hRow.Rec).includes('درهم')
        ? 'AED'
        : customerParty?.name?.includes('لیر') || parseText(hRow.Rec).includes('لیر')
        ? 'TRY'
        : customerParty?.name?.includes('پوند') || parseText(hRow.Rec).includes('پوند')
        ? 'GBP'
        : undefined;

    const customerCurrencyHint = customerSecondaryCurrency || customerNameCurrency;

    let docForeignCurrency =
      parseText(hRow.Arz2) ||
      (parseText(hRow.Arz) && parseText(hRow.Arz) !== 'IRR' ? parseText(hRow.Arz) : undefined) ||
      customerCurrencyHint;
    let docForeignTradeAmount: number | undefined;

    const childDetailRows = detailsByFactor.get(factorCode) || [];

    for (const dRow of childDetailRows) {
      const dNo = parseText(dRow.no);
      const dArz = parseText(dRow.Arz);
      const dNoKar = parseText(dRow.NO_kar);
      const dSharh = parseText(dRow.Sharh);

      if (dArz && dArz !== 'IRR') {
        docForeignCurrency = dArz.toUpperCase();
        allCurrencies.add(dArz.toUpperCase());
      } else if (dNoKar && ['USD', 'EUR', 'AED', 'GBP', 'TRY', 'IQD'].includes(dNoKar.toUpperCase())) {
        docForeignCurrency = dNoKar.toUpperCase();
        allCurrencies.add(dNoKar.toUpperCase());
      } else if (dSharh.includes('دلار') || dNo.includes('دلار')) {
        docForeignCurrency = 'USD';
      } else if (dSharh.includes('یورو') || dNo.includes('یورو')) {
        docForeignCurrency = 'EUR';
      } else if (dSharh.includes('درهم') || dNo.includes('درهم')) {
        docForeignCurrency = 'AED';
      }

      if (dNo.includes('خرید ارز') || dNo.includes('فروش ارز')) {
        const rawCount = parseNum(dRow.Count, 0);
        if (rawCount > 0) docForeignTradeAmount = rawCount;
        if (!docForeignCurrency) docForeignCurrency = 'USD';
      }
    }

    // 1. Detect offsetting error pairs in factors with currency trades (e.g. Factor 2 Shahin Zeinali)
    const hasCurrencyTrade = childDetailRows.some((r) => {
      const no = parseText(r.no);
      return no.includes('خرید ارز') || no.includes('فروش ارز');
    });

    const errorPairRowIndices = new Set<number>();
    if (hasCurrencyTrade) {
      for (let idxA = 0; idxA < childDetailRows.length; idxA++) {
        const rowA = childDetailRows[idxA];
        const noA = parseText(rowA.no);
        const sharhA = parseText(rowA.Sharh);
        const isClaimOrDebtA = (noA === 'طلب' || noA === 'بدهی') && (sharhA.includes('#DSD') || Boolean(docForeignTradeAmount));
        if (!isClaimOrDebtA) continue;

        const amtA = parseNum(rowA.rial_V, 0) || parseNum(rowA.rial_kh, 0);
        if (amtA <= 0) continue;

        for (let idxB = 0; idxB < childDetailRows.length; idxB++) {
          if (idxA === idxB || errorPairRowIndices.has(idxB)) continue;
          const rowB = childDetailRows[idxB];
          const noB = parseText(rowB.no);
          const isCashB = noB.includes('وجه نقد') && !noB.includes('بانک');
          if (!isCashB) continue;

          const amtB = parseNum(rowB.rial_V, 0) || parseNum(rowB.rial_kh, 0);
          if (Math.abs(amtA - amtB) < 0.001) {
            errorPairRowIndices.add(idxA);
            errorPairRowIndices.add(idxB);
            break;
          }
        }
      }
    }

    // 2. Detect Manufactured Gold percentage wage lines to merge into base item (e.g. Factor 1 Mrs. Tavakol)
    interface MergedWageInfo {
      wagePercent: number;
      wageGoldWeight: number;
    }
    const wageByTargetIndex = new Map<number, MergedWageInfo>();
    const consumedWageRowIndices = new Set<number>();

    for (let i = 0; i < childDetailRows.length; i++) {
      if (errorPairRowIndices.has(i)) continue;
      const r = childDetailRows[i];
      const rNo = parseText(r.no);
      const rSharh = parseText(r.Sharh);
      const isPercentWage =
        Boolean(rNo.match(/^(\d+(?:\/\d+)?)\s*درصد$/)) ||
        (parseNum(r.vazn, 0) > 0 && rSharh.includes('#DSD') && !rNo.includes('کارساخته'));

      if (isPercentWage) {
        let targetIdx = -1;
        const dsdMatch = rSharh.match(/#DSD(\d+)/i);
        if (dsdMatch) {
          const dsdNum = parseInt(dsdMatch[1], 10);
          if (dsdNum >= 1 && dsdNum <= childDetailRows.length) {
            targetIdx = dsdNum - 1;
          }
        }
        if (targetIdx === -1) {
          for (let prev = i - 1; prev >= 0; prev--) {
            const prevNo = parseText(childDetailRows[prev].no);
            if (prevNo.includes('کارساخته')) {
              targetIdx = prev;
              break;
            }
          }
        }

        if (targetIdx !== -1) {
          const percentMatch = rNo.match(/^(\d+(?:\/\d+)?)\s*درصد$/);
          const wagePercent = percentMatch
            ? parseFloat(percentMatch[1].replace('/', '.'))
            : parseNum(childDetailRows[targetIdx].Darsad, 0);

          const wageWeight = parseNum(r.tabdil750_kh || r.tabdil750_v || r.vazn, 0);

          const existing = wageByTargetIndex.get(targetIdx) || { wagePercent: 0, wageGoldWeight: 0 };
          existing.wagePercent = wagePercent || existing.wagePercent;
          existing.wageGoldWeight += wageWeight;
          wageByTargetIndex.set(targetIdx, existing);
          consumedWageRowIndices.add(i);
        }
      }
    }

    const lines: NormalizedDocumentLine[] = [];

    let lineSeq = 0;
    for (let dIdx = 0; dIdx < childDetailRows.length; dIdx++) {
      if (errorPairRowIndices.has(dIdx) || consumedWageRowIndices.has(dIdx)) {
        continue;
      }

      const dRow = childDetailRows[dIdx];
      lineSeq++;
      const vazn = parseNum(dRow.vazn, 0);
      const rowNo = parseText(dRow.no);
      const dSharh = parseText(dRow.Sharh);
      const dNoKar = parseText(dRow.NO_kar);
      const isStone = rowNo.includes('سنگ') || dNoKar.includes('سنگ') || dSharh.includes('سنگ');
      const isWorkmanship = rowNo.includes('کارساخته') || wageByTargetIndex.has(dIdx);

      const dBankName = parseText(dRow.name_bank);
      const isBankRow = rowNo.includes('بانک') || Boolean(dBankName);
      const bankName = dBankName || (rowNo.includes('بانک') ? 'بانک' : undefined);
      const bankAccountNumber = dBankName ? bankMapByName.get(dBankName) : parseText(dRow.sh_check) || undefined;

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
      } else if (vazn > 0 && !rowNo.includes('وجه') && !isBankRow && !rowNo.includes('ارز')) {
        metalType = 'gold';
      }

      const baseKaratForConv = metalType === 'silver' ? 999 : 750;
      let converted750 = tabdil > 0
        ? tabdil
        : (vazn > 0 && ayar > 0 && !isStone && metalType !== 'none')
        ? Math.round(((vazn * ayar) / baseKaratForConv) * 1000) / 1000
        : 0;

      const mergedWage = wageByTargetIndex.get(dIdx);
      const wagePercent = mergedWage?.wagePercent || parseNum(dRow.Darsad, 0) || undefined;
      const wageGoldWeight = mergedWage?.wageGoldWeight || undefined;

      if (isWorkmanship && wageGoldWeight && wageGoldWeight > 0) {
        converted750 = Math.round((converted750 + wageGoldWeight) * 1000) / 1000;
      }

      const rawArz = parseText(dRow.Arz) || parseText(hRow.Arz);
      const isUsd = rawArz === 'USD' || dNoKar === 'USD' || dSharh.includes('دلار') || rowNo.includes('دلار');
      const isEur = rawArz === 'EUR' || dNoKar === 'EUR' || dSharh.includes('یورو');
      const isAed = rawArz === 'AED' || dNoKar === 'AED' || dSharh.includes('درهم');
      const isOtherForeign = Boolean(rawArz && rawArz !== 'IRR');
      let detectedForeignCurrency = isUsd
        ? 'USD'
        : isEur
        ? 'EUR'
        : isAed
        ? 'AED'
        : isOtherForeign
        ? rawArz.toUpperCase()
        : rowNo.includes('ارز') || dSharh.includes('ارز')
        ? 'USD'
        : undefined;

      const isCurrencyTrade = rowNo.includes('خرید ارز') || rowNo.includes('فروش ارز');
      const rawCount = parseNum(dRow.Count, 0);
      const rawFiF = parseNum(dRow.FiF, 0);
      const rawRial = parseNum(dRow.rial_V || dRow.rial_kh, 0);

      const isForeignCashOrClaim =
        !isBankRow &&
        (
          Boolean(detectedForeignCurrency) ||
          (docForeignCurrency && (
            (docForeignTradeAmount !== undefined && (rv === docForeignTradeAmount || rkh === docForeignTradeAmount)) ||
            (rowNo.includes('وجه') && !isBankRow && (rv < 500000 && rkh < 500000) && (rv > 0 || rkh > 0)) ||
            (rowNo === 'طلب' && (rv < 500000 && rkh < 500000) && (rv > 0 || rkh > 0) && docForeignTradeAmount !== undefined) ||
            (rowNo === 'بدهی' && (rv < 500000 && rkh < 500000) && (rv > 0 || rkh > 0) && docForeignTradeAmount !== undefined)
          ))
        );

      if (isForeignCashOrClaim && !detectedForeignCurrency) {
        detectedForeignCurrency = docForeignCurrency || customerCurrencyHint || 'USD';
      }

      if (detectedForeignCurrency) {
        allCurrencies.add(detectedForeignCurrency.toUpperCase());
      }

      const hasGoldWeight =
        (tabdil > 0 || vazn > 0) && !rowNo.includes('وجه') && !isBankRow && !rowNo.includes('ارز');
      const isCurrency =
        !isBankRow &&
        (Boolean(detectedForeignCurrency) || isCurrencyTrade || isForeignCashOrClaim) &&
        !hasGoldWeight;

      if (isCurrency) {
        metalType = 'none';
      }

      let foreignAmt: number | undefined;
      let amountIrr = 0;

      if (isBankRow) {
        amountIrr = rv > 0 ? rv : rkh > 0 ? rkh : 0;
        foreignAmt = undefined;
        metalType = 'none';
      } else if (isCurrencyTrade) {
        if (rawCount > 0) {
          foreignAmt = rawCount;
          amountIrr = rawRial > 0 ? rawRial : rawCount * rawFiF;
        } else {
          foreignAmt = rawRial;
          amountIrr = 0;
        }
      } else if (isForeignCashOrClaim || isCurrency) {
        foreignAmt = rv > 0 ? rv : rkh > 0 ? rkh : undefined;
        amountIrr = 0;
      } else if (isWorkmanship) {
        amountIrr = 0;
        foreignAmt = undefined;
      } else {
        amountIrr = rv > 0 ? rv : rkh > 0 ? rkh : 0;
        foreignAmt = undefined;
      }

      // Check Command for transfer tokens
      const cmd = parseText(dRow.Command);
      let transferToken: string | undefined;
      let transferSide: 'source' | 'destination' | undefined;

      const isHavalehAz = dSharh.includes('حواله از') || cmd.startsWith('#HAVALEH#');
      const isHavalehBe = dSharh.includes('حواله به') || cmd.startsWith('#hshbe#');

      if (cmd.startsWith('#HAVALEH#') || isHavalehAz) {
        transferSide = 'destination';
        transferToken = cmd.startsWith('#HAVALEH#') ? cmd.replace('#HAVALEH#', '') : undefined;
      } else if (cmd.startsWith('#hshbe#') || isHavalehBe) {
        transferSide = 'source';
        transferToken = cmd.startsWith('#hshbe#') ? cmd.replace('#hshbe#', '') : undefined;
      }

      // Determine Gold Direction (ورود / خروج)
      let goldNature: 'received' | 'paid' | 'none' = 'none';
      if (metalType === 'none' || converted750 === 0) {
        goldNature = 'none';
      } else if (tv > 0) {
        goldNature = 'received';
      } else if (tkh > 0) {
        goldNature = 'paid';
      } else if (converted750 > 0) {
        if (isHavalehAz) {
          goldNature = 'received';
        } else if (isHavalehBe) {
          goldNature = 'paid';
        } else if (rowNo.includes('ورود') || rowNo.includes('خرید') || rowNo.includes('بدهی')) {
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
      if (isHavalehAz) {
        moneyNature = 'received';
      } else if (isHavalehBe) {
        moneyNature = 'paid';
      } else if (rowNo.includes('خرید ارز')) {
        moneyNature = 'received';
      } else if (rowNo.includes('فروش ارز')) {
        moneyNature = 'paid';
      } else if (isCurrency && (rowNo === 'طلب' || rowNo.includes('ورود'))) {
        moneyNature = 'received';
      } else if (isCurrency && (rowNo === 'بدهی' || rowNo.includes('خروج'))) {
        moneyNature = 'paid';
      } else if (rv > 0) {
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
      // If customer brings gold or pays cash / transfers in -> customer is Creditor (بستانکار)
      // If customer receives gold or gets cash, or is charged for goods/services -> customer is Debtor (بدهکار)
      const partySide: 'debtor' | 'creditor' =
        (moneyNature === 'received' || (moneyNature === 'none' && goldNature === 'received')) ? 'creditor' : 'debtor';

      // Check conditional gold and assay receipt
      const shSharti = parseText(dRow.sh_sharti);
      const isConditional =
        rowNo.includes('شرطی') ||
        dSharh.includes('شرطی') ||
        dNoKar.includes('شرطی');

      const isAbshode =
        dRow.Abshode === '-1' ||
        parseText(dRow.Abshode).toLowerCase() === 'true' ||
        rowNo.includes('آبشده') ||
        (!isConditional && !isWorkmanship && (rowNo.includes('طلا') || rowNo.includes('نقره')));

      let kind: NormalizedDocumentLine['kind'] = 'general_metal';
      if (isBankRow) {
        kind = 'bank';
      } else if (isWorkmanship) {
        kind = 'workmanship';
      } else if (isCurrencyTrade) {
        kind = 'currency';
      } else if (transferToken || isHavalehAz || isHavalehBe) {
        kind = isCurrency ? 'currency' : 'claim';
      } else if (isCurrency && rowNo.includes('وجه')) {
        kind = 'cash';
      } else if (isCurrency) {
        kind = 'currency';
      } else if (isConditional) {
        kind = 'conditional';
      } else if (isAbshode) {
        kind = 'melted';
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

      const isLineOpening =
        isDocOpening ||
        dSharh.includes('موجودی اولیه') ||
        dSharh.includes('موجودی اول دوره') ||
        dSharh.includes('اول دوره') ||
        parseText(dRow.SanadType) === '9' ||
        parseText(dRow.mcode) === '0';

      const workmanshipName = isWorkmanship ? cleanDescription(dSharh || dNoKar || 'کارساخته') : undefined;
      const cleanDesc = cleanDescription(dSharh || dNoKar || '');

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
        foreignCurrency: detectedForeignCurrency,
        assayStampNumber: shSharti || undefined,
        assayLabName: parseText(dRow.name_az) || undefined,
        transferToken,
        transferSide,
        transferPartnerName: parseText(dRow.name_az) || undefined,
        description: cleanDesc,
        isConditional,
        bankName,
        bankAccountNumber,
        wagePercent,
        wageGoldWeight,
        workmanshipName,
        isOpeningInventory: isLineOpening,
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
      isOpeningInventory: isDocOpening,
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
    currencies: Array.from(allCurrencies),
  };

  normalizerCache.set(rawDb, result);
  return result;
}
