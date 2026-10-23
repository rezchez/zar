'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  Wrench,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  ListPlus,
  Tag,
  Scale,
  Coins,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';

import { useAppSettings } from '@/src/components/SettingsProvider';
import { PriceInput } from '@/components/ui/price-input';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { generateUUID } from '@/lib/uuid';
import { parseLocalizedAmount, formatMoney } from '@/lib/money';
import { DEFAULT_STANDARD_CURRENCIES } from '@/lib/currencies';
import { getWorkmanshipPercentageLabel } from '../utils/document-helpers';

export type WorkmanshipOperationType =
  // Payment Document (سند پرداختی)
  | 'exit_manufactured' // خروج کار ساخته
  | 'sale_manufactured' // فروش کار ساخته
  | 'return_exit' // خروج مرجوعی
  | 'return_sale' // فروش مرجوعی
  // Receipt Document (سند دریافتی)
  | 'entry_manufactured' // ورود کار ساخته
  | 'buy_manufactured' // خرید کار ساخته
  | 'return_entry' // ورود مرجوعی
  | 'return_buy'; // خرید مرجوعی

export type MetalType = 'gold' | 'silver' | 'platinum';
export type WageMode = 'per_gram' | 'per_item';

export interface ReturnedWorkmanshipItem {
  id: string;
  documentId?: string;
  documentNumber?: string;
  documentDateJalali?: string;
  workmanshipName: string;
  goldenPercentage: string;
  purity: string;
  wage: string;
  wageMode: WageMode;
  rawWeight: string;
  quantity: string;
  metalType: MetalType;
  description?: string;
}

export interface WorkmanshipTabProps {
  nature?: 'paid' | 'received' | 'pay' | 'receive';
  draftLine?: DocumentLine;
  setDraftLine?: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCurrency?: string;
  currencyLabel?: string;
  activeCurrencies?: { code: string; name: string; symbol?: string; id?: string }[];
  selectedCustomer?: Customer | null;
  onAddLine?: (line: DocumentLine) => void;
}

// Quick suggestions for manufactured jewelry names
const COMMON_WORKMANSHIP_PRESETS = [
  'النگو',
  'انگشتر',
  'دستبند',
  'زنجیر',
  'گردنبند',
  'گوشواره',
  'سرویس طلا',
  'نیم‌ست',
  'مدال / پلاک',
  'تک‌پوش',
  'پابند',
  'ساعت طلا',
];

