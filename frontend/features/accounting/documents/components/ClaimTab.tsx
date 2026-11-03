'use client';

import { ArrowLeftRight, HandCoins, ListPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useToastManager } from '@/components/ui/toast';

import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { parseLocalizedAmount } from '@/lib/money';
import { getClaimDocumentTypeLabel, sanitizeLineDetailsForTab } from '../utils/document-helpers';
import HawalaCheckboxField from './HawalaCheckboxField';

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
  selectedCurrency?: string;
  currencyLabel?: string;
  currencySymbol?: string;
  metalType?: 'gold' | 'silver' | 'platinum';
  isHawala?: boolean;
  setIsHawala?: (val: boolean) => void;
  onRequestHawala?: (line: DocumentLine) => void;
  selectedCustomer?: Customer | null;
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
  selectedCurrency,
  currencyLabel,
  currencySymbol,
  metalType = 'gold',
  isHawala,
  setIsHawala,
  onRequestHawala,
  selectedCustomer,
}: ClaimTabProps) {
  const isPaid = nature === 'paid';
  const effectiveCurrency = (
    editingLineId && draftLine.details?.currencyUnit
      ? draftLine.details.currencyUnit
      : selectedCurrency || draftLine.details?.currencyUnit || baseCurrency
  ).trim().toUpperCase();

  const isLocalCurrency = effectiveCurrency === 'IRR' || effectiveCurrency === 'IRT';
  const currencySuffix = isLocalCurrency
    ? (effectiveCurrency === 'IRT' ? 'تومان' : 'ریال')
    : [currencyLabel || effectiveCurrency, currencySymbol].filter(Boolean).join(' ');

  const effectiveMetalType = (
    editingLineId && draftLine.details?.metalType
      ? draftLine.details.metalType
      : draftLine.details?.metalType || metalType || 'gold'
  ) as 'gold' | 'silver' | 'platinum';
  const metalLabel = effectiveMetalType === 'silver' ? 'نقره' : effectiveMetalType === 'platinum' ? 'پلاتین' : 'طلا';

  const [internalIsHawala, setInternalIsHawala] = useState(false);
  const isHawalaEffective = isHawala !== undefined ? isHawala : internalIsHawala;
  const setIsHawalaEffective = setIsHawala || setInternalIsHawala;
  const toast = useToastManager();

  const syncedClaimFieldsKey = JSON.stringify([
    baseCurrency,
    effectiveMetalType,
    draftLine.details?.baseCurrency,
    draftLine.details?.metalType,
  ]);

  useEffect(() => {
    // When editing an existing line, do not overwrite loaded currency or metalType
    if (editingLineId) return;

    if (draftLine.details?.currencyUnit !== effectiveCurrency) {
      updateDraftDetail('currencyUnit', effectiveCurrency);
    }
    if (draftLine.details?.baseCurrency !== baseCurrency) {
      updateDraftDetail('baseCurrency', baseCurrency);
    }
    if (draftLine.details?.metalType !== effectiveMetalType) {
      updateDraftDetail('metalType', effectiveMetalType);
    }
  }, [editingLineId, effectiveCurrency, effectiveMetalType, draftLine.details?.currencyUnit, syncedClaimFieldsKey, updateDraftDetail]);

  const handleCommitClaimLine = () => {
    const rawFinancial = parseLocalizedAmount(draftLine.details?.claimFinancial || draftLine.details?.totalAmount || '0');
    const rawWeight = parseLocalizedAmount(draftLine.details?.claimWeight || draftLine.details?.rawWeight || '0');

    if ((!rawFinancial || rawFinancial <= 0) && (!rawWeight || rawWeight <= 0)) {
      toast.error('لطفاً مبلغ یا وزن طلب/بدهی را وارد کنید.');
      return;
    }

    const claimDocTypeLabel = getClaimDocumentTypeLabel(nature, rawFinancial, rawWeight);

    if (isHawalaEffective) {
      if (!selectedCustomer) {
        toast.warning('ابتدا طرف‌حساب سند را از فهرست انتخاب کنید.');
        return;
      }

      const fullLine: DocumentLine = {
        ...draftLine,
        id: draftLine.id || `claim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        documentTab: 'claim',
        sourceTab: 'claim',
        documentNature: nature,
        documentTypeLabel: claimDocTypeLabel,
        converted750: 0,
        details: sanitizeLineDetailsForTab('claim', {
          ...draftLine.details,
          claimFinancial: rawFinancial > 0 ? String(rawFinancial) : '',
          claimWeight: rawWeight > 0 ? String(rawWeight) : '',
          totalAmount: rawFinancial > 0 ? String(rawFinancial) : '',
          rawWeight: rawWeight > 0 ? String(rawWeight) : '',
          currencyUnit: effectiveCurrency,
          baseCurrency,
          metalType: effectiveMetalType,
          isHawala: true,
          documentTypeLabel: claimDocTypeLabel,
        }, baseCurrency),
      };

      if (onRequestHawala) {
        onRequestHawala(fullLine);
        return;
      }
    }

    commitDraftLine();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitClaimLine();
      return;
    }
    handleKeyDownEnter(e);
  };

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
            label={isPaid ? `طلب مالی ما (${currencySuffix})` : `بدهی مالی ما (${currencySuffix})`}
            value={draftLine.details.claimFinancial ?? draftLine.details.totalAmount ?? ''}
            onChange={(val) => {
              updateDraftDetail('claimFinancial', val);
              updateDraftDetail('totalAmount', val);
              updateDraftDetail('currencyUnit', effectiveCurrency);
              updateDraftDetail('baseCurrency', baseCurrency);
            }}
            baseCurrency={baseCurrency}
            currencySuffix={currencySuffix}
            onKeyDown={onKeyDown}
            showWords
          />

          {/* Field 2: Weight Claim / Debt */}
          <Field label={isPaid ? `طلب وزنی ما (${metalLabel}، گرم)` : `بدهی وزنی ما (${metalLabel}، گرم)`}>
            <input
              type="text"
              inputMode="decimal"
              value={draftLine.details.claimWeight ?? draftLine.details.rawWeight ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateDraftDetail('claimWeight', val);
                updateDraftDetail('rawWeight', val);
                updateDraftDetail('metalType', effectiveMetalType);
              }}
              onKeyDown={onKeyDown}
              placeholder="۰"
            />
          </Field>

          {/* Field 3: Babat / Purpose */}
          <Field label="بابت">
            <input
              type="text"
              value={draftLine.details.claimPurpose ?? ''}
              onChange={(e) => updateDraftDetail('claimPurpose', e.target.value)}
              onKeyDown={onKeyDown}
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
              onKeyDown={onKeyDown}
              placeholder="توضیحات تکمیلی..."
            />
          </Field>
        </div>

        {/* Hawala Checkbox (حواله طرف‌به‌طرف) */}
        <HawalaCheckboxField
          checked={isHawalaEffective}
          onChange={setIsHawalaEffective}
        />
      </div>

      {/* Sticky Commit Line Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm cursor-pointer"
            onClick={handleCommitClaimLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : isHawalaEffective ? 'ثبت ردیف و انتخاب طرف‌حساب حواله' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
