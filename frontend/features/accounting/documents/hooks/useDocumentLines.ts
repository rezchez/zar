'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DocumentNature } from '@/lib/document';
import type {
  DetailState,
  DocumentLine,
  MeltedInventoryItem,
  RawOperationKind,
} from '@/src/components/documents/RawGoldTab';
import type { AppSettings } from '@/lib/settings';
import { useToastManager } from '@/components/ui/toast';
import { normalizeDigits } from '@/lib/jalali';
import {
  actualWeightFromMoney,
  convertedTo750,
  getLineDocumentTypeLabel,
  numberValue,
} from '../utils/document-helpers';

type CalculationMethod = DetailState['calculationMethod'];
type MetalPriceType = DetailState['metalPriceType'];
type MetalType = DetailState['metalType'];

const MESGHAL_17_TO_GRAM_18 = 4.3318;
const TROY_OUNCE_GRAMS = 31.1035;

export function baseKaratForMetal(
  metalType: MetalType,
  settings: Pick<AppSettings, 'goldBaseKarat' | 'silverBaseKarat' | 'platinumBaseKarat'>,
) {
  if (metalType === 'silver') return settings.silverBaseKarat;
  if (metalType === 'platinum') return settings.platinumBaseKarat;
  return settings.goldBaseKarat;
}

function silverPricePurity(type: MetalPriceType) {
  if (type === 'gramSilver925') return 925;
  if (type === 'gramSilver995') return 995;
  if (type === 'gramSilver999') return 999;
  return 0;
}

function pricePerBaseGram(type: MetalPriceType, price: string, baseKarat = 750) {
  const value = numberValue(price);
  if (value <= 0) return 0;
  if (type === 'mesghal17') return value / MESGHAL_17_TO_GRAM_18;
  if (type === 'ounceUsd') return value / TROY_OUNCE_GRAMS;
  const silverPurity = silverPricePurity(type);
  if (silverPurity > 0) return value * (baseKarat / silverPurity);
  return value;
}

export function totalFromWeight(
  weight: string,
  purity: string,
  type: MetalPriceType,
  price: string,
  baseKarat = 750,
) {
  return Math.round(convertedTo750(weight, purity, baseKarat) * pricePerBaseGram(type, price, baseKarat));
}

export function convertedWeightFromTotal(
  total: string,
  type: MetalPriceType,
  price: string,
  baseKarat = 750,
) {
  const perGram = pricePerBaseGram(type, price, baseKarat);
  return perGram > 0 ? numberValue(total) / perGram : 0;
}

export function documentSubType(nature: DocumentNature, kind: RawOperationKind) {
  return `${nature === 'received' ? 'incoming' : 'outgoing'}-${kind}`;
}

function currencyDocumentSubType(nature: DocumentNature) {
  return nature === 'received' ? 'currency-purchase' : 'currency-sale';
}

export function createLine(nature: DocumentNature = 'received', sourceTab = 'metals'): DocumentLine {
  const docTab =
    sourceTab === 'currency'
      ? 'currency'
      : sourceTab === 'gold-sale'
        ? 'gold-sale'
        : sourceTab === 'workmanship'
          ? 'workmanship'
          : sourceTab === 'coin'
            ? 'coin'
            : sourceTab === 'cash'
              ? 'cash'
              : sourceTab === 'bank'
                ? 'bank'
                : sourceTab === 'claim'
                  ? 'claim'
                  : sourceTab === 'refining'
                    ? 'refining'
                    : 'raw-gold';

  const docSubType =
    sourceTab === 'gold-sale'
      ? `${nature === 'received' ? 'gold-purchase' : 'gold-sale'}-molten`
      : sourceTab === 'refining'
        ? nature === 'paid'
          ? 'outgoing-refining'
          : 'incoming-refining'
        : documentSubType(nature, 'molten');

  return {
    id: crypto.randomUUID(),
    documentNature: nature,
    documentTab: docTab,
    sourceTab,
    documentSubType: docSubType,
    settlementMethod: 'weight',
    balanceSource: 'current',
    description: '',
    details: {
      metalType: 'gold',
      baseKarat: 750,
      rawKind: 'molten',
      rawWeight: '',
      purity: '750',
      calculationMethod: 'weight',
      metalPriceType: 'gram18',
      metalPrice: '',
      totalAmount: '',
      labName: '',
      stampNumber: '',
      currencyUnit: '',
      currencyQuantity: '',
      currencyUnitPrice: '',
      currencyTotalAmount: '',
      unsettledTrade: false,
      currencyTradeId: '',
      settlementCurrencyUnit: '',
      settlementQuantity: '',
      settlesTradeId: '',
      inventorySourceId: '',
      refiningOpKind: nature === 'paid' ? 'delivery' : 'receipt',
    },
  };
}