export default function WorkmanshipTab({
  nature = 'paid',
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = true,
  baseCurrency = 'IRR',
  selectedCurrency,
  currencyLabel,
  activeCurrencies,
  selectedCustomer,
  onAddLine,
}: WorkmanshipTabProps) {
  const isNaturePaid = nature === 'paid' || nature === 'pay';
  const { settings } = useAppSettings();
  const effectiveCurrency = baseCurrency || (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;

  // Available currencies for wage dropdown
  const availableWageCurrencies = useMemo(() => {
    const list: { code: string; name: string; symbol?: string }[] = [];

    // Domestic currencies based on baseCurrency
    if (effectiveCurrency === 'IRT') {
      list.push({ code: 'IRT', name: 'تومان', symbol: 'تومان' });
      list.push({ code: 'IRR', name: 'ریال ایران', symbol: 'ریال' });
    } else {
      list.push({ code: 'IRR', name: 'ریال ایران', symbol: 'ریال' });
      list.push({ code: 'IRT', name: 'تومان', symbol: 'تومان' });
    }

    // Active / Standard foreign currencies
    const foreignPool = activeCurrencies && activeCurrencies.length > 0
      ? activeCurrencies
      : DEFAULT_STANDARD_CURRENCIES;

    foreignPool.forEach((c) => {
      const code = c.code.trim().toUpperCase();
      if (code !== 'IRR' && code !== 'IRT' && !list.some((existing) => existing.code === code)) {
        list.push({
          code,
          name: c.name || code,
          symbol: c.symbol || code,
        });
      }
    });

    return list;
  }, [effectiveCurrency, activeCurrencies]);

  // Current wage currency resolution (strictly synchronized with selectedCurrency from top document header)
  const currentWageCurrencyCode = useMemo(() => {
    if (editingLineId) {
      const lineCurr = (draftLine?.details?.wageCurrency || draftLine?.details?.currencyUnit || '').trim().toUpperCase();
      if (lineCurr && availableWageCurrencies.some((c) => c.code === lineCurr)) {
        return lineCurr;
      }
    }
    const normSelected = (selectedCurrency || '').trim().toUpperCase();
    if (normSelected && availableWageCurrencies.some((c) => c.code === normSelected)) {
      return normSelected;
    }
    const draftWageCurrency = (draftLine?.details?.wageCurrency || draftLine?.details?.currencyUnit || '').trim().toUpperCase();
    if (draftWageCurrency && availableWageCurrencies.some((c) => c.code === draftWageCurrency)) {
      return draftWageCurrency;
    }
    return effectiveCurrency;
  }, [editingLineId, selectedCurrency, draftLine?.details?.wageCurrency, draftLine?.details?.currencyUnit, effectiveCurrency, availableWageCurrencies]);

  // Synchronize wageCurrency in draftLine details whenever currentWageCurrencyCode changes
  useEffect(() => {
    if (draftLine?.details?.wageCurrency !== currentWageCurrencyCode) {
      updateDraftDetail?.('wageCurrency', currentWageCurrencyCode);
      updateDraftDetail?.('wageCurrencyUnit', currentWageCurrencyCode);
    }
  }, [currentWageCurrencyCode, draftLine?.details?.wageCurrency, updateDraftDetail]);

  const currentWageCurrencyItem = useMemo(() => {
    return (
      availableWageCurrencies.find((c) => c.code === currentWageCurrencyCode) || {
        code: currentWageCurrencyCode,
        name: currentWageCurrencyCode === 'IRT' ? 'تومان' : currentWageCurrencyCode === 'IRR' ? 'ریال' : currentWageCurrencyCode,
        symbol: currentWageCurrencyCode === 'IRT' ? 'تومان' : currentWageCurrencyCode === 'IRR' ? 'ریال' : currentWageCurrencyCode,
      }
    );
  }, [availableWageCurrencies, currentWageCurrencyCode]);

  const isForeignWage = currentWageCurrencyCode !== 'IRR' && currentWageCurrencyCode !== 'IRT';
  const wageCurrencySuffix = currentWageCurrencyItem.name || currentWageCurrencyItem.symbol || currentWageCurrencyCode;

  // Selected Metal - Read directly from top document header (draftLine.details.metalType)
  const currentMetalType: MetalType = (draftLine?.details?.metalType as MetalType) || 'gold';

  // Base Karat based on selected metal from top section
  const basePurity = useMemo(() => {
    if (currentMetalType === 'silver') return Number(settings.silverBaseKarat) || 925;
    if (currentMetalType === 'platinum') return Number(settings.platinumBaseKarat) || 800;
    return Number(settings.goldBaseKarat) || 750;
  }, [currentMetalType, settings.goldBaseKarat, settings.silverBaseKarat, settings.platinumBaseKarat]);

  // Metal Persian Name
  const metalName = useMemo(() => {
    if (currentMetalType === 'silver') return 'نقره';
    if (currentMetalType === 'platinum') return 'پلاتین';
    return 'طلا';
  }, [currentMetalType]);

  const percentageFieldLabel = useMemo(() => {
    return getWorkmanshipPercentageLabel(currentMetalType);
  }, [currentMetalType]);

  // Operation Options according to document nature
  const operationOptions = useMemo(() => {
    if (isNaturePaid) {
      return [
        {
          id: 1,
          key: 'exit_manufactured' as WorkmanshipOperationType,
          label: 'خروج کار ساخته',
          description: 'خروج فیزیکی مصنوعات طلا و جواهر بدون فروش قطعی',
          icon: TrendingDown,
          hasFullPricing: false,
        },
        {
          id: 2,
          key: 'sale_manufactured' as WorkmanshipOperationType,
          label: 'فروش کارساخته',
          description: 'فروش قطعی مصنوعات با محاسبه قیمت فلز، اجرت و سود',
          icon: ShoppingBag,
          hasFullPricing: true,
        },
        {
          id: 3,
          key: 'return_exit' as WorkmanshipOperationType,
          label: 'خروج مرجوعی',
          description: 'خروج و مرجوع کردن کالای ساخته شده به همکار/مشتری',
          icon: RotateCcw,
          hasFullPricing: false,
        },
        {
          id: 4,
          key: 'return_sale' as WorkmanshipOperationType,
          label: 'فروش مرجوعی',
          description: 'ثبت فروش فاکتور مرجوعی با ارزش‌گذاری و محاسبه سود',
          icon: Sparkles,
          hasFullPricing: true,
        },
      ];
    } else {
      return [
        {
          id: 1,
          key: 'entry_manufactured' as WorkmanshipOperationType,
          label: 'ورود کار ساخته',
          description: 'ورود فیزیکی مصنوعات طلا و جواهر به موجودی یا کارگاه',
          icon: TrendingUp,
          hasFullPricing: false,
        },
        {
          id: 2,
          key: 'buy_manufactured' as WorkmanshipOperationType,
          label: 'خرید کارساخته',
          description: 'خرید قطعی مصنوعات ساخته با محاسبه قیمت فلز و اجرت',
          icon: ShoppingBag,
          hasFullPricing: true,
        },
        {
          id: 3,
          key: 'return_entry' as WorkmanshipOperationType,
          label: 'ورود مرجوعی',
          description: 'دریافت و ثبت مرجوعی مصنوعات از مشتری/همکار',
          icon: RotateCcw,
          hasFullPricing: false,
        },
        {
          id: 4,
          key: 'return_buy' as WorkmanshipOperationType,
          label: 'خرید مرجوعی',
          description: 'ثبت خرید مرجوعی مصنوعات با تسویه مالی و محاسبه ارزش',
          icon: Sparkles,
          hasFullPricing: true,
        },
      ];
    }
  }, [isNaturePaid]);

  // Current values read directly from draftLine details (Single source of truth)
  const selectedOptionId = draftLine?.details?.workmanshipOptionId || 1;
  const currentOption = useMemo(() => {
    return operationOptions.find((opt) => opt.id === selectedOptionId) ?? operationOptions[0];
  }, [operationOptions, selectedOptionId]);

  const isReturnEntry = !isNaturePaid && (selectedOptionId === 3 || currentOption.key === 'return_entry');
  const isReturnExit = isNaturePaid && (selectedOptionId === 3 || currentOption.key === 'return_exit');
  const isReturnOperation = isReturnEntry || isReturnExit;

  // Customer previous workmanship items (exits for ورود مرجوعی, entries for خروج مرجوعی)
  const [customerWorkmanshipItems, setCustomerWorkmanshipItems] = useState<ReturnedWorkmanshipItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isManualReturn, setIsManualReturn] = useState(false);

  useEffect(() => {
    setIsManualReturn(false);
  }, [selectedCustomer?.id, selectedOptionId]);

  useEffect(() => {
    if (!selectedCustomer?.id || !isReturnOperation) {
      setCustomerWorkmanshipItems([]);
      setLoadingItems(false);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);

    const targetNature = isReturnExit ? 'received' : 'paid';

    fetch(`/api/documents?workmanshipReturns=1&nature=${targetNature}&customerId=${encodeURIComponent(selectedCustomer.id)}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          setCustomerWorkmanshipItems(data.items);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerWorkmanshipItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCustomer?.id, isReturnOperation, isReturnExit]);

  const availableReturnItems = useMemo(() => {
    const list: ReturnedWorkmanshipItem[] = [...customerWorkmanshipItems];
    if (Array.isArray(committedLines)) {
      committedLines.forEach((line) => {
        const isWorkmanship = line.documentTab === 'workmanship' || line.sourceTab === 'workmanship';
        const matchesTargetNature = isReturnExit
          ? (line.documentNature === 'received' || (line.documentNature as string) === 'receive')
          : (line.documentNature === 'paid' || (line.documentNature as string) === 'pay');
        const name = line.details?.workmanshipName?.trim();
        if (isWorkmanship && matchesTargetNature && name) {
          if (!list.some((item) => item.id === line.id)) {
            list.unshift({
              id: line.id,
              documentId: 'current',
              documentNumber: 'سند جاری',
              documentDateJalali: 'امروز',
              workmanshipName: name,
              goldenPercentage: line.details?.goldenPercentage || '',
              purity: line.details?.purity || '750',
              wage: line.details?.wage || '',
              wageMode: (line.details?.wageMode as WageMode) || 'per_gram',
              rawWeight: line.details?.rawWeight || '',
              quantity: line.details?.quantity || '1',
              metalType: (line.details?.metalType as MetalType) || 'gold',
              description: line.description || '',
            });
          }
        }
      });
    }
    return list;
  }, [customerWorkmanshipItems, committedLines, isReturnExit]);

  const selectedReturnSourceId = draftLine?.details?.workmanshipReturnSourceId || '';
  const selectedReturnItem = useMemo(() => {
    return availableReturnItems.find((item) => item.id === selectedReturnSourceId) || null;
  }, [availableReturnItems, selectedReturnSourceId]);

  const handleSelectReturnItem = (selectedId: string) => {
    if (!selectedId) {
      updateDraftDetail?.('workmanshipReturnSourceId', '');
      return;
    }
    const found = availableReturnItems.find((item) => item.id === selectedId);
    if (!found) return;

    if (setDraftLine) {
      setDraftLine((prev) => ({
        ...prev,
        details: {
          ...prev.details,
          workmanshipReturnSourceId: found.id,
          workmanshipName: found.workmanshipName,
          goldenPercentage: found.goldenPercentage,
          purity: found.purity || prev.details.purity || '750',
          wage: found.wage || prev.details.wage || '',
          wageMode: (found.wageMode as WageMode) || prev.details.wageMode || 'per_gram',
          rawWeight: found.rawWeight || prev.details.rawWeight || '',
          quantity: found.quantity || prev.details.quantity || '1',
          metalType: (found.metalType as MetalType) || prev.details.metalType || 'gold',
        },
      }));
    }
  };

  const rawWeightStr = draftLine?.details?.rawWeight || '';
  const quantityStr = draftLine?.details?.quantity !== undefined ? draftLine.details.quantity : '1';
  const workmanshipName = draftLine?.details?.workmanshipName || '';
  const wageStr = draftLine?.details?.wage || '';
  const wageMode: WageMode = (draftLine?.details?.wageMode as WageMode) || 'per_gram';
  const purityStr = draftLine?.details?.purity !== undefined ? draftLine.details.purity : String(basePurity);
  const goldenPercentageStr = draftLine?.details?.goldenPercentage || '';
  const profitPercentageStr = draftLine?.details?.profitPercentage || '';
  const metalPriceStr = draftLine?.details?.metalPrice || '';
  const totalAmountStr = draftLine?.details?.totalAmount || '';
  const description = draftLine?.description || '';

  // Parsed numeric helpers
  const numWeight = useMemo(() => {
    const raw = normalizeDigits(rawWeightStr).replace(/,/g, '');
    const val = parseFloat(raw);
    return isNaN(val) ? 0 : val;
  }, [rawWeightStr]);

  const numQuantity = useMemo(() => {
    const raw = normalizeDigits(quantityStr).replace(/,/g, '');
    const val = parseInt(raw, 10);
    return isNaN(val) || val <= 0 ? 1 : val;
  }, [quantityStr]);

  const numWage = useMemo(() => {
    if (isForeignWage) {
      const raw = normalizeDigits(wageStr).replace(/,/g, '');
      const val = parseFloat(raw);
      return isNaN(val) || val < 0 ? 0 : val;
    }
    return parseLocalizedAmount(wageStr);
  }, [wageStr, isForeignWage]);

  const numPurity = useMemo(() => {
    const raw = normalizeDigits(purityStr).replace(/,/g, '');
    const val = parseFloat(raw);
    return isNaN(val) ? basePurity : val;
  }, [purityStr, basePurity]);

  const numGoldenPercentage = useMemo(() => {
    const raw = normalizeDigits(goldenPercentageStr).replace(/,/g, '');
    const val = parseFloat(raw);
    return isNaN(val) ? 0 : val;
  }, [goldenPercentageStr]);

  const numProfitPercentage = useMemo(() => {
    const raw = normalizeDigits(profitPercentageStr).replace(/,/g, '');
    const val = parseFloat(raw);
    return isNaN(val) ? 0 : val;
  }, [profitPercentageStr]);

  const numMetalPrice = useMemo(() => {
    return parseLocalizedAmount(metalPriceStr);
  }, [metalPriceStr]);

  // Derived calculations
  const calculatedTotalWage = useMemo(() => {
    const raw = wageMode === 'per_gram' ? numWeight * numWage : numQuantity * numWage;
    if (isForeignWage) {
      return Math.round(raw * 100) / 100;
    }
    return Math.round(raw);
  }, [wageMode, numWeight, numQuantity, numWage, isForeignWage]);

  const calculatedGoldenAddition = useMemo(() => {
    if (numWeight <= 0 || numGoldenPercentage <= 0) return 0;
    return numWeight * (numGoldenPercentage / 100);
  }, [numWeight, numGoldenPercentage]);

  const calculatedConvertedWeight = useMemo(() => {
    if (basePurity <= 0 || numWeight <= 0) return 0;
    const baseConverted = (numWeight * numPurity) / basePurity;
    if (selectedOptionId === 1 || selectedOptionId === 3) {
      return baseConverted + calculatedGoldenAddition;
    }
    return baseConverted;
  }, [basePurity, numWeight, numPurity, selectedOptionId, calculatedGoldenAddition]);

  const calculatedMetalTotalPrice = useMemo(() => {
    if (numWeight <= 0 || numMetalPrice <= 0) return 0;
    const stdWeight = basePurity > 0 ? (numWeight * numPurity) / basePurity : numWeight;
    return Math.round(stdWeight * numMetalPrice);
  }, [numWeight, numMetalPrice, basePurity, numPurity]);

  const calculatedProfitAmount = useMemo(() => {
    if (numProfitPercentage <= 0) return 0;
    const baseCost = calculatedMetalTotalPrice + calculatedTotalWage;
    return Math.round(baseCost * (numProfitPercentage / 100));
  }, [calculatedMetalTotalPrice, calculatedTotalWage, numProfitPercentage]);

  const calculatedFormulaTotalAmount = useMemo(() => {
    if (selectedOptionId === 1 || selectedOptionId === 3) {
      return calculatedTotalWage;
    } else {
      const gross = calculatedMetalTotalPrice + calculatedTotalWage + calculatedProfitAmount;
      const res = Math.max(0, gross);
      return isForeignWage ? Math.round(res * 100) / 100 : Math.round(res);
    }
  }, [selectedOptionId, calculatedTotalWage, calculatedMetalTotalPrice, calculatedProfitAmount, isForeignWage]);

  // Handle direct field mutation safely without useEffect loops
  const updateField = useCallback(
    <K extends keyof DetailState>(field: K, value: DetailState[K], autoCalcTotal = true) => {
      if (!setDraftLine && !updateDraftDetail) return;

      if (setDraftLine) {
        setDraftLine((prev) => {
          const updatedDetails = {
            ...prev.details,
            metalType: currentMetalType,
            [field]: value,
          };

          // Wage Currency
          const nextWageCurrency = (field === 'wageCurrency' ? String(value) : updatedDetails.wageCurrency || currentWageCurrencyCode).trim().toUpperCase();
          const nextIsForeignWage = nextWageCurrency !== 'IRR' && nextWageCurrency !== 'IRT';

          // Recompute dependent figures
          const nextWeight = field === 'rawWeight' ? (parseFloat(normalizeDigits(String(value)).replace(/,/g, '')) || 0) : (parseFloat(normalizeDigits(updatedDetails.rawWeight || '').replace(/,/g, '')) || 0);
          const nextQty = field === 'quantity' ? (parseInt(normalizeDigits(String(value)), 10) || 1) : (parseInt(normalizeDigits(updatedDetails.quantity || '1'), 10) || 1);
          const nextWage = field === 'wage'
            ? (nextIsForeignWage ? (parseFloat(normalizeDigits(String(value)).replace(/,/g, '')) || 0) : parseLocalizedAmount(String(value)))
            : (nextIsForeignWage ? (parseFloat(normalizeDigits(updatedDetails.wage || '').replace(/,/g, '')) || 0) : parseLocalizedAmount(updatedDetails.wage || ''));
          const nextWageMode = (field === 'wageMode' ? value : updatedDetails.wageMode || 'per_gram') as WageMode;
          const nextPurity = field === 'purity' ? (parseFloat(normalizeDigits(String(value))) || basePurity) : (parseFloat(normalizeDigits(updatedDetails.purity || '')) || basePurity);
          const nextGoldenPct = field === 'goldenPercentage' ? (parseFloat(normalizeDigits(String(value))) || 0) : (parseFloat(normalizeDigits(updatedDetails.goldenPercentage || '')) || 0);
          const nextMetalPrice = field === 'metalPrice' ? parseLocalizedAmount(String(value)) : parseLocalizedAmount(updatedDetails.metalPrice || '');
          const nextProfitPct = field === 'profitPercentage' ? (parseFloat(normalizeDigits(String(value))) || 0) : (parseFloat(normalizeDigits(updatedDetails.profitPercentage || '')) || 0);
          const optId = (field === 'workmanshipOptionId' ? Number(value) : updatedDetails.workmanshipOptionId) || 1;

          const rawTWage = nextWageMode === 'per_gram' ? nextWeight * nextWage : nextQty * nextWage;
          const tWage = nextIsForeignWage ? Math.round(rawTWage * 100) / 100 : Math.round(rawTWage);
          const stdW = basePurity > 0 ? (nextWeight * nextPurity) / basePurity : nextWeight;
          const convW = (optId === 1 || optId === 3) ? stdW + (nextWeight * (nextGoldenPct / 100)) : stdW;
          const mTotalPrice = Math.round(stdW * nextMetalPrice);
          const pAmount = Math.round((mTotalPrice + tWage) * (nextProfitPct / 100));

          updatedDetails.wageCurrency = nextWageCurrency;
          updatedDetails.currencyUnit = nextWageCurrency;
          updatedDetails.metalTotalPrice = String(mTotalPrice);
          updatedDetails.profitAmount = String(pAmount);
          updatedDetails.convertedWeight = convW.toFixed(weightPrecision);

          if (autoCalcTotal && field !== 'totalAmount') {
            let nextTotal = 0;
            if (optId === 1 || optId === 3) {
              nextTotal = tWage;
            } else {
              const gross = mTotalPrice + tWage + pAmount;
              nextTotal = Math.max(0, nextIsForeignWage ? Math.round(gross * 100) / 100 : Math.round(gross));
            }
            updatedDetails.totalAmount = nextTotal > 0 ? String(nextTotal) : '';
            if (nextIsForeignWage) {
              updatedDetails.currencyTotalAmount = updatedDetails.totalAmount;
              updatedDetails.currencyUnitPrice = String(nextWage);
            }
          }

          const opt = operationOptions.find((o) => o.id === optId) ?? operationOptions[0];

          return {
            ...prev,
            documentNature: isNaturePaid ? 'paid' : 'received',
            documentTab: 'workmanship',
            sourceTab: 'workmanship',
            documentSubType: opt.key,
            documentTypeLabel: opt.label,
            converted750: convW,
            details: updatedDetails,
          };
        });
      }
    },
    [setDraftLine, updateDraftDetail, currentMetalType, basePurity, weightPrecision, operationOptions, nature, currentWageCurrencyCode]
  );

  const handleOptionChange = (newOptId: number) => {
    updateField('workmanshipOptionId', newOptId, true);
  };

  const handlePresetSelect = (presetName: string) => {
    updateField('workmanshipName', presetName, false);
  };

  const handleResetToAutoTotal = () => {
    updateField('totalAmount', calculatedFormulaTotalAmount > 0 ? String(calculatedFormulaTotalAmount) : '', false);
  };

  // Handle Commit / Add Line
  const handleCommit = () => {
    if (commitDraftLine) {
      commitDraftLine();
      return;
    }

    if (onAddLine) {
      const isPhysicalOp = selectedOptionId === 1 || selectedOptionId === 3;
      const baseStdWeight = basePurity > 0 ? (numWeight * numPurity) / basePurity : numWeight;
      const hasGolden = isPhysicalOp && numGoldenPercentage > 0 && numWeight > 0;
      const hasWage = isPhysicalOp && (calculatedTotalWage > 0 || numWage > 0);
      const hasSubRows = isPhysicalOp && (hasGolden || hasWage);

      const mainLineId = generateUUID();
      const newLine: DocumentLine = {
        id: mainLineId,
        documentNature: isNaturePaid ? 'paid' : 'received',
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: currentOption.key,
        documentTypeLabel: currentOption.label,
        converted750: hasSubRows ? baseStdWeight : calculatedConvertedWeight,
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: description,
        details: {
          metalType: currentMetalType,
          rawKind: 'molten',
          rawWeight: rawWeightStr,
          purity: purityStr || String(basePurity),
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: metalPriceStr,
          totalAmount: hasWage ? '' : totalAmountStr,
          wageTotalAmount: String(calculatedTotalWage),
          labName: '',
          stampNumber: '',
          currencyUnit: currentWageCurrencyCode,
          currencyQuantity: hasWage ? '' : (isForeignWage ? (totalAmountStr || String(calculatedFormulaTotalAmount)) : ''),
          currencyUnitPrice: isForeignWage ? wageStr : '',
          currencyTotalAmount: hasWage ? '' : (isForeignWage ? (totalAmountStr || String(calculatedFormulaTotalAmount)) : ''),
          wageCurrency: currentWageCurrencyCode,
          wageCurrencyUnit: currentWageCurrencyCode,
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          workmanshipName: workmanshipName,
          quantity: quantityStr || '1',
          wage: wageStr,
          wageMode: wageMode,
          goldenPercentage: goldenPercentageStr,
          profitPercentage: profitPercentageStr,
          metalTotalPrice: String(calculatedMetalTotalPrice),
          profitAmount: String(calculatedProfitAmount),
          discountAmount: '',
          convertedWeight: (hasSubRows ? baseStdWeight : calculatedConvertedWeight).toFixed(weightPrecision),
          workmanshipOptionId: selectedOptionId,
          workmanshipOptionLabel: currentOption.label,
          workmanshipReturnSourceId: selectedReturnSourceId,
          hasChildLines: hasSubRows,
        },
      };
      onAddLine(newLine);

      if (hasGolden) {
        const goldenWeightStr = calculatedGoldenAddition.toFixed(weightPrecision);
        const goldenLine: DocumentLine = {
          id: generateUUID(),
          documentNature: isNaturePaid ? 'paid' : 'received',
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'workmanship-golden-percentage',
          documentTypeLabel: `${percentageFieldLabel} کارساخته (${toPersianDigits(goldenPercentageStr)}٪)`,
          converted750: calculatedGoldenAddition,
          settlementMethod: 'weight',
          balanceSource: 'current',
          description: workmanshipName
            ? `بابت ${percentageFieldLabel} کارساخته (${toPersianDigits(goldenPercentageStr)}٪) - ${workmanshipName.trim()}`
            : `بابت ${percentageFieldLabel} کارساخته (${toPersianDigits(goldenPercentageStr)}٪)`,
          details: {
            metalType: currentMetalType,
            rawKind: 'molten',
            rawWeight: goldenWeightStr,
            purity: String(basePurity),
            calculationMethod: 'weight',
            metalPriceType: 'gram18',
            metalPrice: '',
            totalAmount: '',
            labName: '',
            stampNumber: '',
            currencyUnit: currentWageCurrencyCode,
            currencyQuantity: '',
            currencyUnitPrice: '',
            currencyTotalAmount: '',
            unsettledTrade: false,
            currencyTradeId: '',
            settlementCurrencyUnit: '',
            settlementQuantity: '',
            settlesTradeId: '',
            inventorySourceId: '',
            workmanshipName: workmanshipName,
            quantity: quantityStr || '1',
            wage: '',
            wageMode: wageMode,
            goldenPercentage: goldenPercentageStr,
            profitPercentage: '',
            metalTotalPrice: '',
            profitAmount: '',
            discountAmount: '',
            convertedWeight: goldenWeightStr,
            workmanshipOptionId: selectedOptionId,
            workmanshipOptionLabel: `${percentageFieldLabel} (${toPersianDigits(goldenPercentageStr)}٪)`,
            linkedLineId: mainLineId,
            isChildLine: true,
          },
        };
        onAddLine(goldenLine);
      }

      if (hasWage) {
        const wageSuffix = currentWageCurrencyCode === 'IRT' ? 'تومان' : currentWageCurrencyCode === 'IRR' ? 'ریال' : currentWageCurrencyCode;
        const wageRateDesc = numWage > 0 ? ` (${toPersianDigits(wageStr)} ${wageSuffix} ${wageMode === 'per_gram' ? 'فی گرم' : 'عددی'})` : '';
        const wageLine: DocumentLine = {
          id: generateUUID(),
          documentNature: isNaturePaid ? 'paid' : 'received',
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'workmanship-wage',
          documentTypeLabel: 'اجرت کارساخته',
          converted750: 0,
          settlementMethod: 'cash',
          balanceSource: 'current',
          description: workmanshipName
            ? `بابت اجرت کارساخته - ${workmanshipName.trim()}${wageRateDesc}`
            : `بابت اجرت کارساخته${wageRateDesc}`,
          details: {
            metalType: currentMetalType,
            rawKind: 'molten',
            rawWeight: '',
            purity: '',
            calculationMethod: 'weight',
            metalPriceType: 'gram18',
            metalPrice: '',
            totalAmount: String(calculatedTotalWage),
            labName: '',
            stampNumber: '',
            currencyUnit: currentWageCurrencyCode,
            currencyQuantity: isForeignWage ? String(calculatedTotalWage) : '',
            currencyUnitPrice: isForeignWage ? wageStr : '',
            currencyTotalAmount: isForeignWage ? String(calculatedTotalWage) : '',
            wageCurrency: currentWageCurrencyCode,
            wageCurrencyUnit: currentWageCurrencyCode,
            unsettledTrade: false,
            currencyTradeId: '',
            settlementCurrencyUnit: '',
            settlementQuantity: '',
            settlesTradeId: '',
            inventorySourceId: '',
            workmanshipName: workmanshipName,
            quantity: quantityStr || '1',
            wage: wageStr,
            wageMode: wageMode,
            goldenPercentage: '',
            profitPercentage: '',
            metalTotalPrice: '',
            profitAmount: '',
            discountAmount: '',
            convertedWeight: '0',
            workmanshipOptionId: selectedOptionId,
            workmanshipOptionLabel: 'اجرت کارساخته',
            linkedLineId: mainLineId,
            isChildLine: true,
          },
        };
        onAddLine(wageLine);
      }
    }
  };

  const isFormValid = useMemo(() => {
    return numWeight > 0 && workmanshipName.trim().length > 0;
  }, [numWeight, workmanshipName]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header & Nature Badge (Without duplicate metal selector) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              isNaturePaid
                ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
            }`}
          >
            <Wrench size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              ثبت عملیات کار ساخته و جواهرات
            </h2>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              ورود، خروج، خرید و فروش انواع النگو، دستبند، سرویس و مصنوعات
            </p>
          </div>
        </div>

        {/* Nature Badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black shadow-sm ${
            isNaturePaid
              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isNaturePaid ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          {isNaturePaid ? 'سند پرداختی (خروج/فروش)' : 'سند دریافتی (ورود/خرید)'}
        </span>
      </div>

      {/* 2. Operation Type Selector (4 Options dynamically rendered) */}
      <div>
        <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
          نوع عملیات کار ساخته:
        </label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {operationOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedOptionId === opt.id;
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => handleOptionChange(opt.id)}
                className={`relative flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-right transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? isNaturePaid
                      ? 'border-rose-500 bg-rose-50/70 text-rose-950 shadow-md ring-2 ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-100'
                      : 'border-emerald-500 bg-emerald-50/70 text-emerald-950 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isSelected
                        ? isNaturePaid
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-400">
                    گزینه {toPersianDigits(String(opt.id))}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-xs font-black">{opt.label}</div>
                  <div className="line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Quick Artifact Name Presets */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Tag size={13} className="text-amber-500" />
            انتخاب سریع نام کار ساخته:
          </span>
          {workmanshipName ? (
            <button
              type="button"
              onClick={() => updateField('workmanshipName', '', false)}
              className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
            >
              پاک کردن
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_WORKMANSHIP_PRESETS.map((presetName) => {
            const isActive = workmanshipName === presetName;
            return (
              <button
                type="button"
                key={presetName}
                onClick={() => handlePresetSelect(presetName)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-sm scale-105'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750'
                }`}
              >
                {presetName}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Form Fields */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-5 space-y-4">
        {/* Return Item Link Banner */}
        {isReturnOperation && selectedReturnItem && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-100/90 p-3 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                <RotateCcw size={13} />
              </span>
              <span>
                {isReturnExit ? 'مرجوعی از کار ساخته دریافتی (برگشت از خرید): ' : 'مرجوعی از کار ساخته خروجی (برگشت از فروش): '}
                <strong className="font-black text-slate-900 dark:text-white">«{selectedReturnItem.workmanshipName}»</strong> (سند شماره {toPersianDigits(selectedReturnItem.documentNumber || '-')} - وزن مبنا: {toPersianDigits(selectedReturnItem.rawWeight)} گرم)
              </span>
            </div>
            <span className="rounded-xl border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
              {percentageFieldLabel} فراخوانی‌شده: {toPersianDigits(selectedReturnItem.goldenPercentage)}٪
            </span>
          </div>
        )}

        {/* Row 1: وزن + عیار + نام کار ساخته + تعداد */}
        <div className="flex flex-wrap items-start gap-3">
          {/* Field: وزن (Weight in grams) */}
          <div className="w-[130px] shrink-0">
            <Field label={`وزن ${metalName} (گرم)`} required>
              <input
                type="text"
                inputMode="decimal"
                maxLength={9}
                value={rawWeightStr ? toPersianDigits(rawWeightStr) : ''}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const cleaned = normalizeDigits(e.target.value).replace(/[^\d.]/g, '').slice(0, 9);
                  updateField('rawWeight', cleaned, true);
                }}
                onKeyDown={handleKeyDownEnter}
                placeholder="۰.۰۰۰"
                className="h-10 w-full text-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
              />
            </Field>
          </div>

          {/* Field: عیار (Purity) */}
          <div className="w-[88px] shrink-0">
            <Field label={`عیار ${metalName}`}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={purityStr ? toPersianDigits(purityStr) : ''}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const cleaned = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
                  updateField('purity', cleaned, true);
                }}
                onKeyDown={handleKeyDownEnter}
                placeholder={toPersianDigits(String(basePurity))}
                className="h-10 w-full text-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
              />
            </Field>
          </div>

          {/* Field: نام کار ساخته (Artifact Name) */}
          <div className="flex-1 min-w-[200px]">
            {isReturnOperation ? (
              <Field
                label={
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    <RotateCcw size={13} className="text-amber-500 shrink-0" />
                    <span>نام کار ساخته مرجوعی</span>
                  </span>
                }
                action={
                  selectedReturnSourceId ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectReturnItem('');
                        setIsManualReturn(false);
                      }}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      تغییر یا حذف انتخاب
                    </button>
                  ) : availableReturnItems.length > 0 ? (
                    isManualReturn ? (
                      <button
                        type="button"
                        onClick={() => setIsManualReturn(false)}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        انتخاب از لیست ({toPersianDigits(String(availableReturnItems.length))} مورد)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsManualReturn(true)}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        ورود دستی
                      </button>
                    )
                  ) : !selectedCustomer ? (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      طرف‌حساب را انتخاب فرمایید
                    </span>
                  ) : (
                    <div className="relative group/no-items inline-flex items-center gap-1">
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        ورود دستی (سابقه‌ای یافت نشد)
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 p-0.5 rounded-full transition-colors cursor-help"
                        aria-label="راهنما"
                      >
                        <Info size={12} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full mb-2 left-0 z-50 hidden group-hover/no-items:block w-64 rounded-xl bg-slate-900 px-2.5 py-1.5 text-right text-[10px] font-medium leading-relaxed text-white shadow-xl dark:bg-slate-800 dark:text-slate-100 border border-slate-700/80">
                        {isReturnExit
                          ? 'هیچ کار ساخته دریافتی قبلی از این طرف‌حساب یافت نشد (می‌توانید اطلاعات را دستی وارد فرمایید).'
                          : 'هیچ کار ساخته خروجی قبلی برای این طرف‌حساب یافت نشد (می‌توانید اطلاعات را دستی وارد فرمایید).'}
                        <div className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 bg-slate-900 dark:bg-slate-800 border-r border-b border-slate-700/80" />
                      </div>
                    </div>
                  )
                }
                required
              >
                {selectedReturnSourceId ? (
                  <input
                    type="text"
                    value={workmanshipName}
                    onChange={(e) => updateField('workmanshipName', e.target.value, false)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="عنوان کار ساخته مرجوعی..."
                    className="h-10 w-full rounded-xl border border-emerald-400 bg-emerald-50/20 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-emerald-600 dark:bg-emerald-950/20 dark:text-slate-100 dark:focus:border-emerald-500 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                ) : loadingItems ? (
                  <div className="h-10 flex items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    {isReturnExit
                      ? 'در حال دریافت اقلام دریافتی از این طرف‌حساب...'
                      : 'در حال دریافت اقلام خروجی به این طرف‌حساب...'}
                  </div>
                ) : availableReturnItems.length > 0 && !isManualReturn ? (
                  <select
                    value={selectedReturnSourceId}
                    onChange={(e) => {
                      if (e.target.value === '__manual__') {
                        setIsManualReturn(true);
                      } else {
                        handleSelectReturnItem(e.target.value);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                  >
                    <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                      {isReturnExit
                        ? `-- انتخاب از کارساخته‌های دریافتی (${toPersianDigits(String(availableReturnItems.length))} مورد) --`
                        : `-- انتخاب از کارساخته‌های خروجی (${toPersianDigits(String(availableReturnItems.length))} مورد) --`}
                    </option>
                    {availableReturnItems.map((item) => (
                      <option key={item.id} value={item.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                        {item.workmanshipName} | وزن: {toPersianDigits(item.rawWeight)} گرم | عیار: {toPersianDigits(item.purity)} | درصد: {toPersianDigits(item.goldenPercentage)}٪ (سند {toPersianDigits(item.documentNumber || '-')})
                      </option>
                    ))}
                    <option value="__manual__" className="bg-white text-amber-600 font-bold dark:bg-slate-900 dark:text-amber-400">
                      ✏️ ورود دستی عنوان (بدون انتخاب از لیست)...
                    </option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={workmanshipName}
                    onChange={(e) => updateField('workmanshipName', e.target.value, false)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder={
                      !selectedCustomer
                        ? 'نام کار ساخته مرجوعی (ورود دستی یا انتخاب طرف‌حساب)...'
                        : 'نام کار ساخته مرجوعی (ورود دستی)...'
                    }
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                )}
              </Field>
            ) : (
              <Field label="نام کار ساخته" required>
                <input
                  type="text"
                  value={workmanshipName}
                  onChange={(e) => updateField('workmanshipName', e.target.value, false)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="مثلاً: النگو ریخته، انگشتر زنانه..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </Field>
            )}
          </div>

          {/* Field: تعداد (Quantity/Count) */}
          <div className="w-[88px] shrink-0">
            <Field label="تعداد (عدد)">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={quantityStr ? toPersianDigits(quantityStr) : ''}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const cleaned = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
                  updateField('quantity', cleaned, true);
                }}
                onKeyDown={handleKeyDownEnter}
                placeholder="۱"
                className="h-10 w-full text-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
              />
            </Field>
          </div>
        </div>

        {/* Dynamic Option Fields: Option 1 & 3 vs Option 2 & 4 */}
        {selectedOptionId === 1 || selectedOptionId === 3 ? (
          /* Option 1 & 3: خروج کار ساخته / خروج مرجوعی */
          <div className="flex flex-wrap items-start gap-3">
            {/* Field: اجرت کار (Wage) with Mode Toggle (Currency synchronized with document top bar) */}
            <div className="w-[180px] shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1 min-h-5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Coins size={14} className="text-amber-500" />
                    <span>اجرت کار</span>
                    <div className="relative group/wage-info inline-flex items-center">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 p-0.5 rounded-full transition-colors cursor-help"
                        title="جهت محاسبه ارزی اجرت، می‌توانید نوع ارز را از منوی بالای سند انتخاب فرمایید."
                        aria-label="راهنمای ارز اجرت"
                      >
                        <Info size={13} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full mb-2 right-1/2 translate-x-1/2 z-50 hidden group-hover/wage-info:block w-52 rounded-xl bg-slate-900 px-2.5 py-1.5 text-center text-[10px] font-medium leading-relaxed text-white shadow-xl dark:bg-slate-800 dark:text-slate-100 border border-slate-700/80">
                        جهت محاسبه ارزی اجرت، می‌توانید نوع ارز را از منوی بالای سند انتخاب فرمایید.
                        <div className="absolute -bottom-1 right-1/2 translate-x-1/2 h-2 w-2 rotate-45 bg-slate-900 dark:bg-slate-800 border-r border-b border-slate-700/80" />
                      </div>
                    </div>
                  </span>

                  {/* Inline Toggle Switch: هر گرم / هر عدد */}
                  <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => updateField('wageMode', 'per_gram', true)}
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold transition-all cursor-pointer ${
                        wageMode === 'per_gram'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      هر گرم
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('wageMode', 'per_item', true)}
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold transition-all cursor-pointer ${
                        wageMode === 'per_item'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      هر عدد
                    </button>
                  </div>
                </div>

                <PriceInput
                  value={wageStr}
                  onValueChange={(_val, rawVal) => updateField('wage', rawVal, true)}
                  placeholder="۰"
                  currencySuffix={wageCurrencySuffix}
                  baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                  allowDecimals={isForeignWage}
                  onKeyDown={handleKeyDownEnter}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                />
                {numWage > 0 && (
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>اجرت کل ({wageMode === 'per_gram' ? 'وزنی' : 'تعدادی'}):</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">
                      {isForeignWage
                        ? `${toPersianDigits(calculatedTotalWage.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} ${wageCurrencySuffix}`
                        : formatMoney(calculatedTotalWage, effectiveCurrency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Field: تبدیل به x (Calculated field based on metal base purity) */}
            <div className="w-[160px] shrink-0">
              <Field label={`تبدیل به ${toPersianDigits(String(basePurity))} (معیار)`}>
                <div className="h-10 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 text-xs font-black text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <Scale size={14} />
                    وزن:
                  </span>
                  <span>
                    {toPersianDigits(calculatedConvertedWeight.toFixed(weightPrecision))} گرم
                  </span>
                </div>
              </Field>
            </div>

            {/* Option 1 & 3 Specific Field: درصد طلایی / درصد نقره‌ای / درصد پلاتینی */}
            <div className="w-[96px] shrink-0">
              <div className="space-y-1">
                <Field label={`${percentageFieldLabel} (٪)`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={5}
                    value={goldenPercentageStr ? toPersianDigits(goldenPercentageStr) : ''}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d.]/g, '').slice(0, 5);
                      updateField('goldenPercentage', cleaned, true);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                    className="h-10 w-full text-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                  />
                </Field>
                {isReturnOperation && selectedReturnItem && (
                  <span
                    className="block text-[9px] font-bold text-emerald-600 dark:text-emerald-400 text-center truncate"
                    title={`درصد فراخوانی‌شده از ${isReturnExit ? 'دریافت' : 'خروج'} قبلی: ${toPersianDigits(selectedReturnItem.goldenPercentage)}٪`}
                  >
                    {isReturnExit ? 'فراخوانی از دریافت' : 'فراخوانی از خروج'}
                  </span>
                )}
              </div>
            </div>

            {/* Field: مبلغ کل (Total Amount) with Override Capability */}
            <div className="flex-1 min-w-[200px]">
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1 min-h-5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Coins size={14} className="text-amber-500" />
                    مبلغ کل (تسویه مالی)
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToAutoTotal}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer"
                    title="محاسبه مجدد بر اساس فرمول"
                  >
                    <RefreshCw size={11} />
                    محاسبه مجدد
                  </button>
                </div>
                <PriceInput
                  value={totalAmountStr}
                  onValueChange={(_val, rawVal) => updateField('totalAmount', rawVal, false)}
                  placeholder="۰"
                  currencySuffix={wageCurrencySuffix}
                  baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                  allowDecimals={isForeignWage}
                  showWords={!isForeignWage}
                  onKeyDown={handleKeyDownEnter}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Option 2 & 4: فروش و خرید کار ساخته */
          <>
            <div className="flex flex-wrap items-start gap-3">
              {/* Field: قیمت فلز (هر گرم) */}
              <div className="flex-1 min-w-[180px]">
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 min-h-5">
                    قیمت {metalName} (هر گرم)
                  </span>
                  <PriceInput
                    value={metalPriceStr}
                    onValueChange={(_val, rawVal) => updateField('metalPrice', rawVal, true)}
                    placeholder="۰"
                    currencySuffix={wageCurrencySuffix}
                    baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                    allowDecimals={isForeignWage}
                    onKeyDown={handleKeyDownEnter}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                  />
                </div>
              </div>

              {/* Field: اجرت کار (Wage) with Mode Toggle (Currency synchronized with document top bar) */}
              <div className="w-[180px] shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1 min-h-5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Coins size={14} className="text-amber-500" />
                      <span>اجرت کار</span>
                      <div className="relative group/wage-info inline-flex items-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 p-0.5 rounded-full transition-colors cursor-help"
                          title="جهت محاسبه ارزی اجرت، می‌توانید نوع ارز را از منوی بالای سند انتخاب فرمایید."
                          aria-label="راهنمای ارز اجرت"
                        >
                          <Info size={13} />
                        </button>
                        <div className="pointer-events-none absolute bottom-full mb-2 right-1/2 translate-x-1/2 z-50 hidden group-hover/wage-info:block w-52 rounded-xl bg-slate-900 px-2.5 py-1.5 text-center text-[10px] font-medium leading-relaxed text-white shadow-xl dark:bg-slate-800 dark:text-slate-100 border border-slate-700/80">
                          جهت محاسبه ارزی اجرت، می‌توانید نوع ارز را از منوی بالای سند انتخاب فرمایید.
                          <div className="absolute -bottom-1 right-1/2 translate-x-1/2 h-2 w-2 rotate-45 bg-slate-900 dark:bg-slate-800 border-r border-b border-slate-700/80" />
                        </div>
                      </div>
                    </span>

                    <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => updateField('wageMode', 'per_gram', true)}
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold transition-all cursor-pointer ${
                          wageMode === 'per_gram'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        هر گرم
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('wageMode', 'per_item', true)}
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold transition-all cursor-pointer ${
                          wageMode === 'per_item'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        هر عدد
                      </button>
                    </div>
                  </div>

                  <PriceInput
                    value={wageStr}
                    onValueChange={(_val, rawVal) => updateField('wage', rawVal, true)}
                    placeholder="۰"
                    currencySuffix={wageCurrencySuffix}
                    baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                    allowDecimals={isForeignWage}
                    onKeyDown={handleKeyDownEnter}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                  />
                  {numWage > 0 && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>اجرت کل ({wageMode === 'per_gram' ? 'وزنی' : 'تعدادی'}):</span>
                      <span className="font-black text-amber-600 dark:text-amber-400">
                        {isForeignWage
                          ? `${toPersianDigits(calculatedTotalWage.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} ${wageCurrencySuffix}`
                          : formatMoney(calculatedTotalWage, effectiveCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Field: درصد سود (Profit Percentage) */}
              <div className="w-[96px] shrink-0">
                <Field label="درصد سود (٪)">
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={5}
                    value={profitPercentageStr ? toPersianDigits(profitPercentageStr) : ''}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d.]/g, '').slice(0, 5);
                      updateField('profitPercentage', cleaned, true);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                    className="h-10 w-full text-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs"
                  />
                </Field>
              </div>

              {/* Field: تبدیل به x */}
              <div className="w-[160px] shrink-0">
                <Field label={`تبدیل به ${toPersianDigits(String(basePurity))} (معیار)`}>
                  <div className="h-10 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 text-xs font-black text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <Scale size={14} />
                      وزن:
                    </span>
                    <span>
                      {toPersianDigits(calculatedConvertedWeight.toFixed(weightPrecision))} گرم
                    </span>
                  </div>
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              {/* Field: قیمت کل فلز (Metal Total Price) */}
              <div className="w-full">
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1 min-h-5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      قیمت کل {metalName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      (خودکار)
                    </span>
                  </div>
                  <PriceInput
                    value={calculatedMetalTotalPrice > 0 ? String(calculatedMetalTotalPrice) : ''}
                    readOnly
                    placeholder="۰"
                    currencySuffix={wageCurrencySuffix}
                    baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* Field: سود (Profit Amount) */}
              <div className="w-full">
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1 min-h-5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      مبلغ سود
                    </span>
                    {numProfitPercentage > 0 ? (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        ({toPersianDigits(profitPercentageStr)}٪)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">
                        (خودکار)
                      </span>
                    )}
                  </div>
                  <PriceInput
                    value={calculatedProfitAmount > 0 ? String(calculatedProfitAmount) : ''}
                    readOnly
                    placeholder="۰"
                    currencySuffix={wageCurrencySuffix}
                    baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* Field: مبلغ کل (Total Amount) with Override Capability */}
              <div className="w-full">
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1 min-h-5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Coins size={14} className="text-amber-500" />
                      مبلغ کل (تسویه)
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToAutoTotal}
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer"
                      title="محاسبه مجدد بر اساس فرمول"
                    >
                      <RefreshCw size={11} />
                      محاسبه
                    </button>
                  </div>
                  <PriceInput
                    value={totalAmountStr}
                    onValueChange={(_val, rawVal) => updateField('totalAmount', rawVal, false)}
                    placeholder="۰"
                    currencySuffix={wageCurrencySuffix}
                    baseCurrency={currentWageCurrencyCode === 'IRT' ? 'IRT' : 'IRR'}
                    allowDecimals={isForeignWage}
                    showWords={!isForeignWage}
                    onKeyDown={handleKeyDownEnter}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Row: توضیحات (Description) */}
        <div className="w-full pt-1">
          <Field label="توضیحات و شرح ردیف" wide>
            <textarea
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                if (setDraftLine) {
                  setDraftLine((prev) => ({ ...prev, description: val }));
                }
              }}
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات تکمیلی، مشخصات سنگ، برند، مدل یا کد کارگاه..."
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </Field>
        </div>
      </div>

      {/* 5. Live Summary Breakdown Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900/90 dark:to-slate-900/50">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              وزن فلز ({metalName}):
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              {toPersianDigits(numWeight.toFixed(weightPrecision))} گرم
            </span>
          </div>

          {(selectedOptionId === 1 || selectedOptionId === 3) && (
            <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                مقدار {percentageFieldLabel}:
              </span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                {toPersianDigits(calculatedGoldenAddition.toFixed(weightPrecision))} گرم
                {numGoldenPercentage > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400 mr-1">
                    ({toPersianDigits(goldenPercentageStr)}٪)
                  </span>
                ) : null}
              </span>
            </div>
          )}

          {(selectedOptionId === 2 || selectedOptionId === 4) && (
            <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                مبلغ سود:
              </span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                {formatMoney(calculatedProfitAmount, effectiveCurrency)}
                {numProfitPercentage > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400 mr-1">
                    ({toPersianDigits(profitPercentageStr)}٪)
                  </span>
                ) : null}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              تبدیل به {toPersianDigits(String(basePurity))}:
            </span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
              {toPersianDigits(calculatedConvertedWeight.toFixed(weightPrecision))} گرم
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              اجرت کل:
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              {isForeignWage
                ? `${toPersianDigits(calculatedTotalWage.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} ${wageCurrencySuffix}`
                : formatMoney(calculatedTotalWage, effectiveCurrency)}
            </span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-right dark:border-amber-900/60 dark:bg-amber-950/40 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              مبلغ کل نهایی:
            </span>
            <span className="text-xs font-black text-amber-900 dark:text-amber-200">
              {isForeignWage
                ? `${toPersianDigits(parseLocalizedAmount(totalAmountStr).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} ${wageCurrencySuffix}`
                : formatMoney(parseLocalizedAmount(totalAmountStr), effectiveCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Sticky Action Button */}
      {draftReady && !isLinesPinned ? (
        <div
          className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300"
        >
          <button
            type="button"
            disabled={!isFormValid}
            onClick={handleCommit}
            className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 max-w-sm w-full cursor-pointer ${
              isNaturePaid
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <ListPlus size={17} />
            <span>
              {editingLineId
                ? `ثبت اصلاح ردیف ${currentOption.label}`
                : `ثبت و افزودن ردیف ${currentOption.label}`}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
