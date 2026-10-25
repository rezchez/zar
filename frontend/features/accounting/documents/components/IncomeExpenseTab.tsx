'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  CheckCircle2,
  FolderTree,
  ListPlus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import AccountTreeSelector from '@/features/accounting/chart-of-accounts/components/AccountTreeSelector';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import type { ChartOfAccountRecord } from '@/lib/chart-of-accounts';
import { convertRialToToman, convertTomanToRial } from '@/lib/money';
import { faNumber, numberValue, toPersianDigits } from '../utils/document-helpers';

type IncomeExpenseTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  draftReady: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCustomer?: Customer | null;
  onNatureChange?: (nextNature: 'received' | 'paid') => void;
};

export default function IncomeExpenseTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseCurrency = 'IRR',
  selectedCustomer,
  onNatureChange,
}: IncomeExpenseTabProps) {
  const isToman = baseCurrency === 'IRT';
  const currencySuffix = isToman ? 'تومان' : 'ریال';

  const isIncome = nature === 'received';
  const filterType = isIncome ? 'revenue' : 'expense';

  // Current values read directly from draftLine.details
  const selectedAccountId = draftLine?.details?.incomeExpenseAccountId || null;
  const totalAmountStr = draftLine?.details?.totalAmount || '';
  const description = draftLine?.description || '';

  // Synchronize currency settings in draftLine details
  useEffect(() => {
    if (draftLine.details?.currencyUnit !== baseCurrency) {
      updateDraftDetail('currencyUnit', baseCurrency);
    }
    if (draftLine.details?.baseCurrency !== baseCurrency) {
      updateDraftDetail('baseCurrency', baseCurrency);
    }
  }, [baseCurrency, draftLine.details?.currencyUnit, draftLine.details?.baseCurrency, updateDraftDetail]);

  const handleAccountSelect = (accountId: string | null, account?: ChartOfAccountRecord) => {
    updateDraftDetail('incomeExpenseAccountId', accountId || '');
    updateDraftDetail('incomeExpenseAccountCode', account?.code || '');
    updateDraftDetail('incomeExpenseAccountName', account?.name || '');
    updateDraftDetail('incomeExpenseAccountPath', account?.path || '');

    setDraftLine((prev) => ({
      ...prev,
      documentNature: nature,
      documentTab: 'income-expense',
      sourceTab: 'income-expense',
      documentSubType: isIncome ? 'income' : 'expense',
      documentTypeLabel: isIncome ? 'درآمد' : 'هزینه',
      details: {
        ...prev.details,
        incomeExpenseAccountId: accountId || '',
        incomeExpenseAccountCode: account?.code || '',
        incomeExpenseAccountName: account?.name || '',
        incomeExpenseAccountPath: account?.path || '',
      },
    }));
  };

  const handleAmountChange = (amountStr: string) => {
    updateDraftDetail('totalAmount', amountStr);
  };

  const amountNum = numberValue(totalAmountStr);

  const isFormValid = Boolean(selectedAccountId && amountNum > 0);

  return (
    <div className="space-y-4">
      {/* Title & Section Header */}
      <div className="document-operation-title flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              isIncome
                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
            }`}
          >
            {isIncome ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isIncome ? 'ثبت درآمد (درختواره کدینگ)' : 'ثبت هزینه (درختواره کدینگ)'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isIncome
                ? 'انتخاب سرفصل درآمدی از درختواره کدینگ حساب‌ها و ثبت مبلغ مربوطه'
                : 'انتخاب سرفصل هزینه‌ای از درختواره کدینگ حساب‌ها و ثبت مبلغ مربوطه'}
            </p>
          </div>
        </div>

        {/* Nature Badge / Switcher */}
        <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border/50">
          <button
            type="button"
            onClick={() => onNatureChange?.('received')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isIncome
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp size={13} />
            ثبت درآمد
          </button>
          <button
            type="button"
            onClick={() => onNatureChange?.('paid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isIncome
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingDown size={13} />
            ثبت هزینه
          </button>
        </div>
      </div>

      {/* Account Tree Selector Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <FolderTree size={16} className="text-amber-500" />
          <span>سرفصل حسابداری مربوطه از درختواره (کدینگ)</span>
        </div>

        <AccountTreeSelector
          value={selectedAccountId}
          onChange={handleAccountSelect}
          filterType={filterType}
          label=""
          placeholder={
            isIncome
              ? 'برای مشاهده و انتخاب، از درختواره سرفصل‌های درآمد (۴۰۰۰) کلیک کنید...'
              : 'برای مشاهده و انتخاب، از درختواره سرفصل‌های هزینه (۶۰۰۰) کلیک کنید...'
          }
          required
        />

        {draftLine.details?.incomeExpenseAccountName ? (
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/20">
            <span className="font-medium">سرفصل انتخاب‌شده:</span>
            <span className="font-bold font-mono">
              {draftLine.details.incomeExpenseAccountCode} - {draftLine.details.incomeExpenseAccountName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Inputs Section */}
      <div className="document-dynamic-fields space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Field: Total Amount */}
          <MoneyInputField
            label={`مبلغ ${isIncome ? 'درآمد' : 'هزینه'} (${currencySuffix})`}
            value={totalAmountStr}
            onChange={handleAmountChange}
            baseCurrency={baseCurrency}
            currencySuffix={currencySuffix}
            onKeyDown={handleKeyDownEnter}
            showWords
          />

          {/* Field: Description */}
          <Field label="شرح ردیف / بابت">
            <input
              type="text"
              value={description}
              onChange={(e) =>
                setDraftLine((current) => ({ ...current, description: e.target.value }))
              }
              onKeyDown={handleKeyDownEnter}
              placeholder={
                isIncome
                  ? 'بابت خدمات ارائه شده، فروش متفرقه و...'
                  : 'بابت هزینه پذیرایی، ایاب‌واذهاب، خریدهای جاری و...'
              }
            />
          </Field>
        </div>
      </div>

      {/* Accounting Entry Preview Card */}
      {isFormValid ? (
        <div
          className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 transition-all ${
            isIncome
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200'
              : 'border-rose-500/20 bg-rose-500/5 text-rose-950 dark:text-rose-200'
          }`}
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold">
              {isIncome ? 'اثر مالی ثبت درآمد:' : 'اثر مالی ثبت هزینه:'}
            </div>
            <p className="leading-relaxed">
              مبلغ <strong className="font-mono">{faNumber(amountNum)} {currencySuffix}</strong> بابت سرفصل «
              {draftLine.details?.incomeExpenseAccountName || 'مشخص شده'}» (کد {draftLine.details?.incomeExpenseAccountCode}) ثبت می‌گردد.
              {selectedCustomer ? (
                <>
                  {' '}طرف‌حساب <strong className="font-bold">«{selectedCustomer.name}»</strong> {isIncome ? 'بدهکار' : 'بستانکار'} می‌شود.
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      {/* Sticky Commit Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            disabled={!isFormValid}
            onClick={commitDraftLine}
            className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 max-w-sm w-full cursor-pointer ${
              isIncome
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
            }`}
          >
            <ListPlus size={16} />
            {editingLineId
              ? `ثبت اصلاح ردیف ${isIncome ? 'درآمد' : 'هزینه'}`
              : `ثبت ردیف ${isIncome ? 'درآمد' : 'هزینه'}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