export function createCurrencyLine(
  nature: DocumentNature = 'received',
  defaultCurrencyUnit = 'USD',
): DocumentLine {
  const line = createLine(nature, 'currency');
  return {
    ...line,
    documentTab: 'currency',
    sourceTab: 'currency',
    documentSubType: currencyDocumentSubType(nature),
    settlementMethod: 'cash',
    details: {
      ...line.details,
      currencyTradeId: line.id,
      currencyUnit: line.details.currencyUnit || defaultCurrencyUnit,
      settlementCurrencyUnit: line.details.settlementCurrencyUnit || defaultCurrencyUnit,
    },
  };
}

export function isLineReady(line: DocumentLine) {
  if (line.documentTab === 'currency') {
    return (
      numberValue(line.details.currencyQuantity) > 0 &&
      numberValue(line.details.currencyUnitPrice) > 0 &&
      numberValue(line.details.currencyTotalAmount) > 0
    );
  }
  if (line.documentTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0 && Boolean(line.details.workmanshipName?.trim());
  }
  if (line.documentTab === 'refining') {
    const opKind =
      line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      return numberValue(line.details.totalAmount) > 0;
    }
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0;
  }
  const rawWeight =
    line.details.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
      : numberValue(line.details.rawWeight);
  if (line.documentTab === 'raw-gold') return rawWeight > 0;
  return (
    rawWeight > 0 &&
    numberValue(line.details.totalAmount) > 0 &&
    numberValue(line.details.metalPrice) > 0
  );
}

export function validateLine(
  line: DocumentLine,
  inventory: MeltedInventoryItem[] = [],
  committedLines: DocumentLine[] = [],
  editingLineId: string | null = null,
) {
  if (line.documentTab === 'currency') {
    if (!line.details.currencyUnit) return 'واحد ارز را انتخاب کنید.';
    if (numberValue(line.details.currencyQuantity) <= 0) return 'تعداد ارز باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyUnitPrice) <= 0) return 'قیمت هر واحد باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyTotalAmount) <= 0) return 'مبلغ کل باید بیشتر از صفر باشد.';
    return '';
  }
  if (line.documentTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن کار ساخته باید بیشتر از صفر باشد.';
    if (!line.details.workmanshipName?.trim()) return 'نام کار ساخته را وارد کنید.';
    return '';
  }
  if (line.documentTab === 'refining') {
    const opKind =
      line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      if (numberValue(line.details.totalAmount) <= 0) return 'مبلغ اجرت ری‌گیری باید بیشتر از صفر باشد.';
      return '';
    }
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن باید بیشتر از صفر باشد.';
    if (opKind !== 'sample_send') {
      const purityNum = numberValue(line.details.purity);
      if (purityNum <= 0 || purityNum > 1000) return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
    return '';
  }
  const rawWeight =
    line.details.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
      : numberValue(line.details.rawWeight);
  if (rawWeight <= 0) {
    return 'وزن طلای خام باید بیشتر از صفر باشد.';
  }
  if (
    line.documentTab === 'gold-sale' &&
    (numberValue(line.details.metalPrice) <= 0 || numberValue(line.details.totalAmount) <= 0)
  ) {
    return 'نوع فی، قیمت فلز و مبلغ کل را کامل وارد کنید.';
  }
  if (line.details.rawKind !== 'conditional') {
    const purityStr = normalizeDigits(line.details.purity).trim();
    const purityNum = numberValue(purityStr);
    if (!purityStr || purityNum <= 0) {
      return 'وارد کردن عیار برای این ردیف الزامی است.';
    }
    if (purityNum < 1 || purityNum > 1000) {
      return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
  }
  return '';
}

interface UseDocumentLinesProps {
  documentNature: DocumentNature;
  activeEntryTab: string;
  settings: AppSettings;
  selectedCurrency: string;
}

