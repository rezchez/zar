'use client';

import { AlertCircle, ListPlus } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { NumberField } from '@/components/ui/number-field';
import { toPersianDigits } from '@/lib/jalali';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type CurrencyTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  currencyUnits: string[];
  selectedCurrency?: string;
  getQuoteRate?: (currencyCode: string) => number;
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
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  updateCurrencyValue,
  handleKeyDownEnter,
  draftReady,
}: CurrencyTabProps) {
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
          {currentQuoteRate > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
              <span>
                نرخ مظنه: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{toPersianDigits(currentQuoteRate.toLocaleString())}</strong> ریال
              </span>
              <button
                type="button"
                onClick={() => updateCurrencyValue('currencyUnitPrice', String(currentQuoteRate))}
                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium hover:underline cursor-pointer transition-colors"
                title="درج خودکار نرخ مظنه بازار"
              >
                درج نرخ مظنه
              </button>
            </div>
          )}
        </div>
        <MoneyInputField
          label="مبلغ کل (ریال)"
          value={draftLine.details.currencyTotalAmount}
          onChange={(val) => updateCurrencyValue('currencyTotalAmount', val)}
          baseCurrency="IRR"
          onKeyDown={handleKeyDownEnter}
        />
        <div className="col-span-1 md:col-span-2 flex flex-col justify-end">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
            <span>روش تسویه ارزی</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                draftLine.details.unsettledTrade
                  ? 'bg-amber-100/90 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-emerald-100/90 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
              }`}
            >
              {draftLine.details.unsettledTrade ? 'نسیه / دفتری' : 'نقدی / صندوق'}
            </span>
          </span>

          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200 ${
              draftLine.details.unsettledTrade
                ? 'border-amber-400 bg-amber-50/90 text-amber-950 dark:border-amber-600/70 dark:bg-amber-950/40 dark:text-amber-100 shadow-xs'
                : 'border-emerald-400 bg-emerald-50/90 text-emerald-950 dark:border-emerald-600/70 dark:bg-emerald-950/40 dark:text-emerald-100 shadow-xs'
            }`}
          >
            {/* Description */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700'
                    : 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700'
                }`}
              />
              <div className="flex flex-col text-right">
                <span className="text-xs font-extrabold">
                  {draftLine.details.unsettledTrade ? 'بدون تسویه (نسیه)' : 'تسویه آنی (نقد / صندوق)'}
                </span>
                <span className="text-[11px] font-normal opacity-85 leading-normal">
                  {draftLine.details.unsettledTrade
                    ? 'معامله حسابی ثبت شده و بدهی یا طلب مالی و ارزی روی حساب طرف‌حساب باقی می‌ماند.'
                    : 'دریافت یا پرداخت ارز در لحظه از موجودی صندوق ارزی انجام می‌شود.'}
                </span>
              </div>
            </div>

            {/* Switch Control with Two Labels and Toggle */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
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
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  draftLine.details.unsettledTrade
                    ? 'bg-amber-500 focus-visible:ring-amber-400'
                    : 'bg-emerald-500 focus-visible:ring-emerald-400'
                }`}
                title={draftLine.details.unsettledTrade ? 'تغییر به تسویه آنی' : 'تغییر به بدون تسویه'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    draftLine.details.unsettledTrade ? '-translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>

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
