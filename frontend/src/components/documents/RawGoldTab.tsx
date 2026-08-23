'use client';

import { ListPlus } from 'lucide-react';
import type React from 'react';

import Field from '@/src/components/documents/Field';
import { RawMetalOperationTypeSelector } from '@/src/components/documents/DocumentOperationTypeSelector';

export type RawOperationKind = 'molten' | 'misc' | 'conditional' | 'question' | 'unsettled';

export type DetailState = {
  metalType: 'gold' | 'silver' | 'platinum';
  rawKind: RawOperationKind;
  rawWeight: string;
  purity: string;
  calculationMethod: 'weight' | 'money';
  metalPriceType: 'mesghal17' | 'gram18' | 'ounceUsd';
  metalPrice: string;
  totalAmount: string;
  labName: string;
  stampNumber: string;
  currencyUnit: string;
  currencyQuantity: string;
  currencyUnitPrice: string;
  currencyTotalAmount: string;
  unsettledTrade: boolean;
  currencyTradeId: string;
  settlementCurrencyUnit: string;
  settlementQuantity: string;
  settlesTradeId: string;
  inventorySourceId: string;
  claimFinancial?: string;
  claimWeight?: string;
  claimPurpose?: string;
};

export type DocumentLine = {
  id: string;
  documentNature: 'received' | 'paid';
  documentTab: 'raw-gold' | 'gold-sale' | 'currency' | 'cash';
  sourceTab?: string;
  documentSubType: string;
  documentTypeLabel?: string;
  converted750?: number;
  settlementMethod: 'weight' | 'cash' | 'unsettled';
  balanceSource: 'current';
  description: string;
  details: DetailState;
};

export type MeltedInventoryItem = {
  id: string;
  weight: number;
  remainingWeight: number;
  purity: number;
  stampNumber: string;
  customerName: string;
};

type RawGoldTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  weightPrecision: number;
  meltedInventory: MeltedInventoryItem[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  changeRawKind: (kind: RawOperationKind) => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  convertedTo750: (weight: string, purity: string) => number;
  faNumber: (value: number, fractionDigits?: number) => string;
  errors?: { labName?: string; stampNumber?: string };
  labInputRef?: React.RefObject<HTMLInputElement | null>;
  stampInputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function RawGoldTab({
  nature,
  draftLine,
  setDraftLine,
  weightPrecision,
  meltedInventory,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  changeRawKind,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  convertedTo750,
  faNumber,
  errors = {},
  labInputRef,
  stampInputRef,
}: RawGoldTabProps) {
  const isGold = draftLine.details.metalType === 'gold';
  const isMoltenOrConditional = draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional';
  const hasValidWeight = Boolean(Number(draftLine.details.rawWeight) > 0);
  const isRequired = isGold && isMoltenOrConditional && hasValidWeight;
  return (
    <div className="space-y-4">
      <div className="document-operation-title">
        <div>
          <h3 className="text-xs font-bold">نوع {nature === 'received' ? 'ورود' : 'خروج'} را انتخاب کنید</h3>
        </div>
        <span className={`document-nature-badge ${nature}`}>
          {nature === 'received' ? 'دریافتی' : 'پرداختی'}
        </span>
      </div>
      <RawMetalOperationTypeSelector
        nature={nature}
        value={draftLine.details.rawKind}
        onChange={changeRawKind}
      />
      <div className="document-dynamic-fields">
        <div className="document-special-grid raw-gold-fields">
          {nature === 'paid' && draftLine.details.rawKind === 'molten' ? (
            <Field label="انتخاب موجودی آبشده" wide>
              <select
                value={draftLine.details.inventorySourceId}
                onChange={(event) => {
                  const source = meltedInventory.find((item) => item.id === event.target.value);
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      inventorySourceId: event.target.value,
                      rawWeight: source ? String(source.remainingWeight) : current.details.rawWeight,
                      purity: source ? String(source.purity || 750) : current.details.purity,
                      stampNumber: source?.stampNumber ?? current.details.stampNumber,
                    },
                  }));
                }}
              >
                <option value="">انتخاب از موجودی فعال...</option>
                {meltedInventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.stampNumber || 'بدون انگ'} · {item.customerName} · {item.remainingWeight.toFixed(3)} گرم · عیار {item.purity}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="وزن (گرم)">
            <input
              type="number"
              min="0"
              step={10 ** -weightPrecision}
              value={draftLine.details.rawWeight}
              onChange={(event) => updateDraftDetail('rawWeight', event.target.value)}
              onKeyDown={handleKeyDownEnter}
              placeholder="۰"
            />
          </Field>
          <Field label="عیار">
            <input
              type="number"
              min="1"
              max="1000"
              step="0.1"
              value={draftLine.details.purity}
              onChange={(event) => updateDraftDetail('purity', event.target.value)}
              onKeyDown={handleKeyDownEnter}
              aria-label="عیار ردیف سند"
              placeholder="۷۵۰"
              title="عیار اول از تنظیمات برنامه خوانده می‌شود و قابل ویرایش است."
            />
          </Field>
          <Field label="تبدیل‌شده به ۷۵۰">
            <input
              readOnly
              className="computed-field"
              value={faNumber(convertedTo750(draftLine.details.rawWeight, draftLine.details.purity), weightPrecision)}
            />
          </Field>
          {draftLine.details.rawKind !== 'misc' ? (
            <>
              <Field label="نام آزمایشگاه ری‌گیری" required={isRequired} error={errors.labName}>
                <input
                  ref={labInputRef}
                  value={draftLine.details.labName}
                  onChange={(event) => updateDraftDetail('labName', event.target.value)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="نام آزمایشگاه"
                />
              </Field>
              <Field label="شماره پاکت / انگ" required={isRequired} error={errors.stampNumber}>
                <input
                  ref={stampInputRef}
                  value={draftLine.details.stampNumber}
                  onChange={(event) => updateDraftDetail('stampNumber', event.target.value)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="شماره پاکت یا انگ"
                />
              </Field>
            </>
          ) : null}
          <Field label="توضیحات" wide>
            <textarea
              value={draftLine.description}
              onChange={(event) => setDraftLine((current) => ({ ...current, description: event.target.value }))}
              onKeyDown={handleKeyDownEnter}
              placeholder="توضیحات تکمیلی..."
            />
          </Field>
        </div>
      </div>
      {/* Sticky Floating Submit Row Button */}
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