export function useDocumentLines({
  documentNature,
  activeEntryTab,
  settings,
  selectedCurrency,
}: UseDocumentLinesProps) {
  const toast = useToastManager();
  const purityForMetal = (metalType: MetalType) => baseKaratForMetal(metalType, settings);

  const createSettingsLine = useCallback(
    (nature: DocumentNature = 'received', sourceTab = 'metals') => {
      const line =
        sourceTab === 'currency'
          ? createCurrencyLine(nature, selectedCurrency || 'USD')
          : createLine(nature, sourceTab);
      return {
        ...line,
        details: {
          ...line.details,
          purity: String(purityForMetal(line.details.metalType)),
          baseKarat: purityForMetal(line.details.metalType),
        },
      };
    },
    [selectedCurrency, settings],
  );

  const [committedLines, setCommittedLines] = useState<DocumentLine[]>([]);
  const [draftLine, setDraftLine] = useState<DocumentLine>(() =>
    createSettingsLine(documentNature, activeEntryTab),
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineValidationErrors, setLineValidationErrors] = useState<{
    labName?: string;
    stampNumber?: string;
  }>({});
  const labInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // Deletion and restoration
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<DocumentLine | null>(null);
  const [restorationState, setRestorationState] = useState<{
    line: DocumentLine;
    linkedLine?: DocumentLine;
    index: number;
  } | null>(null);
  const [restorationTimer, setRestorationTimer] = useState(10);
  const restorationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (restorationState) {
      setRestorationTimer(10);
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
      restorationIntervalRef.current = setInterval(() => {
        setRestorationTimer((prev) => {
          if (prev <= 1) {
            setRestorationState(null);
            if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
    }
    return () => {
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
    };
  }, [restorationState]);

  const updateDraftDetail = useCallback(
    <K extends keyof DetailState>(field: K, value: DetailState[K]) => {
      setDraftLine((current) => ({
        ...current,
        details: { ...current.details, [field]: value },
      }));
    },
    [],
  );

  const updateMetalValue = useCallback(
    (
      field: 'rawWeight' | 'purity' | 'calculationMethod' | 'metalPriceType' | 'metalPrice' | 'totalAmount',
      value: string,
    ) => {
      setDraftLine((current) => {
        const details = { ...current.details, [field]: value } as DetailState;
        if (field === 'calculationMethod') {
          details.calculationMethod = value as CalculationMethod;
        }
        const baseKarat = purityForMetal(details.metalType);
        details.baseKarat = baseKarat;
        const converted = convertedTo750(details.rawWeight, details.purity, baseKarat);
        if (details.calculationMethod === 'weight') {
          if (field !== 'totalAmount') {
            details.totalAmount = String(
              totalFromWeight(
                details.rawWeight,
                details.purity,
                details.metalPriceType,
                details.metalPrice,
                baseKarat,
              ) || '',
            );
          }
        } else {
          const computed = convertedWeightFromTotal(
            details.totalAmount,
            details.metalPriceType,
            details.metalPrice,
            baseKarat,
          );
          if (computed > 0)
            details.rawWeight = String(
              (computed * baseKarat) / Math.max(1, numberValue(details.purity)),
            );
        }
        if (details.calculationMethod === 'weight' && field === 'metalPriceType' && converted > 0) {
          details.totalAmount = String(
            totalFromWeight(
              details.rawWeight,
              details.purity,
              details.metalPriceType,
              details.metalPrice,
              baseKarat,
            ) || '',
          );
        }
        return {
          ...current,
          settlementMethod: details.rawKind === 'unsettled' ? 'unsettled' : 'weight',
          details,
        };
      });
    },
    [settings],
  );

  const changeRawKind = useCallback((kind: RawOperationKind) => {
    setDraftLine((current) => {
      const sourceTab = current.sourceTab || 'metals';
      const isGoldSale = current.documentTab === 'gold-sale' || sourceTab === 'gold-sale';
      return {
        ...current,
        settlementMethod: kind === 'unsettled' ? 'unsettled' : 'weight',
        documentSubType: isGoldSale
          ? `${current.documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${kind}`
          : documentSubType(current.documentNature, kind),
        details: {
          ...current.details,
          rawKind: kind,
          ...(kind === 'misc' || kind === 'question' ? { labName: '', stampNumber: '' } : {}),
        },
      };
    });
  }, []);

  const validateGoldAssayFields = (line: DocumentLine) => {
    const isGold = line.details.metalType === 'gold';
    const isMoltenOrConditional =
      line.details.rawKind === 'molten' || line.details.rawKind === 'conditional';
    const rawWeight =
      line.details.calculationMethod === 'money'
        ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
        : numberValue(line.details.rawWeight);

    if (isGold && isMoltenOrConditional && rawWeight > 0) {
      const isConditional = line.details.rawKind === 'conditional';
      const kindLabel = isConditional ? 'طلای شرطی' : 'طلای آب‌شده';
      const labName = line.details.labName?.trim();
      const stampNumber = line.details.stampNumber?.trim();

      if (!labName) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن نام آزمایشگاه یا ری‌گیری الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { labName: msg }, firstFocusField: 'lab' as const };
      }
      if (!stampNumber) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن شماره پاکت یا انگ الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { stampNumber: msg }, firstFocusField: 'stamp' as const };
      }
    }
    return { valid: true, errors: {} };
  };

  const commitDraftLine = (meltedInventory: MeltedInventoryItem[] = []) => {
    if (
      (draftLine.documentTab === 'currency' || draftLine.sourceTab === 'currency' || activeEntryTab === 'currency') &&
      !draftLine.details.currencyUnit
    ) {
      const fallbackUnit = selectedCurrency || 'USD';
      draftLine.details.currencyUnit = fallbackUnit;
      draftLine.details.settlementCurrencyUnit = draftLine.details.settlementCurrencyUnit || fallbackUnit;
    }

    const validationMessage = validateLine(draftLine, meltedInventory, committedLines, editingLineId);
    if (validationMessage) {
      toast.error(validationMessage);
      return false;
    }

    const assayCheck = validateGoldAssayFields(draftLine);
    if (!assayCheck.valid) {
      setLineValidationErrors(assayCheck.errors);
      if (assayCheck.errorMsg) {
        toast.error(assayCheck.errorMsg);
      }
      if (assayCheck.firstFocusField === 'lab') {
        labInputRef.current?.focus();
      } else if (assayCheck.firstFocusField === 'stamp') {
        stampInputRef.current?.focus();
      }
      return false;
    }

    setLineValidationErrors({});

    const lineSourceTab = editingLineId
      ? (draftLine.sourceTab || activeEntryTab || 'metals')
      : (activeEntryTab || draftLine.sourceTab || 'metals');

    const lineNature = editingLineId
      ? (draftLine.documentNature || documentNature)
      : documentNature;

    const docTypeLabel = getLineDocumentTypeLabel(
      lineNature,
      lineSourceTab,
      draftLine.details.rawKind,
      draftLine.details.unsettledTrade,
      draftLine.details.refiningOpKind,
    );

    const rawWeight =
      draftLine.details.calculationMethod === 'money'
        ? actualWeightFromMoney(draftLine.details, purityForMetal(draftLine.details.metalType))
        : numberValue(draftLine.details.rawWeight);
    const baseKarat = purityForMetal(draftLine.details.metalType);
    const c750 = convertedTo750(String(rawWeight), draftLine.details.purity, baseKarat);

    const effectiveCurrencyUnit =
      draftLine.details.currencyUnit ||
      selectedCurrency ||
      'USD';

    const lineToCommit: DocumentLine = {
      ...draftLine,
      documentNature: lineNature,
      sourceTab: lineSourceTab,
      documentTypeLabel: docTypeLabel,
      converted750: c750,
      description: draftLine.description ? draftLine.description.trim() : '',
      details: {
        ...draftLine.details,
        baseKarat,
        currencyUnit: lineSourceTab === 'currency' ? effectiveCurrencyUnit : draftLine.details.currencyUnit,
        settlementCurrencyUnit: lineSourceTab === 'currency' ? (draftLine.details.settlementCurrencyUnit || effectiveCurrencyUnit) : draftLine.details.settlementCurrencyUnit,
      },
    };

    const isSettledMetalTrade =
      (lineSourceTab === 'gold-sale' || draftLine.documentTab === 'gold-sale') &&
      (draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'misc') &&
      !draftLine.details.unsettledTrade &&
      draftLine.settlementMethod !== 'unsettled';

    const isCurrencyTrade =
      lineSourceTab === 'currency' || draftLine.documentTab === 'currency' || activeEntryTab === 'currency';
    const isUnsettledCurrency =
      isCurrencyTrade &&
      (Boolean(draftLine.details.unsettledTrade) || draftLine.settlementMethod === 'unsettled');

    const currencyTradeDocTypeLabel =
      lineNature === 'received' ? 'خرید ارز' : 'فروش ارز';
    const currencyTradeSubType =
      lineNature === 'received' ? 'currency-purchase' : 'currency-sale';

    const currencyClaimDocTypeLabel =
      lineNature === 'received' ? 'طلب ارزی' : 'بدهی ارزی';
    const currencyClaimSubType =
      lineNature === 'received' ? 'currency-claim' : 'currency-debt';

    const tradeDocTypeLabel =
      lineNature === 'received'
        ? draftLine.details.rawKind === 'misc' ? 'خرید متفرقه' : 'خرید آب‌شده'
        : draftLine.details.rawKind === 'misc' ? 'فروش متفرقه' : 'فروش آب‌شده';
    const tradeSubType =
      `${lineNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${draftLine.details.rawKind === 'misc' ? 'misc' : 'molten'}`;

    const physicalDocNature = lineNature;
    const physicalTypeLabel =
      physicalDocNature === 'received'
        ? draftLine.details.rawKind === 'misc' ? 'ورود متفرقه' : 'ورود آبشده'
        : draftLine.details.rawKind === 'misc' ? 'خروج متفرقه' : 'خروج آبشده';
    const physicalSubType =
      physicalDocNature === 'received'
        ? draftLine.details.rawKind === 'misc' ? 'incoming-misc' : 'incoming-molten'
        : draftLine.details.rawKind === 'misc' ? 'outgoing-misc' : 'outgoing-molten';

    if (editingLineId) {
      if (isSettledMetalTrade) {
        setCommittedLines((current) => {
          const tradeLine: DocumentLine = {
            ...lineToCommit,
            documentNature: lineNature,
            documentTab: 'gold-sale',
            sourceTab: 'gold-sale',
            documentTypeLabel: tradeDocTypeLabel,
            documentSubType: tradeSubType,
            converted750: c750,
            details: {
              ...lineToCommit.details,
              baseKarat,
            },
          };
          const existingPhysicalIndex = current.findIndex(
            (l) =>
              (tradeLine.details.linkedLineId && l.id === tradeLine.details.linkedLineId) ||
              (l.details?.linkedLineId === editingLineId && l.documentTab === 'raw-gold'),
          );

          if (existingPhysicalIndex !== -1) {
            const existingPhysical = current[existingPhysicalIndex];
            const updatedPhysical: DocumentLine = {
              ...existingPhysical,
              documentNature: physicalDocNature,
              converted750: c750,
              documentTypeLabel: physicalTypeLabel,
              documentSubType: physicalSubType,
              details: {
                ...existingPhysical.details,
                metalType: draftLine.details.metalType || 'gold',
                rawKind: draftLine.details.rawKind,
                rawWeight: String(rawWeight),
                purity: draftLine.details.purity,
                baseKarat,
                labName: draftLine.details.labName?.trim() || '',
                stampNumber: draftLine.details.stampNumber?.trim() || '',
                inventorySourceId: draftLine.details.inventorySourceId || '',
                linkedLineId: tradeLine.id,
              },
            };
            tradeLine.details.linkedLineId = updatedPhysical.id;
            return current.map((l) => {
              if (l.id === editingLineId) return tradeLine;
              if (l.id === updatedPhysical.id) return updatedPhysical;
              return l;
            });
          } else {
            const physicalLineId = crypto.randomUUID();
            tradeLine.details.linkedLineId = physicalLineId;
            const newPhysical: DocumentLine = {
              id: physicalLineId,
              documentNature: physicalDocNature,
              documentTab: 'raw-gold',
              sourceTab: 'metals',
              documentTypeLabel: physicalTypeLabel,
              documentSubType: physicalSubType,
              settlementMethod: 'weight',
              balanceSource: 'current',
              converted750: c750,
              description: draftLine.description ? draftLine.description.trim() : '',
              details: {
                ...draftLine.details,
                calculationMethod: 'weight',
                metalType: draftLine.details.metalType || 'gold',
                rawKind: draftLine.details.rawKind,
                rawWeight: String(rawWeight),
                purity: draftLine.details.purity,
                baseKarat,
                totalAmount: '0',
                metalPrice: '0',
                labName: draftLine.details.labName?.trim() || '',
                stampNumber: draftLine.details.stampNumber?.trim() || '',
                inventorySourceId: draftLine.details.inventorySourceId || '',
                linkedLineId: tradeLine.id,
              },
            };
            return current.map((l) => (l.id === editingLineId ? tradeLine : l)).concat(newPhysical);
          }
        });
        setEditingLineId(null);
        toast.success(
          lineNature === 'received'
            ? 'ردیف خرید و ردیف ورود فیزیکی با موفقیت ویرایش شدند.'
            : 'ردیف فروش و ردیف خروج فیزیکی با موفقیت ویرایش شدند.',
        );
      } else if (draftLine.documentTab === 'raw-gold' && draftLine.details.linkedLineId) {
        setCommittedLines((current) => {
          const physicalLine = {
            ...lineToCommit,
            details: {
              ...lineToCommit.details,
              baseKarat,
            },
          };
          return current.map((l) => {
            if (l.id === editingLineId) return physicalLine;
            if (l.id === draftLine.details.linkedLineId && l.documentTab === 'gold-sale') {
              const updatedRawWeight = String(rawWeight);
              const updatedPurity = draftLine.details.purity;
              const recomputedTotal = totalFromWeight(
                updatedRawWeight,
                updatedPurity,
                l.details.metalPriceType,
                l.details.metalPrice,
                baseKarat,
              );
              return {
                ...l,
                converted750: c750,
                details: {
                  ...l.details,
                  rawWeight: updatedRawWeight,
                  purity: updatedPurity,
                  labName: draftLine.details.labName?.trim() || '',
                  stampNumber: draftLine.details.stampNumber?.trim() || '',
                  baseKarat,
                  totalAmount: recomputedTotal ? String(recomputedTotal) : l.details.totalAmount,
                },
              };
            }
            return l;
          });
        });
        setEditingLineId(null);
        toast.success('ردیف با موفقیت ویرایش شد.');
      } else if (isCurrencyTrade) {
        setCommittedLines((current) => {
          const tradeLine: DocumentLine = {
            ...lineToCommit,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: isUnsettledCurrency,
            },
          };

          const existingClaimIndex = current.findIndex(
            (l) =>
              (tradeLine.details.linkedLineId && l.id === tradeLine.details.linkedLineId) ||
              (l.details?.linkedLineId === editingLineId &&
                (l.documentSubType === 'currency-claim' || l.documentSubType === 'currency-debt')),
          );

          if (isUnsettledCurrency) {
            if (existingClaimIndex !== -1) {
              const existingClaim = current[existingClaimIndex];
              const updatedClaim: DocumentLine = {
                ...existingClaim,
                documentNature: lineNature,
                documentTab: 'currency',
                sourceTab: 'currency',
                documentTypeLabel: currencyClaimDocTypeLabel,
                documentSubType: currencyClaimSubType,
                settlementMethod: 'unsettled',
                details: {
                  ...existingClaim.details,
                  currencyUnit: effectiveCurrencyUnit,
                  currencyQuantity: draftLine.details.currencyQuantity,
                  currencyUnitPrice: '0',
                  currencyTotalAmount: '0',
                  unsettledTrade: true,
                  linkedLineId: tradeLine.id,
                },
              };
              tradeLine.details.linkedLineId = updatedClaim.id;
              return current.map((l) => {
                if (l.id === editingLineId) return tradeLine;
                if (l.id === updatedClaim.id) return updatedClaim;
                return l;
              });
            } else {
              const claimLineId = crypto.randomUUID();
              tradeLine.details.linkedLineId = claimLineId;
              const newClaim: DocumentLine = {
                id: claimLineId,
                documentNature: lineNature,
                documentTab: 'currency',
                sourceTab: 'currency',
                documentTypeLabel: currencyClaimDocTypeLabel,
                documentSubType: currencyClaimSubType,
                settlementMethod: 'unsettled',
                balanceSource: 'current',
                description: draftLine.description
                  ? draftLine.description.trim()
                  : lineNature === 'received'
                    ? 'طلب ارزی بابت خرید بدون تسویه'
                    : 'بدهی ارزی بابت فروش بدون تسویه',
                details: {
                  ...draftLine.details,
                  currencyUnit: effectiveCurrencyUnit,
                  currencyQuantity: draftLine.details.currencyQuantity,
                  currencyUnitPrice: '0',
                  currencyTotalAmount: '0',
                  unsettledTrade: true,
                  linkedLineId: tradeLine.id,
                },
              };
              return current.map((l) => (l.id === editingLineId ? tradeLine : l)).concat(newClaim);
            }
          } else {
            const linkedId = tradeLine.details.linkedLineId;
            delete tradeLine.details.linkedLineId;
            return current
              .map((l) => (l.id === editingLineId ? tradeLine : l))
              .filter((l) => !linkedId || l.id !== linkedId);
          }
        });
        setEditingLineId(null);
        toast.success(
          isUnsettledCurrency
            ? (lineNature === 'received'
                ? 'ردیف خرید ارز و ردیف طلب ارزی با موفقیت ویرایش شدند.'
                : 'ردیف فروش ارز و ردیف بدهی ارزی با موفقیت ویرایش شدند.')
            : (lineNature === 'received'
                ? 'ردیف خرید ارز با تسویه آنی ویرایش شد.'
                : 'ردیف فروش ارز با تسویه آنی ویرایش شد.')
        );
      } else {
        const linkedId = draftLine.details?.linkedLineId;
        setCommittedLines((current) => {
          let updated = current.map((line) => (line.id === editingLineId ? lineToCommit : line));
          if (lineToCommit.documentTab === 'gold-sale' && !isSettledMetalTrade && linkedId) {
            updated = updated.filter((l) => l.id !== linkedId);
          }
          return updated;
        });
        setEditingLineId(null);
        toast.success('ردیف با موفقیت ویرایش شد.');
      }
    } else {
      if (isSettledMetalTrade) {
        const tradeLineId = draftLine.id || crypto.randomUUID();
        const physicalLineId = crypto.randomUUID();

        const tradeLineToCommit: DocumentLine = {
          ...lineToCommit,
          id: tradeLineId,
          documentNature,
          documentTab: 'gold-sale',
          sourceTab: 'gold-sale',
          documentTypeLabel: tradeDocTypeLabel,
          documentSubType: tradeSubType,
          converted750: c750,
          details: {
            ...lineToCommit.details,
            baseKarat,
            linkedLineId: physicalLineId,
          },
        };

        const physicalLineToCommit: DocumentLine = {
          id: physicalLineId,
          documentNature: physicalDocNature,
          documentTab: 'raw-gold',
          sourceTab: 'metals',
          documentTypeLabel: physicalTypeLabel,
          documentSubType: physicalSubType,
          settlementMethod: 'weight',
          balanceSource: 'current',
          converted750: c750,
          description: draftLine.description ? draftLine.description.trim() : '',
          details: {
            ...draftLine.details,
            calculationMethod: 'weight',
            metalType: draftLine.details.metalType || 'gold',
            rawKind: draftLine.details.rawKind,
            rawWeight: String(rawWeight),
            purity: draftLine.details.purity,
            baseKarat,
            totalAmount: '0',
            metalPrice: '0',
            labName: draftLine.details.labName?.trim() || '',
            stampNumber: draftLine.details.stampNumber?.trim() || '',
            inventorySourceId: draftLine.details.inventorySourceId || '',
            linkedLineId: tradeLineId,
          },
        };

        setCommittedLines((current) => [...current, tradeLineToCommit, physicalLineToCommit]);
        toast.success(
          lineNature === 'received'
            ? 'ردیف خرید و ردیف ورود فیزیکی طلا به سند اضافه شدند.'
            : 'ردیف فروش و ردیف خروج فیزیکی طلا به سند اضافه شدند.',
        );
      } else if (isCurrencyTrade) {
        const tradeLineId = draftLine.id || crypto.randomUUID();

        if (isUnsettledCurrency) {
          const claimLineId = crypto.randomUUID();

          const tradeLineToCommit: DocumentLine = {
            ...lineToCommit,
            id: tradeLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: true,
              linkedLineId: claimLineId,
            },
          };

          const claimLineToCommit: DocumentLine = {
            id: claimLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyClaimDocTypeLabel,
            documentSubType: currencyClaimSubType,
            settlementMethod: 'unsettled',
            balanceSource: 'current',
            description: draftLine.description
              ? draftLine.description.trim()
              : lineNature === 'received'
                ? 'طلب ارزی بابت خرید بدون تسویه'
                : 'بدهی ارزی بابت فروش بدون تسویه',
            details: {
              ...draftLine.details,
              currencyUnit: effectiveCurrencyUnit,
              currencyQuantity: draftLine.details.currencyQuantity,
              currencyUnitPrice: '0',
              currencyTotalAmount: '0',
              unsettledTrade: true,
              linkedLineId: tradeLineId,
            },
          };

          setCommittedLines((current) => [...current, tradeLineToCommit, claimLineToCommit]);
          toast.success(
            lineNature === 'received'
              ? 'ردیف خرید ارز و ردیف طلب ارزی به سند اضافه شدند.'
              : 'ردیف فروش ارز و ردیف بدهی ارزی به سند اضافه شدند.',
          );
        } else {
          const tradeLineToCommit: DocumentLine = {
            ...lineToCommit,
            id: tradeLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            settlementMethod: 'cash',
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: false,
            },
          };
          setCommittedLines((current) => [...current, tradeLineToCommit]);
          toast.success(
            lineNature === 'received'
              ? 'ردیف خرید ارز با تسویه آنی ثبت شد.'
              : 'ردیف فروش ارز با تسویه آنی ثبت شد.',
          );
        }
      } else {
        setCommittedLines((current) => [...current, lineToCommit]);
        toast.success('ردیف به سند اضافه شد.');
      }
    }

    // Reset draft line
    setDraftLine(createSettingsLine(documentNature, activeEntryTab));
    return true;
  };

  const editLine = (line: DocumentLine) => {
    if (
      (line.documentSubType === 'currency-claim' || line.documentSubType === 'currency-debt') &&
      line.details?.linkedLineId
    ) {
      const parentLine = committedLines.find((l) => l.id === line.details.linkedLineId);
      if (parentLine) {
        setEditingLineId(parentLine.id);
        setDraftLine({ ...parentLine });
        return;
      }
    }
    setEditingLineId(line.id);
    setDraftLine({ ...line });
  };

  const cancelEdit = () => {
    setEditingLineId(null);
    setDraftLine(createSettingsLine(documentNature, activeEntryTab));
  };

  const requestRemoveLine = (line: DocumentLine) => {
    setDeleteConfirmLine(line);
  };

  const confirmRemoveLine = () => {
    if (!deleteConfirmLine) return;
    const targetLine = deleteConfirmLine;
    const linkedId = targetLine.details?.linkedLineId;
    const index = committedLines.findIndex((l) => l.id === targetLine.id);
    if (index !== -1) {
      const linkedLine = linkedId
        ? committedLines.find((l) => l.id === linkedId || l.details?.linkedLineId === targetLine.id)
        : undefined;

      setCommittedLines((current) =>
        current.filter(
          (l) =>
            l.id !== targetLine.id &&
            (!linkedId || l.id !== linkedId) &&
            l.details?.linkedLineId !== targetLine.id,
        ),
      );
      setRestorationState({ line: targetLine, linkedLine, index });
    }
    setDeleteConfirmLine(null);
  };

  const restoreLine = () => {
    if (!restorationState) return;
    const { line, linkedLine, index } = restorationState;
    setCommittedLines((current) => {
      const copy = [...current];
      const targetIndex = Math.min(index, copy.length);
      if (linkedLine) {
        copy.splice(targetIndex, 0, line, linkedLine);
      } else {
        copy.splice(targetIndex, 0, line);
      }
      return copy;
    });
    setRestorationState(null);
  };

  return {
    committedLines,
    setCommittedLines,
    draftLine,
    setDraftLine,
    editingLineId,
    setEditingLineId,
    commitDraftLine,
    editLine,
    cancelEdit,
    requestRemoveLine,
    confirmRemoveLine,
    restoreLine,
    deleteConfirmLine,
    setDeleteConfirmLine,
    restorationState,
    restorationTimer,
    updateDraftDetail,
    updateMetalValue,
    changeRawKind,
    purityForMetal,
    createSettingsLine,
    draftReady: isLineReady(draftLine),
    lineValidationErrors,
    labInputRef,
    stampInputRef,
  };
}
