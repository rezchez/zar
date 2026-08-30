'use client';

import React, { useMemo, useCallback } from 'react';
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
} from 'lucide-react';

import { useAppSettings } from '@/src/components/SettingsProvider';
import { PriceInput } from '@/components/ui/price-input';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { parseLocalizedAmount, formatMoney } from '@/lib/money';

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

export interface WorkmanshipTabProps {
  nature?: 'paid' | 'received';
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
  onAddLine,
}: WorkmanshipTabProps) {
  const { settings } = useAppSettings();
  const effectiveCurrency = baseCurrency || (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;

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

  // Operation Options according to document nature
  const operationOptions = useMemo(() => {
    if (nature === 'paid') {
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
          label: 'فروش کار ساخته',
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
          label: 'خرید کار ساخته',
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
  }, [nature]);

  // Current values read directly from draftLine details (Single source of truth)
  const selectedOptionId = draftLine?.details?.workmanshipOptionId || 1;
  const currentOption = useMemo(() => {
    return operationOptions.find((opt) => opt.id === selectedOptionId) ?? operationOptions[0];
  }, [operationOptions, selectedOptionId]);

  const rawWeightStr = draftLine?.details?.rawWeight || '';
  const quantityStr = draftLine?.details?.quantity || '1';
  const workmanshipName = draftLine?.details?.workmanshipName || '';
  const wageStr = draftLine?.details?.wage || '';
  const wageMode: WageMode = (draftLine?.details?.wageMode as WageMode) || 'per_gram';
  const purityStr = draftLine?.details?.purity || String(basePurity);
  const goldenPercentageStr = draftLine?.details?.goldenPercentage || '';
  const profitPercentageStr = draftLine?.details?.profitPercentage || '';
  const metalPriceStr = draftLine?.details?.metalPrice || '';
  const discountAmountStr = draftLine?.details?.discountAmount || '';
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
    return parseLocalizedAmount(wageStr);
  }, [wageStr]);

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

  const numDiscount = useMemo(() => {
    return parseLocalizedAmount(discountAmountStr);
  }, [discountAmountStr]);

  // Derived calculations
  const calculatedTotalWage = useMemo(() => {
    if (wageMode === 'per_gram') {
      return Math.round(numWeight * numWage);
    } else {
      return Math.round(numQuantity * numWage);
    }
  }, [wageMode, numWeight, numQuantity, numWage]);

  const calculatedConvertedWeight = useMemo(() => {
    if (basePurity <= 0 || numWeight <= 0) return 0;
    const baseConverted = (numWeight * numPurity) / basePurity;
    if (selectedOptionId === 1 || selectedOptionId === 3) {
      const goldenAddition = numWeight * (numGoldenPercentage / 100);
      return baseConverted + goldenAddition;
    }
    return baseConverted;
  }, [basePurity, numWeight, numPurity, selectedOptionId, numGoldenPercentage]);

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
      return Math.max(0, gross - numDiscount);
    }
  }, [selectedOptionId, calculatedTotalWage, calculatedMetalTotalPrice, calculatedProfitAmount, numDiscount]);

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

          // Recompute dependent figures
          const nextWeight = field === 'rawWeight' ? (parseFloat(normalizeDigits(String(value)).replace(/,/g, '')) || 0) : (parseFloat(normalizeDigits(updatedDetails.rawWeight || '').replace(/,/g, '')) || 0);
          const nextQty = field === 'quantity' ? (parseInt(normalizeDigits(String(value)), 10) || 1) : (parseInt(normalizeDigits(updatedDetails.quantity || '1'), 10) || 1);
          const nextWage = field === 'wage' ? parseLocalizedAmount(String(value)) : parseLocalizedAmount(updatedDetails.wage || '');
          const nextWageMode = (field === 'wageMode' ? value : updatedDetails.wageMode || 'per_gram') as WageMode;
          const nextPurity = field === 'purity' ? (parseFloat(normalizeDigits(String(value))) || basePurity) : (parseFloat(normalizeDigits(updatedDetails.purity || '')) || basePurity);
          const nextGoldenPct = field === 'goldenPercentage' ? (parseFloat(normalizeDigits(String(value))) || 0) : (parseFloat(normalizeDigits(updatedDetails.goldenPercentage || '')) || 0);
          const nextMetalPrice = field === 'metalPrice' ? parseLocalizedAmount(String(value)) : parseLocalizedAmount(updatedDetails.metalPrice || '');
          const nextProfitPct = field === 'profitPercentage' ? (parseFloat(normalizeDigits(String(value))) || 0) : (parseFloat(normalizeDigits(updatedDetails.profitPercentage || '')) || 0);
          const nextDiscount = field === 'discountAmount' ? parseLocalizedAmount(String(value)) : parseLocalizedAmount(updatedDetails.discountAmount || '');
          const optId = (field === 'workmanshipOptionId' ? Number(value) : updatedDetails.workmanshipOptionId) || 1;

          const tWage = nextWageMode === 'per_gram' ? Math.round(nextWeight * nextWage) : Math.round(nextQty * nextWage);
          const stdW = basePurity > 0 ? (nextWeight * nextPurity) / basePurity : nextWeight;
          const convW = (optId === 1 || optId === 3) ? stdW + (nextWeight * (nextGoldenPct / 100)) : stdW;
          const mTotalPrice = Math.round(stdW * nextMetalPrice);
          const pAmount = Math.round((mTotalPrice + tWage) * (nextProfitPct / 100));

          updatedDetails.metalTotalPrice = String(mTotalPrice);
          updatedDetails.profitAmount = String(pAmount);
          updatedDetails.convertedWeight = convW.toFixed(weightPrecision);

          if (autoCalcTotal && field !== 'totalAmount') {
            let nextTotal = 0;
            if (optId === 1 || optId === 3) {
              nextTotal = tWage;
            } else {
              nextTotal = Math.max(0, mTotalPrice + tWage + pAmount - nextDiscount);
            }
            updatedDetails.totalAmount = nextTotal > 0 ? String(nextTotal) : '';
          }

          const opt = operationOptions.find((o) => o.id === optId) ?? operationOptions[0];

          return {
            ...prev,
            documentNature: nature,
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
    [setDraftLine, updateDraftDetail, currentMetalType, basePurity, weightPrecision, operationOptions, nature]
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
      const newLine: DocumentLine = {
        id: crypto.randomUUID(),
        documentNature: nature,
        documentTab: 'workmanship',
        sourceTab: 'workmanship',
        documentSubType: currentOption.key,
        documentTypeLabel: currentOption.label,
        converted750: calculatedConvertedWeight,
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: description,
        details: {
          metalType: currentMetalType,
          rawKind: 'molten',
          rawWeight: rawWeightStr,
          purity: purityStr,
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: metalPriceStr,
          totalAmount: totalAmountStr,
          labName: '',
          stampNumber: '',
          currencyUnit: 'IRR',
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
          quantity: quantityStr,
          wage: wageStr,
          wageMode: wageMode,
          goldenPercentage: goldenPercentageStr,
          profitPercentage: profitPercentageStr,
          metalTotalPrice: String(calculatedMetalTotalPrice),
          profitAmount: String(calculatedProfitAmount),
          discountAmount: discountAmountStr,
          convertedWeight: calculatedConvertedWeight.toFixed(weightPrecision),
          workmanshipOptionId: selectedOptionId,
          workmanshipOptionLabel: currentOption.label,
        },
      };
      onAddLine(newLine);
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
              nature === 'paid'
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
            nature === 'paid'
              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              nature === 'paid' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          {nature === 'paid' ? 'سند پرداختی (خروج/فروش)' : 'سند دریافتی (ورود/خرید)'}
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
                    ? nature === 'paid'
                      ? 'border-rose-500 bg-rose-50/70 text-rose-950 shadow-md ring-2 ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-100'
                      : 'border-emerald-500 bg-emerald-50/70 text-emerald-950 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isSelected
                        ? nature === 'paid'
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

      {/* 4. Form Fields Grid */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Field: نام کار ساخته (Artifact Name) */}
          <Field label="نام کار ساخته" required>
            <input
              type="text"
              value={workmanshipName}
              onChange={(e) => updateField('workmanshipName', e.target.value, false)}
              onKeyDown={handleKeyDownEnter}
              placeholder="مثلاً: النگو ریخته، انگشتر زنانه..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
            />
          </Field>

          {/* Field: وزن (Weight in grams) */}
          <Field label={`وزن ${metalName} (گرم)`} required>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={rawWeightStr}
                onChange={(e) => updateField('rawWeight', e.target.value, true)}
                onKeyDown={handleKeyDownEnter}
                placeholder="۰.۰۰۰"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
              />
              <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-bold text-slate-400">
                گرم
              </span>
            </div>
          </Field>

          {/* Field: تعداد (Quantity/Count) */}
          <Field label="تعداد (عدد)">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={quantityStr}
                onChange={(e) => updateField('quantity', e.target.value, true)}
                onKeyDown={handleKeyDownEnter}
                placeholder="۱"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
              />
              <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-bold text-slate-400">
                عدد
              </span>
            </div>
          </Field>

          {/* Field: اجرت کار (Wage) with Inline Mode Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                اجرت کار
              </span>
              {/* Inline Toggle Switch: هر گرم / هر عدد */}
              <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => updateField('wageMode', 'per_gram', true)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
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
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
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
              currencySuffix={currencySuffix}
              baseCurrency={effectiveCurrency}
              onKeyDown={handleKeyDownEnter}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
            />
            {numWage > 0 && (
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>اجرت کل ({wageMode === 'per_gram' ? 'وزنی' : 'تعدادی'}):</span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(calculatedTotalWage, effectiveCurrency)}
                </span>
              </div>
            )}
          </div>

          {/* Field: عیار (Purity) */}
          <Field label={`عیار ${metalName}`}>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={purityStr}
                onChange={(e) => updateField('purity', e.target.value, true)}
                onKeyDown={handleKeyDownEnter}
                placeholder={String(basePurity)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
              />
              <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-bold text-slate-400">
                / ۱۰۰۰
              </span>
            </div>
          </Field>

          {/* Field: تبدیل به x (Calculated field based on metal base purity) */}
          <Field label={`تبدیل به ${toPersianDigits(String(basePurity))} (عیار معیار)`}>
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs font-black text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <Scale size={14} />
                وزن معیار:
              </span>
              <span>
                {toPersianDigits(calculatedConvertedWeight.toFixed(weightPrecision))} گرم
              </span>
            </div>
          </Field>

          {/* Dynamic Option Fields: Option 1 & 3 vs Option 2 & 4 */}
          {selectedOptionId === 1 || selectedOptionId === 3 ? (
            /* Option 1 & 3 Specific Field: درصد طلایی (Golden Percentage) */
            <Field label="درصد طلایی (٪)">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={goldenPercentageStr}
                  onChange={(e) => updateField('goldenPercentage', e.target.value, true)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="۰"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-bold text-slate-400">
                  ٪
                </span>
              </div>
            </Field>
          ) : (
            /* Option 2 & 4 Specific Fields: فروش و خرید کار ساخته */
            <>
              {/* Field: قیمت فلز (هر گرم) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  قیمت {metalName} (هر گرم)
                </label>
                <PriceInput
                  value={metalPriceStr}
                  onValueChange={(_val, rawVal) => updateField('metalPrice', rawVal, true)}
                  placeholder="۰"
                  currencySuffix={currencySuffix}
                  baseCurrency={effectiveCurrency}
                  onKeyDown={handleKeyDownEnter}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
                />
              </div>

              {/* Field: درصد سود (Profit Percentage) */}
              <Field label="درصد سود (٪)">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={profitPercentageStr}
                    onChange={(e) => updateField('profitPercentage', e.target.value, true)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-bold text-slate-400">
                    ٪
                  </span>
                </div>
              </Field>

              {/* Field: قیمت کل فلز (Metal Total Price) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    قیمت کل فلز
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    (محاسبه خودکار)
                  </span>
                </div>
                <PriceInput
                  value={calculatedMetalTotalPrice > 0 ? String(calculatedMetalTotalPrice) : ''}
                  readOnly
                  placeholder="۰"
                  currencySuffix={currencySuffix}
                  baseCurrency={effectiveCurrency}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                />
              </div>

              {/* Field: سود (Profit Amount) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    مبلغ سود
                  </span>
                  {numProfitPercentage > 0 ? (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      ({toPersianDigits(profitPercentageStr)}٪)
                    </span>
                  ) : null}
                </div>
                <PriceInput
                  value={calculatedProfitAmount > 0 ? String(calculatedProfitAmount) : ''}
                  readOnly
                  placeholder="۰"
                  currencySuffix={currencySuffix}
                  baseCurrency={effectiveCurrency}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                />
              </div>

              {/* Field: تخفیف (Discount Amount) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  تخفیف
                </label>
                <PriceInput
                  value={discountAmountStr}
                  onValueChange={(_val, rawVal) => updateField('discountAmount', rawVal, true)}
                  placeholder="۰"
                  currencySuffix={currencySuffix}
                  baseCurrency={effectiveCurrency}
                  onKeyDown={handleKeyDownEnter}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
                />
              </div>
            </>
          )}

          {/* Field: مبلغ کل (Total Amount) with Override Capability */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
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
              currencySuffix={currencySuffix}
              baseCurrency={effectiveCurrency}
              showWords
              onKeyDown={handleKeyDownEnter}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-black text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
            />
          </div>

          {/* Field: توضیحات (Description) */}
          <div className="sm:col-span-2 lg:col-span-3">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:border-amber-500"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* 5. Live Summary Breakdown Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-4 shadow-xs dark:border-slate-800 dark:from-slate-900/90 dark:to-slate-900/50">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 text-right dark:border-slate-800 dark:bg-slate-800/70">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              وزن فلز ({metalName}):
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              {toPersianDigits(numWeight.toFixed(weightPrecision))} گرم
            </span>
          </div>

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
              {formatMoney(calculatedTotalWage, effectiveCurrency)}
            </span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-right dark:border-amber-900/60 dark:bg-amber-950/40">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              مبلغ کل نهایی:
            </span>
            <span className="text-xs font-black text-amber-900 dark:text-amber-200">
              {formatMoney(parseLocalizedAmount(totalAmountStr), effectiveCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Sticky Action Button */}
      {draftReady ? (
        <div
          className={`sticky ${
            isLinesPinned ? 'bottom-32' : 'bottom-3'
          } z-30 flex justify-center pt-2 transition-all duration-300`}
        >
          <button
            type="button"
            disabled={!isFormValid}
            onClick={handleCommit}
            className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 max-w-sm w-full cursor-pointer ${
              nature === 'paid'
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
