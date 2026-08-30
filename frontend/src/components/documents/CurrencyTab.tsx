'use client';

import { ListPlus } from 'lucide-react';
import type React from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
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
            value={draftLine.details.currencyUnit}
            onChange={(event) => updateDraftDetail('currencyUnit', event.target.value)}
          >
            {currencyUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </Field>
        <Field label="تعداد">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draftLine.details.currencyQuantity}
            onChange={(event) => updateCurrencyValue('currencyQuantity', event.target.value)}
            onKeyDown={handleKeyDownEnter}
            placeholder="۰"
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
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          <input
            type="checkbox"
            checked={draftLine.details.unsettledTrade}
            onChange={(event) => setDraftLine((current) => ({
              ...current,
              settlementMethod: event.target.checked ? 'unsettled' : 'cash',
              details: { ...current.details, unsettledTrade: event.target.checked },
            }))}
          />
          <span>
            بدون تسویه
            <small className="mt-1 block text-xs font-normal opacity-80">
              مبلغ نقدی اکنون ثبت نمی‌شود و بدهی/بستانکاری ارز در حساب طرف‌حساب می‌ماند.
            </small>
          </span>
        </label>
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

      {draftReady ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
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
