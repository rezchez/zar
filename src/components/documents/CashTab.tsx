'use client';

import { Wallet } from 'lucide-react';
import type React from 'react';

import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

type CashTabProps = {
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines: DocumentLine[];
};

export default function CashTab({
  draftLine,
  setDraftLine,
  committedLines,
}: CashTabProps) {
  return (
    <div className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex items-center gap-3">
        <Wallet className="text-emerald-600" size={20} />
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">تسویه معاملات بدون تسویه</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">ارز و مقدار معامله باز را برای تسویه بعدی انتخاب کنید.</p>
        </div>
      </div>
      <select
        className="text-xs h-9"
        value={draftLine.details.settlesTradeId}
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
        <option value="">انتخاب معامله باز...</option>
        {committedLines.filter((line) => line.documentTab === 'currency' && line.details.unsettledTrade).map((line) => (
          <option key={line.id} value={line.id}>
            {line.details.currencyQuantity || '۰'} {line.details.currencyUnit} · {line.details.currencyTotalAmount || '۰'} ریال
          </option>
        ))}
      </select>
    </div>
  );
}
