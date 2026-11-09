import { formatJalaliDate, gregorianToJalali, toPersianDigits } from '@/lib/jalali';
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
  NormalizedEtiquette,
  NormalizedEtiquetteStone,
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

  // Pre-index genuine etiquettes from khar_sakhte table
  const etiquetteCodeSet = new Set<string>();
  const etiquetteBarcodeMap = new Map<string, string>();
  for (const k of rawDb.khar_sakhte) {
    const code = parseText(k.Code);
    const barcode = parseText(k.Barcode) || code;
    const hasEt = k.No_Et !== null && String(k.No_Et).trim() !== '' && String(k.No_Et).trim() !== '0';
    if (code && (hasEt || parseNum(k.Vazn, 0) > 0)) {
      etiquetteCodeSet.add(code);
      if (barcode) etiquetteBarcodeMap.set(code, barcode);
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

    // 2. Detect Manufactured Gold percentage wage lines to link to base item
    interface MergedWageInfo {
      wagePercent: number;
      wageGoldWeight: number;
      wageRowIdx: number;
    }
    const wageByTargetIndex = new Map<number, MergedWageInfo>();
    const wageParentByRowIndex = new Map<number, number>();

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
          const dsdNumStr = dsdMatch[1];
          // In Tahesab, #DSD<number> explicitly references the sibling row whose column 'R' equals <number>
          const foundByR = childDetailRows.findIndex(
            (row) => parseText(row.R) === dsdNumStr && (parseText(row.no).includes('کارساخته') || etiquetteCodeSet.has(parseText(row.kar_Code)))
          );
          if (foundByR !== -1) {
            targetIdx = foundByR;
          } else {
            // Check by 1-based index ONLY if that row is actually کارساخته or etiquette
            const dsdNum = parseInt(dsdNumStr, 10);
            if (
              dsdNum >= 1 &&
              dsdNum <= childDetailRows.length &&
              (parseText(childDetailRows[dsdNum - 1].no).includes('کارساخته') || etiquetteCodeSet.has(parseText(childDetailRows[dsdNum - 1].kar_Code)))
            ) {
              targetIdx = dsdNum - 1;
            }
          }
        }
        if (targetIdx === -1) {
          for (let prev = i - 1; prev >= 0; prev--) {
            const prevNo = parseText(childDetailRows[prev].no);
            const prevKarCode = parseText(childDetailRows[prev].kar_Code);
            if (prevNo.includes('کارساخته') || (prevKarCode && etiquetteCodeSet.has(prevKarCode))) {
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

          const existing = wageByTargetIndex.get(targetIdx) || { wagePercent: 0, wageGoldWeight: 0, wageRowIdx: i };
          existing.wagePercent = wagePercent || existing.wagePercent;
          existing.wageGoldWeight += wageWeight;
          existing.wageRowIdx = i;
          wageByTargetIndex.set(targetIdx, existing);
          wageParentByRowIndex.set(i, targetIdx);
        }
      }
    }

    const lines: NormalizedDocumentLine[] = [];
    const lineIndexByChildDetailIndex = new Map<number, number>();

    let lineSeq = 0;
    for (let dIdx = 0; dIdx < childDetailRows.length; dIdx++) {
      if (errorPairRowIndices.has(dIdx)) {
        continue;
      }

      const dRow = childDetailRows[dIdx];
      lineSeq++;
      lineIndexByChildDetailIndex.set(dIdx, lineSeq);

      // Dedicated handling for golden percentage child lines
      if (wageParentByRowIndex.has(dIdx)) {
        const parentDetailIdx = wageParentByRowIndex.get(dIdx)!;
        const parentRow = childDetailRows[parentDetailIdx];
        const parentWage = wageByTargetIndex.get(parentDetailIdx);
        const parentLineNum = lineIndexByChildDetailIndex.get(parentDetailIdx);

        const parentKarCode = parseText(parentRow?.kar_Code);
        const parentCmd = parseText(parentRow?.Command);
        const parentBarcodeFromCmd = (parentCmd.startsWith('#20') || (parentCmd.startsWith('#') && !parentCmd.includes('HAVALEH') && !parentCmd.includes('hshbe') && !parentCmd.includes('DSD') && parentCmd.length > 2))
          ? parentCmd.replace(/^#+/, '')
          : undefined;
        const parentEtiquetteBarcode = (parentKarCode && etiquetteBarcodeMap.get(parentKarCode)) || parentBarcodeFromCmd;
        const parentIsEtiquette =
          (Boolean(parentKarCode) && etiquetteCodeSet.has(parentKarCode)) ||
          Boolean(parentBarcodeFromCmd) ||
          parseText(parentRow?.no).includes('اتیکت') ||
          parseText(parentRow?.Sharh).includes('اتیکت') ||
          parseText(parentRow?.Sharh).includes('کاراتیکت') ||
          parseText(dRow.Sharh).includes('اتیکت') ||
          parseText(dRow.Sharh).includes('کاراتیکت');

        const wagePct = parentWage?.wagePercent || parseNum(parentRow?.Darsad, 0) || 0;
        const childVazn = parseNum(dRow.vazn, 0) || parentWage?.wageGoldWeight || 0;
        const childTabdil = parseNum(dRow.tabdil750_kh || dRow.tabdil750_v, 0) || childVazn;
        const childAyar = parseNum(dRow.ayar, 750) || 750;
        const childNature: 'received' | 'paid' =
          parseNum(dRow.tabdil750_kh, 0) > 0 ? 'paid' : parseNum(dRow.tabdil750_v, 0) > 0 ? 'received' : (parseNum(parentRow?.tabdil750_kh, 0) > 0 ? 'paid' : 'received');
        const childSignedGold = childNature === 'paid' ? -childTabdil : childTabdil;
        const childDocTypeLabel = parentIsEtiquette
          ? `درصد طلایی اتیکت طلا (${toPersianDigits(wagePct)}٪)`
          : `درصد طلایی کارساخته (${toPersianDigits(wagePct)}٪)`;
        const childDesc = cleanDescription(parseText(dRow.Sharh)) || `بابت درصد طلایی (${toPersianDigits(wagePct)}٪)`;

        lines.push({
          sourceFactorCode: factorCode,
          lineNumber: lineSeq,
          dateIso,
          dateJalali,
          nature: childNature,
          kind: parentIsEtiquette ? 'etiquette' : 'workmanship',
          metalType: 'gold',
          weight: childVazn,
          grade: childAyar,
          convertedWeight750: childTabdil,
          amountIrr: 0,
          description: childDesc,
          isConditional: false,
          wagePercent: wagePct,
          wageGoldWeight: childTabdil,
          workmanshipName: cleanDescription(parseText(dRow.NO_kar) || parseText(parentRow?.NO_kar) || ''),
          isOpeningInventory: isDocOpening,
          signedGoldAmount: childSignedGold,
          signedRialAmount: 0,
          signedForeignAmount: 0,
          goldNature: childNature,
          moneyNature: 'none',
          partySide: childNature === 'paid' ? 'debtor' : 'creditor',
          isEtiquette: parentIsEtiquette,
          etiquetteBarcode: parentEtiquetteBarcode,
          etiquetteCode: parentKarCode,
          isGoldenPercentageLine: true,
          parentLineNumber: parentLineNum,
          documentTypeLabel: childDocTypeLabel,
          raw: dRow,
        });
        continue;
      }

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

      const lineArz = parseText(dRow.Arz);
      // Strip counterparty name in transfers (e.g. "(حواله به: 481 شاهین زینالی دلار)") so customer names containing "دلار" don't turn Rial transfers into USD!
      const sharhWithoutCounterparty = dSharh.replace(/\(حواله\s+(?:به|از):\s*[^)]+\)/g, '').trim();

      const rawCount = parseNum(dRow.Count, 0);
      const rawFiF = parseNum(dRow.FiF, 0);
      const rawRial = parseNum(dRow.rial_V || dRow.rial_kh, 0);

      const isUsd =
        lineArz === 'USD' ||
        dNoKar === 'USD' ||
        (!isWorkmanship && rowNo.includes('دلار')) ||
        (!isWorkmanship && !isBankRow && sharhWithoutCounterparty.includes('دلار') && (rawRial < 1000000 || rawCount > 0));
      const isEur = lineArz === 'EUR' || dNoKar === 'EUR' || (!isWorkmanship && sharhWithoutCounterparty.includes('یورو'));
      const isAed = lineArz === 'AED' || dNoKar === 'AED' || (!isWorkmanship && sharhWithoutCounterparty.includes('درهم'));
      const isOtherForeign = Boolean(lineArz && lineArz !== 'IRR');
      let detectedForeignCurrency = isUsd
        ? 'USD'
        : isEur
        ? 'EUR'
        : isAed
        ? 'AED'
        : isOtherForeign
        ? lineArz.toUpperCase()
        : (!isWorkmanship && (rowNo.includes('ارز') || sharhWithoutCounterparty.includes('ارز')))
        ? 'USD'
        : undefined;

      const isCurrencyTrade = rowNo.includes('خرید ارز') || rowNo.includes('فروش ارز');

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

      const signedGoldAmount = (goldNature === 'received' ? converted750 : goldNature === 'paid' ? -converted750 : 0) || 0;
      const signedRialAmount = (moneyNature === 'received' ? amountIrr : moneyNature === 'paid' ? -amountIrr : 0) || 0;
      const signedForeignAmount = foreignAmt ? (moneyNature === 'received' ? foreignAmt : -foreignAmt) || 0 : 0;

      const nature: 'received' | 'paid' =
        goldNature === 'received' || moneyNature === 'received' ? 'received' : 'paid';

      // Party side in double-entry:
      // If customer brings gold or pays cash / transfers in -> customer is Creditor (بستانکار)
      // If customer receives gold or gets cash, or is charged for goods/services -> customer is Debtor (بدهکار)
      const partySide: 'debtor' | 'creditor' =
        (moneyNature === 'received' || (moneyNature === 'none' && goldNature === 'received')) ? 'creditor' : 'debtor';

      // Check conditional gold and assay receipt
      const shSharti = parseText(dRow.sh_sharti);
      const dTemp = parseText(dRow.Temp);
      const dCommand = parseText(dRow.Command);
      const dCommand2 = parseText(dRow.Command2);
      const dBaabat = parseText(dRow.Baabat);

      // In Tahesab, conditional gold (طلای شرطی / عیار شرطی) is identified by:
      // 1. Command2 containing '171' (the dedicated Tahesab machine operation code for conditional melted gold)
      // 2. Temp description containing 'شرطی' (e.g. "ورود آبشده شرطی (40/57*746) [460917 بلوط]")
      // 3. User description in Sharh, Baabat, no, NO_kar, or Command containing 'شرطی' or 'sharti'
      // Note: Items frequently possess an assumed/temporary karat (e.g. 746, 750) yet remain strictly conditional.
      const isConditional =
        dCommand2.includes('171') ||
        dTemp.includes('شرطی') ||
        rowNo.includes('شرطی') ||
        dSharh.includes('شرطی') ||
        dBaabat.includes('شرطی') ||
        dNoKar.includes('شرطی') ||
        dCommand.includes('شرطی') ||
        dCommand.toLowerCase().includes('sharti');

      const isAbshode =
        dRow.Abshode === '-1' ||
        parseText(dRow.Abshode).toLowerCase() === 'true' ||
        rowNo.includes('آبشده') ||
        (!isConditional && !isWorkmanship && (rowNo.includes('طلا') || rowNo.includes('نقره')));

      const isHawala = Boolean(transferToken || isHavalehAz || isHavalehBe);

      const dKarCode = parseText(dRow.kar_Code);
      const barcodeFromCmd = (dCommand.startsWith('#20') || (dCommand.startsWith('#') && !dCommand.includes('HAVALEH') && !dCommand.includes('hshbe') && !dCommand.includes('DSD') && dCommand.length > 2))
        ? dCommand.replace(/^#+/, '')
        : undefined;
      const etiquetteBarcode = (dKarCode && etiquetteBarcodeMap.get(dKarCode)) || barcodeFromCmd;

      const isEtiquette =
        (Boolean(dKarCode) && etiquetteCodeSet.has(dKarCode)) ||
        Boolean(barcodeFromCmd) ||
        rowNo.includes('اتیکت') ||
        dSharh.includes('اتیکت') ||
        dSharh.includes('کاراتیکت') ||
        parseText(dRow.Temp).includes('اتیکت');

      let kind: NormalizedDocumentLine['kind'] = 'general_metal';
      if (isBankRow) {
        kind = 'bank';
      } else if (isEtiquette) {
        kind = 'etiquette';
      } else if (isWorkmanship) {
        kind = 'workmanship';
      } else if (isCurrencyTrade) {
        kind = 'currency';
      } else if (isHawala) {
        if (converted750 > 0 || vazn > 0 || metalType === 'gold' || metalType === 'silver') {
          kind = isConditional ? 'conditional' : 'melted';
        } else if (isCurrency || (foreignAmt && foreignAmt > 0)) {
          kind = 'currency';
        } else if (amountIrr > 0) {
          kind = 'cash';
        } else {
          kind = 'claim';
        }
      } else if (rowNo === 'بدهی' || rowNo === 'طلب' || rowNo.includes('بدهی') || rowNo.includes('طلب')) {
        kind = 'claim';
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

      let documentTypeLabel: string | undefined;
      if (isConditional) {
        documentTypeLabel = isHawala ? 'حواله طلای شرطی' : (nature === 'received' ? 'ورود آب شده شرطی' : 'خروج آب شده شرطی');
      } else if (kind === 'etiquette') {
        documentTypeLabel = nature === 'paid' ? 'خروج اتیکت طلا' : 'ورود اتیکت طلا';
      } else if (kind === 'workmanship') {
        documentTypeLabel = nature === 'paid' ? 'خروج کار ساخته' : 'ورود کار ساخته';
      } else if (isHawala) {
        // If remittance to/from shop account (حساب مغازه) with بدهی/طلب, it reflects direct store debt/claim
        const isShopAccountTransfer = dSharh.includes('حساب مغازه') || dSharh.includes('مغازه');
        if (isShopAccountTransfer && rowNo === 'بدهی') {
          documentTypeLabel = 'بدهی ما';
        } else if (isShopAccountTransfer && rowNo === 'طلب') {
          documentTypeLabel = 'طلب ما';
        } else {
          documentTypeLabel = 'حواله طلا';
        }
      } else if (rowNo === 'بدهی' || kind === 'claim') {
        documentTypeLabel = (rowNo === 'بدهی' || nature === 'received') ? 'بدهی ما' : 'طلب ما';
      } else if (rowNo === 'طلب') {
        documentTypeLabel = 'طلب ما';
      }

      const isLineOpening =
        isDocOpening ||
        rowNo === 'از قبل' ||
        dSharh.includes('از قبل') ||
        dSharh.includes('موجودی اولیه') ||
        dSharh.includes('موجودی اول دوره') ||
        dSharh.includes('اول دوره') ||
        parseText(dRow.SanadType) === '9' ||
        parseText(dRow.mcode) === '0';

      const workmanshipName = (isWorkmanship || isEtiquette) ? cleanDescription(dSharh || dBaabat || dNoKar || (isEtiquette ? 'اتیکت طلا' : 'کارساخته')) : undefined;
      const cleanDesc = cleanDescription(
        dSharh ||
        dBaabat ||
        dNoKar ||
        (dTemp ? dTemp : '') ||
        (isConditional
          ? `${nature === 'received' ? 'ورود' : 'خروج'} آبشده شرطی (${vazn > 0 ? `${vazn} گرم` : ''}${ayar > 0 ? ` عیار ${ayar}` : ''})${shSharti ? ` [رسید ${shSharti}${parseText(dRow.name_az) ? ' ' + parseText(dRow.name_az) : ''}]` : ''}`.trim()
          : '')
      );

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
        isHawala,
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
        isEtiquette,
        etiquetteBarcode,
        etiquetteCode: dKarCode || undefined,
        documentTypeLabel,
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

  // Pass 2: Reconcile and pair all Hawala transfer lines across documents
  const transferTokenMap = new Map<string, { doc: NormalizedDocument; line: NormalizedDocumentLine }[]>();
  for (const doc of documents) {
    for (const line of doc.lines) {
      if (line.transferToken) {
        let list = transferTokenMap.get(line.transferToken);
        if (!list) {
          list = [];
          transferTokenMap.set(line.transferToken, list);
        }
        list.push({ doc, line });
      }
    }
  }

  const partyNameByCode = new Map<string, string>();
  for (const p of parties) {
    partyNameByCode.set(p.sourceCode, p.name);
  }

  for (const [token, pairList] of transferTokenMap.entries()) {
    if (pairList.length === 2) {
      const itemA = pairList[0];
      const itemB = pairList[1];

      // Link A to B
      itemA.line.isHawala = true;
      itemA.line.hawalaCounterCustomerCode = itemB.doc.sourceCustomerCode;
      itemA.line.hawalaCounterCustomerName =
        partyNameByCode.get(itemB.doc.sourceCustomerCode) || itemA.line.transferPartnerName;
      itemA.line.hawalaCounterFactorCode = itemB.doc.sourceFactorCode;

      // Link B to A
      itemB.line.isHawala = true;
      itemB.line.hawalaCounterCustomerCode = itemA.doc.sourceCustomerCode;
      itemB.line.hawalaCounterCustomerName =
        partyNameByCode.get(itemA.doc.sourceCustomerCode) || itemB.line.transferPartnerName;
      itemB.line.hawalaCounterFactorCode = itemA.doc.sourceFactorCode;
    } else {
      // Unpaired single line: extract counter customer from description if present
      for (const item of pairList) {
        item.line.isHawala = true;
        if (!item.line.hawalaCounterCustomerName) {
          const match = item.line.description.match(/(?:حواله\s+(?:از|به)|(?:از|به))\s*:\s*(\d+)?\s*([^\)\:\n،]+)/);
          if (match) {
            if (match[1]) item.line.hawalaCounterCustomerCode = match[1].trim();
            if (match[2]) item.line.hawalaCounterCustomerName = match[2].trim();
          }
        }
      }
    }
  }

  // Pass 3: Extract genuine jewelry etiquettes (اتیکت‌ها و بارکدهای طلا و جواهر)
  // In Tahesab khar_sakhte table, rows with Code !== null, No_Et !== null and Vazn > 0 are genuine etiquettes.
  // Rows with Code === null are generic workmanship model / price formulas.
  const rawEtiketManual = (rawDb.otherTables?.['Etiket_Manual'] as RawTableRow[]) || [];
  const rawSabtSang = (rawDb.otherTables?.['Kar_Sakhte_SabtSang'] as RawTableRow[]) || [];
  const manualByCode = new Map<string, RawTableRow>();
  for (const m of rawEtiketManual) {
    const code = parseText(m.Code);
    if (code) manualByCode.set(code, m);
  }

  // Pre-index exit factor lines for etiquettes from rawDb.hesab_detail
  const exitDetailByKarCode = new Map<string, RawTableRow>();
  const rawHesabDetail = (rawDb.hesab_detail as RawTableRow[]) || [];
  for (const hd of rawHesabDetail) {
    const karCode = parseText(hd.kar_Code);
    const no = parseText(hd.no);
    if (karCode && karCode !== '0' && no.includes('خروج کارساخته')) {
      exitDetailByKarCode.set(karCode, hd);
    }
  }

  // Pre-index mounted stones by etiquette Code from Kar_Sakhte_SabtSang
  const stonesByCode = new Map<string, RawTableRow[]>();
  for (const s of rawSabtSang) {
    const code = parseText(s.Code);
    if (code) {
      let list = stonesByCode.get(code);
      if (!list) {
        list = [];
        stonesByCode.set(code, list);
      }
      list.push(s);
    }
  }

  const etiquettes: NormalizedEtiquette[] = [];
  const genuineKharSakhte = rawDb.khar_sakhte.filter((k) => {
    const code = parseText(k.Code);
    const vazn = parseNum(k.Vazn, 0);
    return code !== '' && code !== 'null' && vazn > 0;
  });

  for (const k of genuineKharSakhte) {
    const code = parseText(k.Code);
    const manual = manualByCode.get(code);
    const barcode = parseText(manual?.BarCode) || code;
    const title = parseText(k.name) || parseText(manual?.no_kar) || 'مصنوع طلا';
    const itemCode = parseText(k.Code_Kar) || '';
    const totalWeight = parseNum(k.Vazn, 0) || parseNum(manual?.V, 0);
    const manualVaznSang = parseNum(manual?.VaznSang, 0);

    // Process mounted stones
    const stoneRows = stonesByCode.get(code) || [];
    const mountedStones: NormalizedEtiquetteStone[] = [];
    let stoneWeightSum = 0;
    let stoneCountSum = 0;
    let stonePriceSum = 0;

    for (const s of stoneRows) {
      const stoneName = parseText(s.N) || parseText(s.Tarash) || 'نگین';
      const count = Math.max(1, Math.round(parseNum(s.C, 1)));
      const rawWeight = parseNum(s.V, 0); // Recorded weight in Tahesab (carats or grams)
      // If Unit === '0' or default, V represents carats in jewelry trade unless already small
      const weightCarat = rawWeight;
      const weightGram = Math.round((rawWeight * 0.2) * 1000) / 1000;
      const price = Math.round(parseNum(s.GheymatSang, 0));

      stoneWeightSum += weightGram;
      stoneCountSum += count;
      stonePriceSum += price;

      mountedStones.push({
        name: stoneName,
        quantity: count,
        weightCarat,
        weightGram,
        unitPrice: Math.round(parseNum(s.P, 0)),
        totalPrice: price,
        isDeducted: true,
        shape: parseText(s.Tarash) || parseText(s.Cut) || undefined,
      });
    }

    const stoneWeight = manualVaznSang > 0 ? manualVaznSang : stoneWeightSum;
    const netWeight = Math.max(0, Math.round((totalWeight - stoneWeight) * 1000) / 1000);
    const purity = parseNum(k.Ayar, 750);
    const profitPercentage = parseNum(k.Darsad_Foroosh, 7);

    // Wage
    const rawWage = parseNum(k.Darsad, 0) || parseNum(k.ojrat, 0);
    const wageType: 'percentage' | 'per_gram' | 'fixed' = 'percentage';
    let wage = rawWage;

    // Status: Exit === '0' is available (in showcase), Exit === '-1' is sold / exited
    const isSold = String(k.Exit).trim() === '-1';
    const status: 'available' | 'sold' = isSold ? 'sold' : 'available';

    // Storage location: if Vitrin column is filled use it, else default to 'ویترین اصلی'
    const storageLocation = parseText(k.Vitrin) || (parseText(k.Sazandeh) ? `ویترین - ${parseText(k.Sazandeh)}` : 'ویترین اصلی');

    // Dates
    let dateIso: string | undefined;
    let dateJalali: string | undefined;
    const rawDate = parseText(k.Tarikh);
    if (rawDate) {
      try {
        const d = new Date(rawDate.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          dateIso = d.toISOString();
          dateJalali = dateToJalaliString(d);
        }
      } catch {
        // ignore
      }
    }

    // Exit factor information if sold
    let exitFactorCode: string | undefined;
    let exitFactorNumber: string | undefined;
    let exitCustomerCode: string | undefined;
    let exitCustomerName: string | undefined;
    let exitDateJalali: string | undefined;

    const exitLine = exitDetailByKarCode.get(code);
    if (exitLine) {
      exitFactorCode = parseText(exitLine.Factor_Code);
      exitFactorNumber = parseText(exitLine.sh_factor);
      exitCustomerCode = parseText(exitLine.mcode);
      exitCustomerName = partyNameByCode.get(exitCustomerCode || '') || parseText(exitLine.rec) || undefined;
      const rawExitDate = parseText(exitLine.Tarikh);
      if (rawExitDate) {
        try {
          const d = new Date(rawExitDate.replace(' ', 'T'));
          if (!isNaN(d.getTime())) {
            exitDateJalali = dateToJalaliString(d);
          }
        } catch {
          // ignore
        }
      }
      // If item is sold and exit line had specific selling wage percentage, capture it
      if (wage === 0 && parseNum(exitLine.Darsad, 0) > 0) {
        wage = parseNum(exitLine.Darsad, 0);
      }
    } else if (isSold) {
      // Fallback from khar_sakhte columns if detail rows were chunked/limited
      const fallbackCustCode = parseText(k.J_Mcode);
      if (fallbackCustCode && fallbackCustCode !== '-1') {
        exitCustomerCode = fallbackCustCode;
        exitCustomerName = partyNameByCode.get(fallbackCustCode);
      }
      const rawDate2 = parseText(k.Tarikh2);
      if (rawDate2) {
        try {
          const d = new Date(rawDate2.replace(' ', 'T'));
          if (!isNaN(d.getTime())) {
            exitDateJalali = dateToJalaliString(d);
          }
        } catch {
          // ignore
        }
      }
    }

    etiquettes.push({
      barcode,
      title,
      itemCode,
      metal: 'gold',
      purity,
      totalWeight,
      stoneWeight,
      netWeight,
      stoneCount: stoneCountSum,
      stonePrice: stonePriceSum,
      wage,
      wageType,
      profitPercentage,
      storageLocation,
      status,
      printStatus: 'printed',
      printCount: 1,
      mountedStones,
      dateIso,
      dateJalali,
      creatorName: parseText(k.Sazandeh) || undefined,
      exitFactorCode,
      exitFactorNumber,
      exitCustomerCode,
      exitCustomerName,
      exitDateJalali,
      raw: k,
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
    etiquettes,
    currencies: Array.from(allCurrencies),
  };

  normalizerCache.set(rawDb, result);
  return result;
}
