'use client';

import { AlertCircle, ArrowDownToLine, Globe, Info, ListPlus, RefreshCw, Settings } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { NumberField } from '@/components/ui/number-field';
import { toPersianDigits } from '@/lib/jalali';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { getQuoteRateInRials, numberValue, type MarketQuote } from '../utils/document-helpers';
import AmountRoundingModal from './AmountRoundingModal';

type CurrencyTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  currencyUnits: string[];
  selectedCurrency?: string;
  getQuoteRate?: (currencyCode: string) => number;
  onRefreshQuotes?: (forceSync?: boolean) => Promise<MarketQuote[] | null>;
  isSyncingQuotes?: boolean;
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  updateCurrencyValue: (
    field: 'currencyQuantity' | 'currencyUnitPrice' | 'currencyTotalAmount',
    value: string,
  ) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
};

export default function CurrencyTab({
  nature,
  draftLine,
  setDraftLine,
  currencyUnits,
  selectedCurrency = '',
  getQuoteRate,
  onRefreshQuotes,
  isSyncingQuotes = false,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  updateCurrencyValue,
  handleKeyDownEnter,
  draftReady,
}: CurrencyTabProps) {
  // Rounding modal state
  const [isRoundingModalOpen, setIsRoundingModalOpen] = useState(false);
  const [roundingDigits, setRoundingDigits] = useState(3);
  const [roundingMode, setRoundingMode] = useState<'round' | 'ceil' | 'floor'>('round');
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [autoApplyRounding, setAutoApplyRounding] = useState(false);

  const exactCalculatedAmount = useMemo(() => {
    const qty = numberValue(draftLine.details.currencyQuantity);
    const price = numberValue(draftLine.details.currencyUnitPrice);
    return qty > 0 && price > 0 ? Math.round(qty * price) : 0;
  }, [draftLine.details.currencyQuantity, draftLine.details.currencyUnitPrice]);

  const handleApplyRounding = (
    roundedAmount: number,
    digits: number,
    mode: 'round' | 'ceil' | 'floor',
    autoApply: boolean,
    enabled = true,
  ) => {
    setRoundingDigits(digits);
    setRoundingMode(mode);
    setAutoApplyRounding(autoApply);
    setRoundingEnabled(enabled);

    const diff = exactCalculatedAmount > 0 ? roundedAmount - exactCalculatedAmount : 0;
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        currencyTotalAmount: String(roundedAmount),
        roundingDifference: diff,
        exactCalculatedAmount,
        isAmountRounded: diff !== 0 && enabled,
        roundingDigits: digits,
        roundingMode: mode,
      },
    }));
  };

  const handleDisableRounding = () => {
    setRoundingEnabled(false);
    setAutoApplyRounding(false);
    const targetAmount = exactCalculatedAmount > 0 ? exactCalculatedAmount : numberValue(draftLine.details.currencyTotalAmount);
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        currencyTotalAmount: targetAmount > 0 ? String(targetAmount) : current.details.currencyTotalAmount,
        roundingDifference: 0,
        isAmountRounded: false,
      },
    }));
  };
  // Ensure the traded currency cannot be identical to the top document currency and excludes IRR and IRT
  const selectableUnits = useMemo(() => {
    const normDoc = (selectedCurrency || '').trim().toUpperCase();
    const filtered = currencyUnits.filter((u) => {
      const norm = u.trim().toUpperCase();
      return norm !== normDoc && norm !== 'IRR' && norm !== 'IRT';
    });
    if (filtered.length > 0) return filtered;
    return ['USD', 'EUR', 'AED', 'GBP'].filter((u) => u !== normDoc);
  }, [currencyUnits, selectedCurrency]);

  const isDuplicateCurrency = Boolean(
    selectedCurrency &&
    draftLine.details.currencyUnit &&
    draftLine.details.currencyUnit.trim().toUpperCase() === selectedCurrency.trim().toUpperCase(),
  );

  const isDomesticCurrency = Boolean(
    draftLine.details.currencyUnit &&
    ['IRR', 'IRT'].includes(draftLine.details.currencyUnit.trim().toUpperCase()),
  );

  const currentQuoteRate = useMemo(() => {
    if (!getQuoteRate || !draftLine.details.currencyUnit || isDomesticCurrency) return 0;
    return getQuoteRate(draftLine.details.currencyUnit);
  }, [getQuoteRate, draftLine.details.currencyUnit, isDomesticCurrency]);

  useEffect(() => {
    const normDoc = (selectedCurrency || '').trim().toUpperCase();
    const currentUnit = (draftLine.details.currencyUnit || '').trim().toUpperCase();
    const isSameAsDoc = Boolean(currentUnit && normDoc && currentUnit === normDoc);
    const isDomestic = currentUnit === 'IRR' || currentUnit === 'IRT';

    if (!currentUnit || isSameAsDoc || isDomestic) {
      const fallbackUnit = selectableUnits[0] || (normDoc === 'USD' ? 'EUR' : 'USD');
      updateDraftDetail('currencyUnit', fallbackUnit);
      updateDraftDetail('settlementCurrencyUnit', selectedCurrency || 'IRR');
      if (getQuoteRate) {
        const rate = getQuoteRate(fallbackUnit);
        if (rate > 0) {
          updateCurrencyValue('currencyUnitPrice', String(rate));
        }
      }
    } else if (
      getQuoteRate &&
      (!draftLine.details.currencyUnitPrice || draftLine.details.currencyUnitPrice === '0')
    ) {
      const rate = getQuoteRate(currentUnit);
      if (rate > 0) {
        updateCurrencyValue('currencyUnitPrice', String(rate));
      }
    }
  }, [
    draftLine.details.currencyUnit,
    draftLine.details.currencyUnitPrice,
    selectableUnits,
    selectedCurrency,
    getQuoteRate,
    updateDraftDetail,
    updateCurrencyValue,
  ]);

  const handleUnitChange = (nextUnit: string) => {
    updateDraftDetail('currencyUnit', nextUnit);
    updateDraftDetail('settlementCurrencyUnit', selectedCurrency || 'IRR');
    if (getQuoteRate) {
      const rate = getQuoteRate(nextUnit);
      if (rate > 0) {
        updateCurrencyValue('currencyUnitPrice', String(rate));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div>
          <h3 className="text-xs font-bold">{nature === 'received' ? 'خرید ارز' : 'فروش ارز'}</h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'خرید ارز' : 'فروش ارز'}
        </span>
      </div>

      {isDuplicateCurrency && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800">
          <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            واحد ارز معامله نمی‌تواند با نوع ارز سند (<strong>{selectedCurrency}</strong>) یکسان باشد. لطفاً ارز متفاوتی برای معامله انتخاب کنید.
          </span>
        </div>
      )}

      {isDomesticCurrency && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
          <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            معامله ارزی تنها برای ارزهای خارجی امکان‌پذیر است. لطفاً ارز خارجی (مانند دلار، یورو یا درهم) را انتخاب کنید.
          </span>
        </div>
      )}

      <div className="document-special-grid raw-gold-fields">
        <Field label="واحد ارز">
          <select
            value={draftLine.details.currencyUnit || selectableUnits[0] || 'USD'}
            onChange={(event) => handleUnitChange(event.target.value)}
          >
            {selectableUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </Field>
        <Field label="تعداد">
          <NumberField
            formatThousands
            min={0}
            step={1}
            value={draftLine.details.currencyQuantity !== '' ? Number(draftLine.details.currencyQuantity) : undefined}
            onChange={(val) => updateCurrencyValue('currencyQuantity', val !== undefined && !Number.isNaN(val) ? String(val) : '')}
            onKeyDown={handleKeyDownEnter}
            placeholder="۰"
            aria-label="تعداد ارز"
            selectOnClick
            className="w-full"
          />
        </Field>
        <div className="flex flex-col">
          <MoneyInputField
            label="قیمت هر واحد (ریال)"
            value={draftLine.details.currencyUnitPrice}
            onChange={(val) => updateCurrencyValue('currencyUnitPrice', val)}
            baseCurrency="IRR"
            onKeyDown={handleKeyDownEnter}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
            {currentQuoteRate > 0 ? (
              <span className="flex items-center gap-1.5">
                <Globe size={13} className="text-amber-500 shrink-0" />
                <span>نرخ مظنه API:</span>
                <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                  {toPersianDigits(currentQuoteRate.toLocaleString())}
                </strong>
                <span>ریال</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Globe size={13} className="text-slate-400 shrink-0" />
                <span>نرخ وب‌سرویس یافت نشد</span>
              </span>
            )}

            <div className="flex items-center gap-2">
              {currentQuoteRate > 0 && (
                <button
                  type="button"
                  onClick={() => updateCurrencyValue('currencyUnitPrice', String(currentQuoteRate))}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/60 font-semibold cursor-pointer transition-colors shadow-2xs text-[11px]"
                  title="درج خودکار نرخ مظنه بازار"
                >
                  <ArrowDownToLine size={12} className="shrink-0" />
                  <span>درج نرخ مظنه</span>
                </button>
              )}
              {onRefreshQuotes && (
                <button
                  type="button"
                  disabled={isSyncingQuotes}
                  onClick={async () => {
                    const updated = await onRefreshQuotes(true);
                    const unit = draftLine.details.currencyUnit || selectableUnits[0];
                    if (unit && updated) {
                      const newRate = getQuoteRateInRials(updated, unit);
                      if (newRate > 0) {
                        updateCurrencyValue('currencyUnitPrice', String(newRate));
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer transition-colors disabled:opacity-50 shadow-2xs text-[11px]"
                  title="فراخوانی و به‌روزرسانی آنلاین نرخ از وب‌سرویس API"
                >
                  <RefreshCw size={11} className={isSyncingQuotes ? 'animate-spin text-amber-500 shrink-0' : 'shrink-0 text-slate-500'} />
                  <span>{isSyncingQuotes ? 'در حال فراخوانی...' : 'فراخوانی از API'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <MoneyInputField
            label={
              <span className="flex items-center gap-1.5">
                <span>مبلغ کل (ریال)</span>
                {draftLine.details.isAmountRounded ? (
                  <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    رند شده ({toPersianDigits(roundingDigits)} رقم)
                  </span>
                ) : null}
              </span>
            }
            value={draftLine.details.currencyTotalAmount}
            onChange={(val) => updateCurrencyValue('currencyTotalAmount', val)}
            baseCurrency="IRR"
            onKeyDown={handleKeyDownEnter}
            action={
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsRoundingModalOpen(true);
                }}
                className={`flex items-center justify-center rounded-lg p-1.5 transition-all ${
                  draftLine.details.isAmountRounded
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-800 shadow-2xs'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                }`}
                title="تنظیمات رند کردن مبلغ کل"
                aria-label="تنظیمات رند کردن مبلغ کل"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            }
          />
          <AmountRoundingModal
            isOpen={isRoundingModalOpen}
            onClose={() => setIsRoundingModalOpen(false)}
            currentAmount={numberValue(draftLine.details.currencyTotalAmount)}
            exactCalculatedAmount={exactCalculatedAmount}
            baseCurrency="IRR"
            initialDigits={roundingDigits}
            initialMode={roundingMode}
            initialAutoApply={autoApplyRounding}
            initialEnabled={roundingEnabled}
            onApply={handleApplyRounding}
            onReset={handleDisableRounding}
            onDisable={handleDisableRounding}
          />
        </div>
        <div className="col-span-1 md:col-span-2 flex flex-col justify-end">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-2 min-h-[42px] transition-colors">
            {/* Right label & status badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                روش تسویه:
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-100/90 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                    : 'bg-emerald-100/90 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                }`}
              >
                {draftLine.details.unsettledTrade ? 'نسیه / دفتری' : 'نقدی / صندوق'}
              </span>
            </div>

            {/* Left switch control with info icons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {/* Option 1: تسویه آنی */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraftLine((current) => ({
                      ...current,
                      settlementMethod: 'cash',
                      details: { ...current.details, unsettledTrade: false },
                    }));
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    !draftLine.details.unsettledTrade
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  تسویه آنی
                </button>
                <span
                  title="دریافت یا پرداخت ارز در لحظه از موجودی صندوق ارزی انجام می‌شود."
                  className="cursor-help text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-full transition-colors"
                >
                  <Info size={13} />
                </span>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(draftLine.details.unsettledTrade)}
                aria-label="تغییر بین تسویه آنی و بدون تسویه"
                onClick={() => {
                  const nextUnsettled = !draftLine.details.unsettledTrade;
                  setDraftLine((current) => ({
                    ...current,
                    settlementMethod: nextUnsettled ? 'unsettled' : 'cash',
                    details: { ...current.details, unsettledTrade: nextUnsettled },
                  }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-500 focus-visible:ring-amber-400'
                    : 'bg-emerald-500 focus-visible:ring-emerald-400'
                }`}
                title={draftLine.details.unsettledTrade ? 'تغییر به تسویه آنی' : 'تغییر به بدون تسویه'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    draftLine.details.unsettledTrade ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Option 2: بدون تسویه */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraftLine((current) => ({
                      ...current,
                      settlementMethod: 'unsettled',
                      details: { ...current.details, unsettledTrade: true },
                    }));
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    draftLine.details.unsettledTrade
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  بدون تسویه
                </button>
                <span
                  title="معامله حسابی ثبت شده و بدهی یا طلب مالی و ارزی روی حساب طرف‌حساب باقی می‌ماند."
                  className="cursor-help text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-full transition-colors"
                >
                  <Info size={13} />
                </span>
              </div>
            </div>
          </div>
        </div>
        <Field label="توضیحات" wide>
          <textarea
            value={draftLine.description}
            onChange={(event) => setDraftLine((current) => ({
              ...current,
              description: event.target.value,
            }))}
            onKeyDown={handleKeyDownEnter}
            placeholder="توضیحات معامله ارزی..."
          />
        </Field>
      </div>

      {draftReady && !isDuplicateCurrency && !isDomesticCurrency && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} />
            {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
