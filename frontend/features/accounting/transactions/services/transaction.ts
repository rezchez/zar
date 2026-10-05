import type { RecordModel } from 'pocketbase';
import {
  emptyCustomerBalances,
  normalizeCurrencyCode,
  type CustomerBalanceValues,
  type CustomerStoneSpeciesBalance,
  type CustomerStoneItemDetail,
} from '@/lib/customer';
import { caratsToGrams, gramsToCarats } from '@/lib/gemstone-weight';
import { getShapeNameFa, getCutGradeNameFa } from '@/lib/gemstone';


export type TransactionType =
  | 'opening_balance'
  | 'document'
  | 'adjustment'
  | 'reversal';

export type TransactionStatus = 'temporary' | 'final' | 'posted' | 'voided';

export type CustomerTransaction = {
  id: string;
  customerId: string;
  customerCode: number;
  createdBy: string;
  updatedBy: string;
  sourceKey: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  isOpeningBalance: boolean;
  transactionDate: string;
  documentId: string;
  documentSequence?: number;
  documentNumberPrefixSnapshot?: string;
  documentNumber: string;
  description: string;
  goldAmount: number;
  silverAmount: number;
  platinumAmount: number;
  rialAmount: number;
  foreignAmount: number;
  tertiaryAmount: number;
  foreignCurrency: string;
  foreignCurrencySymbol: string;
  tertiaryCurrency: string;
  tertiaryCurrencySymbol: string;
  documentNature: 'received' | 'paid' | '';
  documentTab: string;
  documentSubType: string;
  documentDateJalali: string;
  settlementMethod: string;
  balanceSource: string;
  documentDetails: string;
  documentLineNumber: number;
  created: string;
  updated: string;
};

function readText(record: RecordModel | Record<string, unknown>, field: string) {
  return typeof record[field] === 'string' ? (record[field] as string) : '';
}

function readNumber(record: RecordModel | Record<string, unknown>, field: string) {
  return typeof record[field] === 'number' && Number.isFinite(record[field] as number)
    ? (record[field] as number)
    : 0;
}

