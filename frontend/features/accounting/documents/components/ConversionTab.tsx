'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeftRight,
  Calculator,
  CheckCircle2,
  Coins,
  Info,
  Layers,
  ListPlus,
  RotateCcw,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { NumberField } from '@/components/ui/number-field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { convertRialToToman, convertTomanToRial } from '@/lib/money';
import {
  formatWithCommas,
  getAmountInPersianWords,
  getCurrencyUnitLabel,
  MESGHAL_17_TO_GRAM_18,
  parseNumericValue,
} from '@/src/lib/trade-utils';
import {
  convertedTo750,
  faNumber,
  numberValue,
  toPersianDigits,
  type MarketQuote,
} from '../utils/document-helpers';

export type ConversionMode = 'money_to_weight' | 'weight_to_money';

type ConversionTabProps = {
  nature?: 'received' | 'paid';
  onNatureChange?: (nextNature: 'received' | 'paid') => void;
  selectedCustomer?: Customer | null;
  draftLine?: DocumentLine;
  setDraftLine?: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  weightPrecision?: number;
  quotes?: MarketQuote[];
};

export default function ConversionTab({
  nature = 'received',
  onNatureChange,
  selectedCustomer,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency = 'IRR',
  weightPrecision = 3,
  quotes = [],
}: ConversionTabProps) {
  const isToman = baseCurrency === 'IRT';
  const currencySuffix = isToman ? 'تومان' : 'ریال';

  // Details extraction
  const details = draftLine?.details;
  const metalType: 'gold' | 'silver' | 'platinum' =
    details?.metalType === 'silver'
      ? 'silver'
      : details?.metalType === 'platinum'
        ? 'platinum'
        : 'gold';

  const defaultBaseKarat = metalType === 'silver' ? 999 : metalType === 'platinum' ? 950 : 750;
  const purity = details?.purity ? String(details.purity) : String(defaultBaseKarat);
  const baseKarat = details?.baseKarat || defaultBaseKarat;
  const metalPriceType = details?.metalPriceType || 'gram18';
  const metalPrice = details?.metalPrice ? String(details.metalPrice) : '';
  const totalAmount = details?.totalAmount ? String(details.totalAmount) : '';
  const rawWeight = details?.rawWeight ? String(details.rawWeight) : '';

  // Conversion mode: money_to_weight (default) or weight_to_money
  const [conversionMode, setConversionMode] = useState<ConversionMode>(() => {
    return details?.conversionMode === 'weight_to_money'
      ? 'weight_to_money'
      : 'money_to_weight';
  });

  const [isManualDescription, setIsManualDescription] = useState(false);

  // Sync conversionMode to draftLine details
  useEffect(() => {
    if (updateDraftDetail && details?.conversionMode !== conversionMode) {
      updateDraftDetail('conversionMode', conversionMode);
      updateDraftDetail(
        'documentSubType',
        conversionMode === 'money_to_weight'
          ? 'conversion-money-to-weight'
          : 'conversion-weight-to-money',
      );
      updateDraftDetail(
        'documentTypeLabel',
        conversionMode === 'money_to_weight' ? 'تبدیل مالی به وزنی' : 'تبدیل وزنی به مالی',
      );
    }
  }, [conversionMode, details, updateDraftDetail]);

  // Try to find live market quote
  const liveQuotePrice = useMemo(() => {
    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) return 0;
    if (metalType === 'gold') {
      if (metalPriceType === 'mesghal17') {
        const found = quotes.find(
          (q) =>
            q.symbol?.toLowerCase().includes('mesghal') ||
            q.title?.includes('مظنه') ||
            q.title?.includes('مثقال'),
        );
        if (found && found.price > 0) {
          return isToman && found.price > 10_000_000 ? Math.round(found.price / 10) : found.price;
        }
      }
      const found = quotes.find(
        (q) =>
          q.symbol?.toLowerCase().includes('gold') ||
          q.symbol?.toLowerCase().includes('geram18') ||
          q.title?.includes('گرم ۱۸') ||
          q.title?.includes('طلای ۱۸'),
      );
      if (found && found.price > 0) {
        return isToman && found.price > 10_000_000 ? Math.round(found.price / 10) : found.price;
      }
    } else if (metalType === 'silver') {
      const found = quotes.find(
        (q) => q.symbol?.toLowerCase().includes('silver') || q.title?.includes('نقره'),
      );
      if (found && found.price > 0) {
        return isToman && found.price > 10_000_000 ? Math.round(found.price / 10) : found.price;
      }
    }
    return 0;
  }, [quotes, metalType, metalPriceType, isToman]);

  // Set market rate handler
  const handleApplyLiveQuote = useCallback(() => {
    if (liveQuotePrice > 0 && updateDraftDetail) {
      updateDraftDetail('metalPrice', String(liveQuotePrice));
    }
  }, [liveQuotePrice, updateDraftDetail]);

  // Price per gram based on metalPrice and metalPriceType
  const pricePerGram = useMemo(() => {
    const p = parseNumericValue(metalPrice);
    if (p <= 0) return 0;
    if (metalType === 'gold' && metalPriceType === 'mesghal17') {
      return p / MESGHAL_17_TO_GRAM_18;
    }
    return p;
  }, [metalPrice, metalType, metalPriceType]);

  // Recalculate and synchronize weight or money
  useEffect(() => {
    if (!updateDraftDetail) return;
    const purityNum = parseNumericValue(purity) || baseKarat;

    if (conversionMode === 'money_to_weight') {
      const moneyNum = parseNumericValue(totalAmount);
      if (moneyNum > 0 && pricePerGram > 0 && purityNum > 0) {
        // weight at 750 = money / pricePerGram
        const weight750 = moneyNum / pricePerGram;
        // actual raw weight = (weight750 * baseKarat) / purity
        const actualWeight = (weight750 * baseKarat) / purityNum;
        const formattedWeight = actualWeight.toFixed(weightPrecision);

        if (details?.rawWeight !== formattedWeight) {
          updateDraftDetail('rawWeight', formattedWeight);
          updateDraftDetail('convertedWeight', String(weight750));
        }
        if (setDraftLine) {
          setDraftLine((prev) => ({
            ...prev,
            converted750: weight750,
          }));
        }
      }
    } else {
      // weight_to_money mode
      const weightNum = parseNumericValue(rawWeight);
      if (weightNum > 0 && pricePerGram > 0 && purityNum > 0) {
        const weight750 = (weightNum * purityNum) / baseKarat;
        const calculatedMoney = Math.round(weight750 * pricePerGram);
        const formattedMoney = String(calculatedMoney);

        if (details?.totalAmount !== formattedMoney) {
          updateDraftDetail('totalAmount', formattedMoney);
          updateDraftDetail('convertedWeight', String(weight750));
        }
        if (setDraftLine) {
          setDraftLine((prev) => ({
            ...prev,
            converted750: weight750,
          }));
        }
      }
    }
  }, [
    conversionMode,
    totalAmount,
    rawWeight,
    pricePerGram,
    purity,
    baseKarat,
    weightPrecision,
    updateDraftDetail,
    setDraftLine,
    details?.rawWeight,
    details?.totalAmount,
  ]);

  // Auto-generate description
  useEffect(() => {
    if (isManualDescription || !setDraftLine) return;

    const moneyNum = parseNumericValue(totalAmount);
    const weightNum = parseNumericValue(rawWeight);
    const priceNum = parseNumericValue(metalPrice);

    if (moneyNum <= 0 || weightNum <= 0 || priceNum <= 0) return;

    const metalLabel =
      metalType === 'gold' ? 'طلای ۷۵۰' : metalType === 'silver' ? 'نقره' : 'پلاتین';
    const rateLabel =
      metalType === 'gold' && metalPriceType === 'mesghal17'
        ? `مظنه مثقال ${formatWithCommas(priceNum)} ${currencySuffix}`
        : `نرخ هر گرم ${formatWithCommas(priceNum)} ${currencySuffix}`;

    const desc =
      nature === 'received'
        ? `تبدیل بدهی مالی به مبلغ ${formatWithCommas(moneyNum)} ${currencySuffix} به ${faNumber(weightNum, weightPrecision)} گرم ${metalLabel} (${rateLabel})`
        : `تبدیل بستانکاری مالی به مبلغ ${formatWithCommas(moneyNum)} ${currencySuffix} به ${faNumber(weightNum, weightPrecision)} گرم ${metalLabel} (${rateLabel})`;

    setDraftLine((prev) => {
      if (prev.description === desc) return prev;
      return { ...prev, description: desc };
    });
  }, [
    isManualDescription,
    totalAmount,
    rawWeight,
    metalPrice,
    metalType,
    metalPriceType,
    nature,
    currencySuffix,
    weightPrecision,
    setDraftLine,
  ]);

  // Customer balance insights
  const customerRialBalance = selectedCustomer?.rialBalance ?? 0;
  // If customer.rialBalance is in IRR, convert to Toman if baseCurrency is IRT
  const customerFinancialBalanceInDisplay = isToman
    ? Math.round(customerRialBalance / 10)
    : customerRialBalance;

  const hasFinancialDebt = customerFinancialBalanceInDisplay < 0;
  const hasFinancialCredit = customerFinancialBalanceInDisplay > 0;
  const financialDebtAbs = Math.abs(customerFinancialBalanceInDisplay);

  // Customer weight balance for active metal
  const customerWeightBalance =
    metalType === 'gold'
      ? selectedCustomer?.goldBalance ?? 0
      : metalType === 'silver'
        ? selectedCustomer?.silverBalance ?? 0
        : selectedCustomer?.platinumBalance ?? 0;

  // Handler for Fast Settlement Button: "تسویه کل بدهی مالی (۱۰۰,۰۰۰,۰۰۰ تومان)"
  const handleSettleFullFinancialDebt = useCallback(() => {
    if (!updateDraftDetail || financialDebtAbs <= 0) return;

    // Set mode to money_to_weight
    setConversionMode('money_to_weight');

    // Customer owing money means we settle by receiving/clearing it:
    // Nature 'received' in Zarfolio trade line credits rialAmount (+) and debits weight (-)
    if (nature !== 'received') {
      onNatureChange?.('received');
    }

    // Set financial amount to full debt
    updateDraftDetail('totalAmount', String(financialDebtAbs));

    // If live quote available and metal price not set, auto-apply live quote
    if ((!metalPrice || parseNumericValue(metalPrice) <= 0) && liveQuotePrice > 0) {
      updateDraftDetail('metalPrice', String(liveQuotePrice));
    }
  }, [
    financialDebtAbs,
    updateDraftDetail,
    nature,
    onNatureChange,
    metalPrice,
    liveQuotePrice,
  ]);

  // Handler for Credit Conversion: "تبدیل کل بستانکاری مالی"
  const handleConvertFullCredit = useCallback(() => {
    if (!updateDraftDetail || customerFinancialBalanceInDisplay <= 0) return;

    setConversionMode('money_to_weight');
    if (nature !== 'paid') {
      onNatureChange?.('paid');
    }

    updateDraftDetail('totalAmount', String(customerFinancialBalanceInDisplay));
    if ((!metalPrice || parseNumericValue(metalPrice) <= 0) && liveQuotePrice > 0) {
      updateDraftDetail('metalPrice', String(liveQuotePrice));
    }
  }, [
    customerFinancialBalanceInDisplay,
    updateDraftDetail,
    nature,
    onNatureChange,
    metalPrice,
    liveQuotePrice,
  ]);

  // Simulation calculations
  const effectiveMoneyNum = parseNumericValue(totalAmount);
  const effectiveWeightNum = parseNumericValue(rawWeight);

  // Direction:
  // 'received': customer is credited financially (+), debited weight (-)
  // 'paid': customer is debited financially (-), credited weight (+)
  const simulatedFinancialDelta =
    effectiveMoneyNum > 0 ? (nature === 'received' ? effectiveMoneyNum : -effectiveMoneyNum) : 0;
  const simulatedWeightDelta =
    effectiveWeightNum > 0
      ? nature === 'received'
        ? -effectiveWeightNum
        : effectiveWeightNum
      : 0;

  const simulatedFinalFinancial = customerFinancialBalanceInDisplay + simulatedFinancialDelta;
  const simulatedFinalWeight = customerWeightBalance + simulatedWeightDelta;

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>تبدیل بدهی و مانده حساب (مالی ⇄ وزنی)</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                تسویه حساب
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تبدیل بدهی یا طلب مالی طرف‌حساب به تعهد وزنی با جنس فلز انتخابی یا برعکس
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setConversionMode('money_to_weight')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              conversionMode === 'money_to_weight'
                ? 'bg-white text-amber-700 shadow-sm dark:bg-slate-700 dark:text-amber-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>تبدیل مالی به وزنی</span>
          </button>
          <button
            type="button"
            onClick={() => setConversionMode('weight_to_money')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              conversionMode === 'weight_to_money'
                ? 'bg-white text-amber-700 shadow-sm dark:bg-slate-700 dark:text-amber-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            <span>تبدیل وزنی به مالی</span>
          </button>
        </div>
      </div>

      {/* 2. Customer Insights & Fast Settlement Action */}
      {selectedCustomer ? (
        <div
          className={`rounded-xl border p-3.5 transition-all ${
            hasFinancialDebt
              ? 'border-red-500/30 bg-red-500/5 text-red-950 dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-100'
              : hasFinancialCredit
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-100'
                : 'border-slate-300/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  وضعیت فعلی طرف‌حساب:
                </span>
                <strong className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {selectedCustomer.name}
                </strong>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  (کد: {selectedCustomer.customerCode})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>
                  تراز مالی:{' '}
                  <strong className="font-mono font-bold">
                    {hasFinancialDebt
                      ? `${formatWithCommas(financialDebtAbs)} ${currencySuffix} بدهکار`
                      : hasFinancialCredit
                        ? `${formatWithCommas(customerFinancialBalanceInDisplay)} ${currencySuffix} بستانکار`
                        : `۰ ${currencySuffix} (تسویه)`}
                  </strong>
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  تراز وزنی ({metalType === 'gold' ? 'طلا' : metalType === 'silver' ? 'نقره' : 'پلاتین'}):{' '}
                  <strong className="font-mono font-bold">
                    {customerWeightBalance < 0
                      ? `${faNumber(Math.abs(customerWeightBalance), weightPrecision)} گرم بدهکار`
                      : customerWeightBalance > 0
                        ? `${faNumber(customerWeightBalance, weightPrecision)} گرم بستانکار`
                        : `۰ گرم`}
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Settle / Convert Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {hasFinancialDebt ? (
                <button
                  type="button"
                  onClick={handleSettleFullFinancialDebt}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:scale-95 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>تسویه کل بدهی مالی ({formatWithCommas(financialDebtAbs)} {currencySuffix})</span>
                </button>
              ) : hasFinancialCredit ? (
                <button
                  type="button"
                  onClick={handleConvertFullCredit}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>تبدیل کل بستانکاری مالی ({formatWithCommas(customerFinancialBalanceInDisplay)} {currencySuffix})</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0" />
          <span>برای محاسبه دقیق مانده حساب و تراز زنده، ابتدا طرف‌حساب سند را از بالای صفحه انتخاب کنید.</span>
        </div>
      )}

      {/* 3. Direction & Purpose Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNatureChange?.('received')}
          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all ${
            nature === 'received'
              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 text-amber-950 dark:text-amber-100'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`h-2 w-2 rounded-full ${nature === 'received' ? 'bg-amber-500' : 'bg-slate-400'}`}
            />
            <span>تسویه بدهی طرف‌حساب (طرف‌حساب بدهکار وزنی می‌شود)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            مشتری به شما بدهی مالی داشته است؛ با ثبت این ردیف بدهی مالی صفر شده و به ازای آن بدهی وزنی فلز انتخابی ثبت می‌گردد.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNatureChange?.('paid')}
          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all ${
            nature === 'paid'
              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500 text-blue-950 dark:text-blue-100'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`h-2 w-2 rounded-full ${nature === 'paid' ? 'bg-blue-500' : 'bg-slate-400'}`}
            />
            <span>تبدیل طلب طرف‌حساب (طرف‌حساب بستانکار وزنی می‌شود)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            مشتری از شما بستانکار مالی بوده است؛ با ثبت این ردیف طلب مالی کسر شده و طرف‌حساب طلبکار وزنی طلا/فلز می‌شود.
          </p>
        </button>
      </div>

      {/* 4. Main Conversion Form Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metal Type */}
          <Field label="جنس فلز تبدیل">
            <select
              value={metalType}
              onChange={(e) => {
                const nextMetal = e.target.value as 'gold' | 'silver' | 'platinum';
                updateDraftDetail?.('metalType', nextMetal);
                if (nextMetal === 'gold') {
                  updateDraftDetail?.('purity', '750');
                  updateDraftDetail?.('baseKarat', 750);
                  updateDraftDetail?.('metalPriceType', 'gram18');
                } else if (nextMetal === 'silver') {
                  updateDraftDetail?.('purity', '999');
                  updateDraftDetail?.('baseKarat', 999);
                  updateDraftDetail?.('metalPriceType', 'gramSilver999');
                } else {
                  updateDraftDetail?.('purity', '950');
                  updateDraftDetail?.('baseKarat', 950);
                  updateDraftDetail?.('metalPriceType', 'gramPlatinum');
                }
              }}
              onKeyDown={handleKeyDownEnter}
              className="w-full font-medium"
            >
              <option value="gold">طلا (۷۵۰)</option>
              <option value="silver">نقره (۹۹۹)</option>
              <option value="platinum">پلاتین (۹۵۰)</option>
            </select>
          </Field>

          {/* Pricing Mode (Gold only) */}
          {metalType === 'gold' ? (
            <Field label="مبنای قیمت‌گذاری طلا">
              <select
                value={metalPriceType}
                onChange={(e) => {
                  updateDraftDetail?.(
                    'metalPriceType',
                    e.target.value as 'gram18' | 'mesghal17',
                  );
                }}
                onKeyDown={handleKeyDownEnter}
                className="w-full font-medium"
              >
                <option value="gram18">نرخ هر گرم ۱۸ عیار (۷۵۰)</option>
                <option value="mesghal17">مظنه هر مثقال ۱۷ عیار (۷۰۵)</option>
              </select>
            </Field>
          ) : (
            <Field label="عیار استاندارد">
              <input
                type="text"
                readOnly
                value={purity}
                className="w-full bg-slate-100 font-mono dark:bg-slate-800"
              />
            </Field>
          )}

          {/* Unit Metal Rate Input */}
          <Field
            label={
              <div className="flex items-center justify-between w-full">
                <span>
                  {metalType === 'gold'
                    ? metalPriceType === 'mesghal17'
                      ? `مظنه مثقال (${currencySuffix})`
                      : `نرخ هر گرم ۱۸ (${currencySuffix})`
                    : `نرخ هر گرم ${metalType === 'silver' ? 'نقره' : 'پلاتین'} (${currencySuffix})`}
                </span>
                {liveQuotePrice > 0 ? (
                  <button
                    type="button"
                    onClick={handleApplyLiveQuote}
                    className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold"
                    title={`نرخ روز: ${formatWithCommas(liveQuotePrice)} ${currencySuffix}`}
                  >
                    <TrendingUp className="h-3 w-3" />
                    <span>نرخ روز ({formatWithCommas(liveQuotePrice)})</span>
                  </button>
                ) : null}
              </div>
            }
          >
            <input
              type="text"
              value={formatWithCommas(metalPrice)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                updateDraftDetail?.('metalPrice', raw);
              }}
              onKeyDown={handleKeyDownEnter}
              placeholder="مثلاً: ۱۰,۰۰۰,۰۰۰"
              className="w-full font-mono text-left"
            />
          </Field>

          {/* Carat / Purity if gold */}
          {metalType === 'gold' ? (
            <Field label="عیار تبدیل">
              <NumberField
                value={Number(purity) || 750}
                onChange={(val) => updateDraftDetail?.('purity', String(val))}
                step="purity"
                min={1}
                max={999.9}
                className="w-full font-mono"
              />
            </Field>
          ) : (
            <Field label="واحد قیمت">
              <input
                type="text"
                readOnly
                value={currencySuffix}
                className="w-full bg-slate-100 dark:bg-slate-800"
              />
            </Field>
          )}
        </div>

        {/* Amount & Weight Row */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Financial Amount */}
          <div>
            <MoneyInputField
              label={`مبلغ مالی تبدیل (${currencySuffix})`}
              value={totalAmount}
              onChange={(val) => updateDraftDetail?.('totalAmount', val)}
              baseCurrency={baseCurrency}
              currencySuffix={currencySuffix}
              onKeyDown={handleKeyDownEnter}
              showWords
              placeholder="مثلاً: ۱۰۰,۰۰۰,۰۰۰"
            />
            {conversionMode === 'money_to_weight' && pricePerGram > 0 && parseNumericValue(totalAmount) > 0 ? (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Calculator className="h-3 w-3" />
                <span>
                  مبلغ ÷ نرخ هر گرم ={' '}
                  <strong className="font-mono text-amber-600 dark:text-amber-400">
                    {faNumber(parseNumericValue(rawWeight), weightPrecision)} گرم
                  </strong>
                </span>
              </div>
            ) : null}
          </div>

          {/* Calculated / Inputted Weight */}
          <div>
            <Field
              label={
                <div className="flex items-center justify-between w-full">
                  <span>
                    وزن معادل ({metalType === 'gold' ? 'طلای ۷۵۰' : metalType === 'silver' ? 'نقره' : 'پلاتین'})
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    دقت: {weightPrecision} رقم اعشار
                  </span>
                </div>
              }
            >
              <div className="relative">
                <input
                  type="text"
                  value={rawWeight}
                  readOnly={conversionMode === 'money_to_weight'}
                  onChange={(e) => {
                    if (conversionMode === 'weight_to_money') {
                      updateDraftDetail?.('rawWeight', e.target.value);
                    }
                  }}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="۰.۰۰۰"
                  className={`w-full font-mono text-left pl-12 ${
                    conversionMode === 'money_to_weight'
                      ? 'bg-amber-500/10 font-bold text-amber-900 dark:bg-amber-500/15 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                      : ''
                  }`}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  گرم
                </span>
              </div>
            </Field>

            {conversionMode === 'weight_to_money' && pricePerGram > 0 && parseNumericValue(rawWeight) > 0 ? (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Calculator className="h-3 w-3" />
                <span>
                  وزن × نرخ هر گرم ={' '}
                  <strong className="font-mono text-amber-600 dark:text-amber-400">
                    {formatWithCommas(parseNumericValue(totalAmount))} {currencySuffix}
                  </strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Row 3: Description */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Field label="شرح ردیف سند" wide>
            <div className="relative">
              <textarea
                value={draftLine?.description || ''}
                onChange={(e) => {
                  setIsManualDescription(true);
                  if (setDraftLine) {
                    setDraftLine((prev) => ({ ...prev, description: e.target.value }));
                  }
                }}
                onKeyDown={handleKeyDownEnter}
                placeholder="توضیحات و شرح تبدیل..."
                rows={2}
                className="w-full"
              />
              {isManualDescription ? (
                <button
                  type="button"
                  onClick={() => setIsManualDescription(false)}
                  className="absolute left-2.5 bottom-2.5 flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  title="بازگشت به شرح خودکار"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>تولید مجدد شرح</span>
                </button>
              ) : null}
            </div>
          </Field>
        </div>
      </div>

      {/* 5. Live Accounting Impact & Simulation Preview */}
      {effectiveMoneyNum > 0 && effectiveWeightNum > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              پیش‌نمایش تغییرات مانده حساب پس از ثبت این ردیف:
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Box 1: Financial Impact */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">تغییر مالی طرف‌حساب:</div>
              <div className="mt-1 flex items-baseline gap-1">
                <strong
                  className={`text-sm font-mono font-bold ${
                    simulatedFinancialDelta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {simulatedFinancialDelta > 0 ? '+' : ''}
                  {formatWithCommas(simulatedFinancialDelta)}
                </strong>
                <span className="text-[10px] text-slate-500">{currencySuffix}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {nature === 'received'
                  ? 'بستانکار مالی (کاهش و تسویه بدهی)'
                  : 'بدهکار مالی (کاهش طلب)'}
              </div>
            </div>

            {/* Box 2: Weight Impact */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">تغییر وزنی طرف‌حساب:</div>
              <div className="mt-1 flex items-baseline gap-1">
                <strong
                  className={`text-sm font-mono font-bold ${
                    simulatedWeightDelta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {simulatedWeightDelta > 0 ? '+' : ''}
                  {faNumber(simulatedWeightDelta, weightPrecision)}
                </strong>
                <span className="text-[10px] text-slate-500">گرم طلا/فلز</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {nature === 'received'
                  ? 'بدهکار وزنی (ایجاد تعهد وزنی)'
                  : 'بستانکار وزنی (تحویل تعهد وزنی)'}
              </div>
            </div>

            {/* Box 3: Final Expected Balances */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 dark:border-amber-500/40 dark:bg-amber-950/20">
              <div className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                تراز نهایی پس از ثبت:
              </div>
              <div className="mt-1 space-y-0.5 font-mono text-[11px]">
                <div>
                  مالی:{' '}
                  <strong className="font-bold">
                    {simulatedFinalFinancial === 0
                      ? '۰ (تسویه کامل ✓)'
                      : `${formatWithCommas(simulatedFinalFinancial)} ${currencySuffix}`}
                  </strong>
                </div>
                <div>
                  وزنی:{' '}
                  <strong className="font-bold">
                    {simulatedFinalWeight === 0
                      ? '۰ گرم'
                      : `${faNumber(simulatedFinalWeight, weightPrecision)} گرم`}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 6. Sticky / Floating Commit Line Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm flex items-center justify-center gap-2"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} />
            <span>{editingLineId ? 'ثبت اصلاح ردیف تبدیل' : 'ثبت ردیف تبدیل در سند'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
