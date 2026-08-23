'use client';

import { ListPlus, Wallet } from 'lucide-react';
import type React from 'react';

import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type CashTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
};

export default function CashTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
}: CashTabProps) {
  const isReceived = nature === 'received';
  const titleText = isReceived ? 'ورود وجه نقد' : 'خروج وجه نقد';

  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div className="flex items-center gap-2">
          <Wallet className={isReceived ? 'text-emerald-600' : 'text-rose-600'} size={20} />
          <h3 className="text-xs font-bold">{titleText}</h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'دریافتی' : 'پرداختی'}
        </span>
      </div>

      <div className="document-dynamic-fields">
        <div className="document-special-grid">
          {/* Field 1: Quantity / Amount (تعداد) */}
          <Field label="تعداد / مبلغ">
            <input
              type="text"
              inputMode="numeric"
              value={draftLine.details.totalAmount || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (updateDraftDetail) {
                  updateDraftDetail('totalAmount', val);
                } else {
                  setDraftLine((current) => ({
                    ...current,
                    details: { ...current.details, totalAmount: val },
                  }));
                }
              }}
              onKeyDown={handleKeyDownEnter}
              placeholder="۰"
            />
          </Field>

          {/* Field 2: Description (شرح) */}
          <Field label="شرح" wide>
            <textarea
              value={draftLine.description || ''}
              onChange={(e) =>
                setDraftLine((current) => ({ ...current, description: e.target.value }))
              }
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات بابت وجه نقد..."
            />
          </Field>
        </div>

        {/* Optional Trade Settlement Selector */}
        {committedLines.some((line) => line.documentTab === 'currency' && line.details.unsettledTrade) && (
          <div className="mt-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              تسویه معامله بدون تسویه (اختیاری)
            </label>
            <select
              className="text-xs h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              value={draftLine.details.settlesTradeId || ''}
              onChange={(event) => {
                const trade = committedLines.find((line) => line.id === event.target.value);
                setDraftLine((current) => ({
                  ...current,
                  details: {
                    ...current.details,
                    settlesTradeId: event.target.value,
                    settlementCurrencyUnit: trade?.details.currencyUnit ?? current.details.settlementCurrencyUnit,
                    settlementQuantity: trade?.details.currencyQuantity ?? current.details.settlementQuantity,
                  },
                }));
              }}
            >
              <option value="">انتخاب معامله باز برای تسویه...</option>
              {committedLines.filter((line) => line.documentTab === 'currency' && line.details.unsettledTrade).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.details.currencyQuantity || '۰'} {line.details.currencyUnit} · {line.details.currencyTotalAmount || '۰'} ریال
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sticky Commit Line Button */}
      {commitDraftLine && draftReady ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button type="button" className="document-commit-line-button shadow-lg max-w-sm" onClick={commitDraftLine}>
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