export function mapTransaction(record: RecordModel | Record<string, unknown>): CustomerTransaction {
  const documentTab = readText(record, 'documentTab');
  const documentSubType = readText(record, 'documentSubType');
  const documentNature = readText(record, 'documentNature') as 'received' | 'paid' | '';
  const settlementMethod = readText(record, 'settlementMethod');
  const rawDetailsField = record.documentDetails;
  const documentDetails =
    typeof rawDetailsField === 'string'
      ? rawDetailsField
      : rawDetailsField && typeof rawDetailsField === 'object'
      ? JSON.stringify(rawDetailsField)
      : '';

  let rialAmount = readNumber(record, 'rialAmount');
  let foreignAmount = readNumber(record, 'foreignAmount');
  let foreignCurrency = readText(record, 'foreignCurrency');
  let foreignCurrencySymbol = readText(record, 'foreignCurrencySymbol');

  if (documentTab === 'stone') {
    let parsedDetails: Record<string, unknown> = {};
    if (rawDetailsField && typeof rawDetailsField === 'object' && !Array.isArray(rawDetailsField)) {
      parsedDetails = rawDetailsField as Record<string, unknown>;
    } else if (documentDetails) {
      try {
        const parsed = JSON.parse(documentDetails);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedDetails = parsed as Record<string, unknown>;
        }
      } catch {
        // ignore invalid JSON
      }
    }

    const opKind = String(parsedDetails.stoneOperationKind || '');
    const isUnsettledStone =
      opKind === 'unsettled_purchase' ||
      opKind === 'unsettled_sale' ||
      documentSubType === 'stone-unsettled-purchase' ||
      documentSubType === 'stone-unsettled-sale' ||
      parsedDetails.unsettledTrade === true ||
      settlementMethod === 'unsettled';

    const rawSettlementUnit = String(
      parsedDetails.settlementCurrencyUnit || foreignCurrency || '',
    ).trim();
    const normUnit = normalizeCurrencyCode(rawSettlementUnit);
    const isForeignStone = Boolean(normUnit && normUnit !== 'IRR' && normUnit !== 'IRT');
    const direction = documentNature === 'paid' ? -1 : 1;

    if (!isUnsettledStone) {
      // Settled stone purchase/sale (با تسویه آنی) or physical entry/exit: no open debt/claim remains
      rialAmount = 0;
      foreignAmount = 0;
    } else {
      const detailTotal =
        Number(String(parsedDetails.stoneTotalAmount ?? parsedDetails.totalAmount ?? '0').replace(/,/g, '')) || 0;
      const baseAbsAmount = Math.abs(foreignAmount || rialAmount || detailTotal);

      if (isForeignStone) {
        rialAmount = 0;
        foreignAmount = baseAbsAmount * direction;
        foreignCurrency = normUnit;
        if (!foreignCurrencySymbol || foreignCurrencySymbol === 'IRR' || foreignCurrencySymbol === 'IRT') {
          foreignCurrencySymbol = normUnit === 'USD' ? '$' : normUnit === 'EUR' ? '€' : normUnit === 'GBP' ? '£' : normUnit;
        }
      } else {
        foreignAmount = 0;
        const alreadyInIrr = parsedDetails.rialAmountInIrr === true;
        const effectiveAbsRial =
          normUnit === 'IRT' && !alreadyInIrr && Math.abs(rialAmount) === Math.abs(detailTotal)
            ? Math.round(baseAbsAmount * 10)
            : Math.round(baseAbsAmount);
        rialAmount = effectiveAbsRial * direction;
      }
    }
  }

  return {
    id: readText(record, 'id'),
    customerId: readText(record, 'customer'),
    customerCode: readNumber(record, 'customerCode'),
    createdBy: readText(record, 'createdBy'),
    updatedBy: readText(record, 'updatedBy'),
    sourceKey: readText(record, 'sourceKey'),
    transactionType: readText(record, 'transactionType') as TransactionType,
    status: readText(record, 'status') as TransactionStatus,
    isOpeningBalance: record.isOpeningBalance === true,
    transactionDate: readText(record, 'transactionDate'),
    documentId: readText(record, 'documentId'),
    documentSequence: readNumber(record, 'documentSequence') || undefined,
    documentNumberPrefixSnapshot: readText(record, 'documentNumberPrefixSnapshot') || undefined,
    documentNumber: readText(record, 'documentNumber'),
    description: readText(record, 'description'),
    goldAmount: readNumber(record, 'goldAmount'),
    silverAmount: readNumber(record, 'silverAmount'),
    platinumAmount: readNumber(record, 'platinumAmount'),
    rialAmount,
    foreignAmount,
    tertiaryAmount: readNumber(record, 'tertiaryAmount'),
    foreignCurrency,
    foreignCurrencySymbol,
    tertiaryCurrency: readText(record, 'tertiaryCurrency'),
    tertiaryCurrencySymbol: readText(record, 'tertiaryCurrencySymbol'),
    documentNature,
    documentTab,
    documentSubType,
    documentDateJalali: readText(record, 'documentDateJalali'),
    settlementMethod,
    balanceSource: readText(record, 'balanceSource'),
    documentDetails,
    documentLineNumber: readNumber(record, 'documentLineNumber'),
    created: readText(record, 'created'),
    updated: readText(record, 'updated'),
  };
}

export function sumPostedTransactions(transactions: CustomerTransaction[]) {
  return transactions
    .filter((transaction) => transaction.status === 'final' || transaction.status === 'posted')
    .reduce(
      (sum, transaction) => ({
        goldAmount: sum.goldAmount + transaction.goldAmount,
        silverAmount: sum.silverAmount + transaction.silverAmount,
        platinumAmount: sum.platinumAmount + transaction.platinumAmount,
        rialAmount: sum.rialAmount + transaction.rialAmount,
        foreignAmount: sum.foreignAmount + transaction.foreignAmount,
        tertiaryAmount: sum.tertiaryAmount + transaction.tertiaryAmount,
      }),
      {
        goldAmount: 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 0,
        foreignAmount: 0,
        tertiaryAmount: 0,
      },
    );
}

