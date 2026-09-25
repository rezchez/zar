'use client';

import { ListPlus } from 'lucide-react';
import React, { useEffect } from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { NumberField } from '@/components/ui/number-field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type CurrencyTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  currencyUnits: string[];
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
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  updateCurrencyValue,
  handleKeyDownEnter,
  draftReady,
}: CurrencyTabProps) {
  useEffect(() => {
    if (!draftLine.details.currencyUnit) {
      const defaultUnit = currencyUnits[0] || 'USD';
      updateDraftDetail('currencyUnit', defaultUnit);
      updateDraftDetail('settlementCurrencyUnit', defaultUnit);
    }
  }, [draftLine.details.currencyUnit, currencyUnits, updateDraftDetail]);

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

      <div className="document-special-grid raw-gold-fields">
        <Field label="واحد ارز">
          <select
            value={draftLine.details.currencyUnit || currencyUnits[0] || 'USD'}
            onChange={(event) => {
              updateDraftDetail('currencyUnit', event.target.value);
              updateDraftDetail('settlementCurrencyUnit', event.target.value);
            }}
          >
            {currencyUnits.length === 0 ? (
              <option value="USD">USD</option>
            ) : currencyUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
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
        <MoneyInputField
          label="قیمت هر واحد (ریال)"
          value={draftLine.details.currencyUnitPrice}
          onChange={(val) => updateCurrencyValue('currencyUnitPrice', val)}
          baseCurrency="IRR"
          onKeyDown={handleKeyDownEnter}
        />
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

      {draftReady && !isLinesPinned ? (
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
