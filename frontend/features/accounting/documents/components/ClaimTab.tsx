'use client';

import { HandCoins, ListPlus } from 'lucide-react';
import type React from 'react';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type ClaimTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  baseCurrency?: 'IRR' | 'IRT';
};

export default function ClaimTab({
  nature,
  draftLine,
  setDraftLine,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseCurrency = 'IRR',
}: ClaimTabProps) {
  const isPaid = nature === 'paid';

  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div className="flex items-center gap-2">
          <HandCoins className="text-amber-600" size={18} />
          <h3 className="text-xs font-bold">
            {isPaid ? 'ثبت طلب ما' : 'ثبت بدهی ما'}
          </h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'دریافتی' : 'پرداختی'}
        </span>
      </div>

      <div className="document-dynamic-fields">
        <div className="document-special-grid">
          {/* Field 1: Financial Claim / Debt */}
          <MoneyInputField
            label={isPaid ? 'طلب مالی ما' : 'بدهی مالی ما'}
            value={draftLine.details.claimFinancial ?? draftLine.details.totalAmount ?? ''}
            onChange={(val) => {
              updateDraftDetail('claimFinancial', val);
              updateDraftDetail('totalAmount', val);
            }}
            baseCurrency={baseCurrency}
            onKeyDown={handleKeyDownEnter}
            showWords
          />

          {/* Field 2: Weight Claim / Debt */}
          <Field label={isPaid ? 'طلب وزنی ما (گرم)' : 'بدهی وزنی ما (گرم)'}>
            <input
              type="text"
              inputMode="decimal"
              value={draftLine.details.claimWeight ?? draftLine.details.rawWeight ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateDraftDetail('claimWeight', val);
                updateDraftDetail('rawWeight', val);
              }}
              onKeyDown={handleKeyDownEnter}
              placeholder="۰"
            />
          </Field>

          {/* Field 3: Babat / Purpose */}
          <Field label="بابت">
            <input
              type="text"
              value={draftLine.details.claimPurpose ?? ''}
              onChange={(e) => updateDraftDetail('claimPurpose', e.target.value)}
              onKeyDown={handleKeyDownEnter}
              placeholder="بابت تسویه حساب، مانده قبل و..."
            />
          </Field>

          {/* Field 4: Description */}
          <Field label="شرح" wide>
            <textarea
              value={draftLine.description || ''}
              onChange={(e) =>
                setDraftLine((current) => ({ ...current, description: e.target.value }))
              }
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات تکمیلی..."
            />
          </Field>
        </div>
      </div>

      {/* Sticky Commit Line Button */}
      {draftReady ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button type="button" className="document-commit-line-button shadow-lg max-w-sm" onClick={commitDraftLine}>
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