export function calculateCustomerCurrencyBalances(
  transactions: CustomerTransaction[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.status !== 'final' && t.status !== 'posted') continue;
    if (t.foreignAmount) {
      const code = normalizeCurrencyCode(t.foreignCurrency || 'USD');
      if (code && code !== 'IRR' && code !== 'IRT') {
        result[code] = (result[code] ?? 0) + t.foreignAmount;
      }
    }
    if (t.tertiaryAmount) {
      const code = normalizeCurrencyCode(t.tertiaryCurrency || '');
      if (code && code !== 'IRR' && code !== 'IRT') {
        result[code] = (result[code] ?? 0) + t.tertiaryAmount;
      }
    }
  }
  return result;
}

export function calculateCustomerStoneBalances(
  transactions: CustomerTransaction[],
): {
  carats: number;
  grams: number;
  pieces: number;
  creditCarats: number;
  debitCarats: number;
  creditGrams: number;
  debitGrams: number;
  creditPieces: number;
  debitPieces: number;
  creditItemsCount: number;
  debitItemsCount: number;
  totalActiveItems: number;
  hasOpposingBalances: boolean;
  bySpecies: Record<string, CustomerStoneSpeciesBalance>;
  items: CustomerStoneItemDetail[];
} {
  let totalCarats = 0;
  let totalGrams = 0;
  let totalPieces = 0;
  const bySpecies: Record<string, CustomerStoneSpeciesBalance> = {};
  const byDetail: Record<string, CustomerStoneItemDetail> = {};

  for (const t of transactions) {
    if (t.status !== 'final' && t.status !== 'posted') continue;
    const isStoneTx =
      t.documentTab === 'stone' ||
      t.documentSubType === 'stone-entry' ||
      t.documentSubType === 'stone-exit' ||
      t.documentSubType === 'stone-purchase' ||
      t.documentSubType === 'stone-sale' ||
      t.documentSubType === 'stone-unsettled-purchase' ||
      t.documentSubType === 'stone-unsettled-sale' ||
      (typeof t.documentSubType === 'string' && t.documentSubType.startsWith('stone-'));

    if (!isStoneTx) continue;

    let details: Record<string, unknown> = {};
    if (t.documentDetails) {
      if (typeof t.documentDetails === 'object' && t.documentDetails !== null) {
        details = t.documentDetails as Record<string, unknown>;
      } else if (typeof t.documentDetails === 'string') {
        try {
          details = JSON.parse(t.documentDetails);
        } catch {}
      }
    }

    const opKind = String(details.stoneOperationKind || '');
    const subType = String(t.documentSubType || '');
    const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && t.settlementMethod === 'cash';

    const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
    const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
    const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

    const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
    const isWeightOp =
      opKind === 'entry' ||
      opKind === 'exit' ||
      opKind === 'purchase' ||
      opKind === 'sale' ||
      opKind === 'unsettled_purchase' ||
      opKind === 'unsettled_sale' ||
      subType === 'stone-entry' ||
      subType === 'stone-exit' ||
      subType === 'stone-purchase' ||
      subType === 'stone-sale' ||
      subType === 'stone-unsettled-purchase' ||
      subType === 'stone-unsettled-sale' ||
      t.settlementMethod === 'weight' ||
      t.settlementMethod === 'unsettled' ||
      (!isTradeSettled && hasWeight);

    if (!isWeightOp) continue;

    // قاعده بازار سنگ: خرید از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (-1: بدهکار به ما)، فروش به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (+1: بستانکار از ما)
    const isPurchase =
      t.documentNature === 'received' ||
      opKind === 'purchase' ||
      opKind === 'unsettled_purchase' ||
      opKind === 'entry' ||
      subType === 'stone-purchase' ||
      subType === 'stone-unsettled-purchase' ||
      subType === 'stone-entry';
    const direction = isPurchase ? -1 : 1;

    const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
    const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);
    const pieces = rawPieces;

    totalCarats += carats * direction;
    totalGrams += grams * direction;
    totalPieces += pieces * direction;

    const speciesId = String(details.stoneSpecies || details.stoneCategory || 'other_gemstone');
    const speciesName = String(details.stoneSpeciesName || details.stoneItemName || details.stoneCategory || 'سنگ');
    const category = String(details.stoneCategory || 'colored_gemstone');

    const shape = String(details.stoneShape || '');
    const shapeName = String(details.stoneShapeName || (shape ? getShapeNameFa(shape) : ''));
    const isParcel = details.stoneMode === 'parcel' || (!details.stoneMode && rawPieces > 1);
    const mode = isParcel ? ('parcel' as const) : ('single_stone' as const);

    let color = '';
    if (details.stoneColorMode === 'fancy') {
      color = [details.stoneFancyIntensity, details.stoneFancyHue].filter(Boolean).join(' ') || String(details.stoneColor || '');
    } else if (details.stoneColorRange) {
      color = String(details.stoneColorRange);
    } else if (details.stoneColor) {
      color = String(details.stoneColor);
    } else if (details.stoneColorHue) {
      color = String(details.stoneColorHue);
    }

    let clarity = '';
    if (details.stoneClarityRange) {
      clarity = String(details.stoneClarityRange);
    } else if (details.stoneClarity) {
      clarity = String(details.stoneClarity);
    }

    const rawCut = String(details.stoneCut || '');
    const cut = rawCut ? getCutGradeNameFa(rawCut) : '';
    const certLab = details.stoneCertificateLab && details.stoneCertificateLab !== 'none' ? String(details.stoneCertificateLab) : '';
    const certNumber = String(details.stoneCertificateNumber || details.stoneCertificateReportNumber || '');
    const laser = String(details.stoneLaserInscription || '');
    const lotNumber = String(details.stoneLotNumber || '');
    const sieveSize = String(details.stoneSieveSize || '');
    const measurements =
      details.stoneMeasurementsLength || details.stoneMeasurementsWidth
        ? `${details.stoneMeasurementsLength || '—'} × ${details.stoneMeasurementsWidth || '—'}${details.stoneMeasurementsDepth ? ` × ${details.stoneMeasurementsDepth}` : ''} mm`
        : '';
    const description = t.description || String(details.claimPurpose || '');

    // 1. Group by species (for summary and backwards compatibility)
    if (!bySpecies[speciesId]) {
      bySpecies[speciesId] = {
        speciesId,
        speciesName,
        category,
        shape,
        shapeName,
        color,
        clarity,
        cut,
        certificateLab: certLab,
        certificateNumber: certNumber,
        carats: 0,
        grams: 0,
        pieces: 0,
        items: [],
      };
    }
    bySpecies[speciesId].carats = Math.round((bySpecies[speciesId].carats + carats * direction) * 1e8) / 1e8;
    bySpecies[speciesId].grams = Math.round((bySpecies[speciesId].grams + grams * direction) * 1e8) / 1e8;
    bySpecies[speciesId].pieces += pieces * direction;

    // قاعده سنگ‌های تکی در برابر بارخانه:
    // سنگ‌های تکی یونیک و یکتا هستند و حتی با مشخصات یکسان هرگز با یکدیگر ادغام یا کسر نمی‌شوند.
    // تنها در سنگ‌های بارخانه‌ای امکان ادغام و کسر موجودی وجود دارد.
    const isReferenceSettlement = Boolean(details.unsettledReferenceId && byDetail[String(details.unsettledReferenceId)]);
    const detailKey = isParcel
      ? `parcel__${speciesId}__${shape}__${color}__${clarity}__${rawCut}__${lotNumber}__${sieveSize}`
      : (details.unsettledReferenceId
          ? String(details.unsettledReferenceId)
          : `single__${t.id || (t as any).key || details.inventorySourceId || details.stoneInternalCode || `${speciesId}_${t.documentNumber || 'doc'}_${carats}_${shape}`}`);

    const effectiveDirection = isReferenceSettlement
      ? (byDetail[String(details.unsettledReferenceId)].carats > 0 ? -1 : 1)
      : direction;
    const effectivePieceDir = isReferenceSettlement
      ? (byDetail[String(details.unsettledReferenceId)].pieces > 0 ? -1 : 1)
      : direction;

    if (!byDetail[detailKey]) {
      byDetail[detailKey] = {
        key: detailKey,
        speciesId,
        speciesName,
        category,
        shape,
        shapeName,
        mode,
        color,
        clarity,
        cut,
        certificateLab: certLab,
        certificateNumber: certNumber,
        laserInscription: laser,
        lotNumber,
        sieveSize,
        measurements,
        description,
        carats: 0,
        grams: 0,
        pieces: 0,
        transactionsCount: 0,
        lastDate: t.documentDateJalali || t.transactionDate?.slice(0, 10),
        lastDocumentNumber: t.documentNumber,
      };
    }
    byDetail[detailKey].carats = Math.round((byDetail[detailKey].carats + carats * effectiveDirection) * 1e8) / 1e8;
    byDetail[detailKey].grams = Math.round((byDetail[detailKey].grams + grams * effectiveDirection) * 1e8) / 1e8;
    byDetail[detailKey].pieces += isReferenceSettlement ? Math.abs(pieces) * effectivePieceDir : pieces * direction;
    byDetail[detailKey].transactionsCount = (byDetail[detailKey].transactionsCount || 0) + 1;
    if (t.documentDateJalali) byDetail[detailKey].lastDate = t.documentDateJalali;
    if (t.documentNumber) byDetail[detailKey].lastDocumentNumber = t.documentNumber;
  }

  // Populate items in bySpecies
  for (const item of Object.values(byDetail)) {
    if (bySpecies[item.speciesId]) {
      bySpecies[item.speciesId].items = bySpecies[item.speciesId].items || [];
      bySpecies[item.speciesId].items!.push(item);
    }
  }

  // Calculate distinct credit and debit totals across non-fungible stone types
  let totalCreditCarats = 0;
  let totalDebitCarats = 0;
  let totalCreditGrams = 0;
  let totalDebitGrams = 0;
  let totalCreditPieces = 0;
  let totalDebitPieces = 0;
  let creditItemsCount = 0;
  let debitItemsCount = 0;

  for (const item of Object.values(byDetail)) {
    if (Math.abs(item.carats) > 0.0000001 || Math.abs(item.grams) > 0.0000001 || Math.abs(item.pieces) > 0) {
      if (item.carats > 0) {
        totalCreditCarats += item.carats;
        totalCreditGrams += item.grams;
        totalCreditPieces += item.pieces;
        creditItemsCount++;
      } else if (item.carats < 0) {
        totalDebitCarats += Math.abs(item.carats);
        totalDebitGrams += Math.abs(item.grams);
        totalDebitPieces += Math.abs(item.pieces);
        debitItemsCount++;
      }
    }
  }

  totalCreditCarats = Math.round(totalCreditCarats * 1e8) / 1e8;
  totalDebitCarats = Math.round(totalDebitCarats * 1e8) / 1e8;
  totalCreditGrams = Math.round(totalCreditGrams * 1e8) / 1e8;
  totalDebitGrams = Math.round(totalDebitGrams * 1e8) / 1e8;
  const hasOpposingBalances = creditItemsCount > 0 && debitItemsCount > 0;

  return {
    carats: Math.round(totalCarats * 1e8) / 1e8,
    grams: Math.round(totalGrams * 1e8) / 1e8,
    pieces: totalPieces,
    creditCarats: totalCreditCarats,
    debitCarats: totalDebitCarats,
    creditGrams: totalCreditGrams,
    debitGrams: totalDebitGrams,
    creditPieces: totalCreditPieces,
    debitPieces: totalDebitPieces,
    creditItemsCount,
    debitItemsCount,
    totalActiveItems: creditItemsCount + debitItemsCount,
    hasOpposingBalances,
    bySpecies,
    items: Object.values(byDetail),
  };
}

