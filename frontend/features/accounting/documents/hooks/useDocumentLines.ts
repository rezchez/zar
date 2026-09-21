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

function documentSubType(nature: DocumentNature, kind: RawOperationKind) {
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

  return {
    id: crypto.randomUUID(),
    documentNature: nature,
    documentTab: docTab,
    sourceTab,
    documentSubType:
      sourceTab === 'refining'
        ? nature === 'paid'
          ? 'outgoing-refining'
          : 'incoming-refining'
        : documentSubType(nature, 'molten'),
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
        details: { ...current.details, rawKind: kind },
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

    const lineSourceTab =
      draftLine.sourceTab ||
      (draftLine.documentTab === 'currency'
        ? 'currency'
        : draftLine.documentTab === 'gold-sale'
          ? 'gold-sale'
          : draftLine.documentTab === 'refining'
            ? 'refining'
            : 'metals');

    const docTypeLabel = getLineDocumentTypeLabel(
      documentNature,
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

    const lineToCommit: DocumentLine = {
      ...draftLine,
      documentNature,
      sourceTab: lineSourceTab,
      documentTypeLabel: docTypeLabel,
      converted750: c750,
      description: draftLine.description ? draftLine.description.trim() : '',
      details: { ...draftLine.details, baseKarat },
    };

    if (editingLineId) {
      setCommittedLines((current) =>
        current.map((line) => (line.id === editingLineId ? lineToCommit : line)),
      );
      setEditingLineId(null);
      toast.success('ردیف با موفقیت ویرایش شد.');
    } else {
      setCommittedLines((current) => [...current, lineToCommit]);
      toast.success('ردیف به سند اضافه شد.');
    }

    // Reset draft line
    setDraftLine(createSettingsLine(documentNature, activeEntryTab));
    return true;
  };

  const editLine = (line: DocumentLine) => {
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
    const index = committedLines.findIndex((l) => l.id === targetLine.id);
    if (index !== -1) {
      setCommittedLines((current) => current.filter((l) => l.id !== targetLine.id));
      setRestorationState({ line: targetLine, index });
    }
    setDeleteConfirmLine(null);
  };

  const restoreLine = () => {
    if (!restorationState) return;
    const { line, index } = restorationState;
    setCommittedLines((current) => {
      const copy = [...current];
      const targetIndex = Math.min(index, copy.length);
      copy.splice(targetIndex, 0, line);
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