export function transactionBalancesToCustomerBalances(
  transactions: CustomerTransaction[],
): CustomerBalanceValues {
  const totals = sumPostedTransactions(transactions);
  const currencyBalances = calculateCustomerCurrencyBalances(transactions);
  const stoneBalances = calculateCustomerStoneBalances(transactions);
  return {
    goldBalance: totals.goldAmount,
    silverBalance: totals.silverAmount,
    platinumBalance: totals.platinumAmount,
    rialBalance: totals.rialAmount,
    foreignBalance: totals.foreignAmount,
    tertiaryBalance: totals.tertiaryAmount,
    currencyBalances,
    stoneCaratBalance: stoneBalances.carats,
    stoneGramBalance: stoneBalances.grams,
    stonePiecesBalance: stoneBalances.pieces,
    stoneCreditCarats: stoneBalances.creditCarats,
    stoneDebitCarats: stoneBalances.debitCarats,
    stoneCreditGrams: stoneBalances.creditGrams,
    stoneDebitGrams: stoneBalances.debitGrams,
    stoneCreditPieces: stoneBalances.creditPieces,
    stoneDebitPieces: stoneBalances.debitPieces,
    hasOpposingStoneBalances: stoneBalances.hasOpposingBalances,
    stoneBalancesBySpecies: stoneBalances.bySpecies,
    stoneItemBalances: stoneBalances.items,
  };
}

export function openingTransactionToCustomerBalances(
  transaction?: CustomerTransaction,
): CustomerBalanceValues {
  if (!transaction) return emptyCustomerBalances();
  return {
    goldBalance: transaction.goldAmount,
    silverBalance: transaction.silverAmount,
    platinumBalance: transaction.platinumAmount,
    rialBalance: transaction.rialAmount,
    foreignBalance: transaction.foreignAmount,
    tertiaryBalance: transaction.tertiaryAmount,
    stoneCaratBalance: 0,
    stoneGramBalance: 0,
    stonePiecesBalance: 0,
    stoneBalancesBySpecies: {},
    stoneItemBalances: [],
  };
}

export function openingBalanceSourceKey(customerId: string) {
  return `opening:${customerId}`;
}

export function calculateCustomerDetailedStonePositions(
  transactions: CustomerTransaction[] = [],
  committedLines: any[] = [],
  fallbackStoneItemBalances?: CustomerStoneItemDetail[],
): CustomerStoneItemDetail[] {
  const itemsMap: Record<string, CustomerStoneItemDetail> = {};

  // 1. Initial items from transactions
  if (transactions && transactions.length > 0) {
    const computed = calculateCustomerStoneBalances(transactions);
    for (const it of computed.items) {
      itemsMap[it.key] = { ...it };
    }
  } else if (fallbackStoneItemBalances && fallbackStoneItemBalances.length > 0) {
    for (const it of fallbackStoneItemBalances) {
      itemsMap[it.key] = { ...it };
    }
  }

  // 2. Merge committed live draft lines
  if (committedLines && committedLines.length > 0) {
    for (const line of committedLines) {
      if (line.documentTab !== 'stone' && line.sourceTab !== 'stone') continue;
      const details = line.details || {};
      const opKind = String(details.stoneOperationKind || '');
      const subType = String(line.documentSubType || '');
      const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && line.settlementMethod === 'cash';

      const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
      const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
      const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

      const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
      const isWeightOp =
        opKind === 'entry' ||
        opKind === 'exit' ||
        opKind === 'purchase' ||
        opKind === 'sale' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'unsettled_sale' ||
        subType === 'stone-entry' ||
        subType === 'stone-exit' ||
        subType === 'stone-purchase' ||
        subType === 'stone-sale' ||
        subType === 'stone-unsettled-purchase' ||
        subType === 'stone-unsettled-sale' ||
        line.settlementMethod === 'weight' ||
        line.settlementMethod === 'unsettled' ||
        (!isTradeSettled && hasWeight);

      if (!isWeightOp) continue;

      // قاعده بازار سنگ: خرید از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (-1: بدهکار به ما)، فروش به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (+1: بستانکار از ما)
      const isPurchase =
        line.documentNature === 'received' ||
        opKind === 'purchase' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'entry' ||
        line.documentSubType === 'stone-purchase' ||
        line.documentSubType === 'stone-unsettled-purchase' ||
        line.documentSubType === 'stone-entry';
      const direction = isPurchase ? -1 : 1;

      const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
      const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);
      const pieces = rawPieces;

      const speciesId = String(details.stoneSpecies || details.stoneCategory || 'other_gemstone');
      const speciesName = String(details.stoneSpeciesName || details.stoneItemName || details.stoneCategory || 'سنگ');
      const category = String(details.stoneCategory || 'colored_gemstone');

      const shape = String(details.stoneShape || '');
      const shapeName = String(details.stoneShapeName || (shape ? getShapeNameFa(shape) : ''));
      const isParcel = details.stoneMode === 'parcel' || (!details.stoneMode && rawPieces > 1);
      const mode = isParcel ? ('parcel' as const) : ('single_stone' as const);

      let color = '';
      if (details.stoneColorMode === 'fancy') {
        color = [details.stoneFancyIntensity, details.stoneFancyHue].filter(Boolean).join(' ') || String(details.stoneColor || '');
      } else if (details.stoneColorRange) {
        color = String(details.stoneColorRange);
      } else if (details.stoneColor) {
        color = String(details.stoneColor);
      } else if (details.stoneColorHue) {
        color = String(details.stoneColorHue);
      }

      let clarity = '';
      if (details.stoneClarityRange) {
        clarity = String(details.stoneClarityRange);
      } else if (details.stoneClarity) {
        clarity = String(details.stoneClarity);
      }

      const rawCut = String(details.stoneCut || '');
      const cut = rawCut ? getCutGradeNameFa(rawCut) : '';
      const certLab = details.stoneCertificateLab && details.stoneCertificateLab !== 'none' ? String(details.stoneCertificateLab) : '';
      const certNumber = String(details.stoneCertificateNumber || '');
      const laser = String(details.stoneLaserInscription || '');

      const lotNumber = String(details.stoneLotNumber || '');
      const sieveSize = String(details.stoneSieveSize || '');
      const measurements =
        details.stoneMeasurementsLength || details.stoneMeasurementsWidth
          ? `${details.stoneMeasurementsLength || '—'} × ${details.stoneMeasurementsWidth || '—'}${details.stoneMeasurementsDepth ? ` × ${details.stoneMeasurementsDepth}` : ''} mm`
          : '';

      const isReferenceSettlement = Boolean(details.unsettledReferenceId && itemsMap[String(details.unsettledReferenceId)]);
      const detailKey = isParcel
        ? `parcel__${speciesId}__${shape}__${color}__${clarity}__${rawCut}__${lotNumber}__${sieveSize}`
        : (isReferenceSettlement
            ? String(details.unsettledReferenceId)
            : `single__draft_${line.id || (line as any).key || Math.random().toString(36).slice(2)}`);

      const effectiveDirection = isReferenceSettlement
        ? (itemsMap[String(details.unsettledReferenceId)].carats > 0 ? -1 : 1)
        : direction;
      const effectivePieceDir = isReferenceSettlement
        ? (itemsMap[String(details.unsettledReferenceId)].pieces > 0 ? -1 : 1)
        : direction;

      if (!itemsMap[detailKey]) {
        itemsMap[detailKey] = {
          key: detailKey,
          speciesId,
          speciesName,
          category,
          shape,
          shapeName,
          mode,
          color,
          clarity,
          cut,
          certificateLab: certLab,
          certificateNumber: certNumber,
          laserInscription: laser,
          lotNumber,
          sieveSize,
          measurements,
          carats: 0,
          grams: 0,
          pieces: 0,
        };
      }
      itemsMap[detailKey].carats = Math.round(((itemsMap[detailKey].carats || 0) + carats * effectiveDirection) * 1e8) / 1e8;
      itemsMap[detailKey].grams = Math.round(((itemsMap[detailKey].grams || 0) + grams * effectiveDirection) * 1e8) / 1e8;
      itemsMap[detailKey].pieces = (itemsMap[detailKey].pieces || 0) + (isReferenceSettlement ? Math.abs(pieces) * effectivePieceDir : pieces * direction);
    }
  }

  return Object.values(itemsMap).filter(
    (it) => Math.abs(it.carats) > 0.0000001 || Math.abs(it.grams) > 0.0000001 || Math.abs(it.pieces) > 0,
  );
}

