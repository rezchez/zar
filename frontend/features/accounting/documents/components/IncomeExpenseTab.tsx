'use client';

import React, { useEffect } from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  Coffee,
  Coins,
  CreditCard,
  Flame,
  FolderTree,
  Gem,
  ListPlus,
  Phone,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';

import AccountTreeSelector from '@/features/accounting/chart-of-accounts/components/AccountTreeSelector';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import type { ChartOfAccountRecord } from '@/lib/chart-of-accounts';
import { faNumber, numberValue } from '../utils/document-helpers';

type QuickChip = {
  id: string;
  label: string;
  accountCode: string;
  accountName: string;
  accountPath: string;
  accountId: string;
  defaultDescription: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const QUICK_EXPENSE_CHIPS: QuickChip[] = [
  {
    id: 'exp_hospitality',
    label: 'پذیرایی و تشریفات',
    accountCode: '6500',
    accountName: 'سایر هزینه‌های عملیاتی',
    accountPath: '/6000/6500/',
    accountId: 'sys_6500',
    defaultDescription: 'بابت هزینه پذیرایی و تشریفات',
    icon: Coffee,
  },
  {
    id: 'exp_transport',
    label: 'ایاب و ذهاب و پیک',
    accountCode: '6500',
    accountName: 'سایر هزینه‌های عملیاتی',
    accountPath: '/6000/6500/',
    accountId: 'sys_6500',
    defaultDescription: 'بابت هزینه ایاب و ذهاب و پیک ارسال طلا',
    icon: Car,
  },
  {
    id: 'exp_rent',
    label: 'اجاره محل',
    accountCode: '6120',
    accountName: 'اجاره',
    accountPath: '/6000/6100/6120/',
    accountId: 'sys_6120',
    defaultDescription: 'بابت اجاره‌بهای ماهانه',
    icon: Building2,
  },
  {
    id: 'exp_utilities',
    label: 'قبوض آب، برق و گاز',
    accountCode: '6130',
    accountName: 'آب، برق و گاز',
    accountPath: '/6000/6100/6130/',
    accountId: 'sys_6130',
    defaultDescription: 'بابت پرداخت قبض انشعابات',
    icon: Zap,
  },
  {
    id: 'exp_telecom',
    label: 'تلفن و اینترنت',
    accountCode: '6140',
    accountName: 'تلفن و اینترنت',
    accountPath: '/6000/6100/6140/',
    accountId: 'sys_6140',
    defaultDescription: 'بابت هزینه تلفن و اینترنت',
    icon: Phone,
  },
  {
    id: 'exp_bank_fee',
    label: 'کارمزد بانکی و POS',
    accountCode: '6300',
    accountName: 'هزینه‌های مالی و بانکی',
    accountPath: '/6000/6300/',
    accountId: 'sys_6300',
    defaultDescription: 'بابت کارمزد خدمات بانکی و تراکنش POS',
    icon: CreditCard,
  },
];

const QUICK_INCOME_CHIPS: QuickChip[] = [
  {
    id: 'inc_assay_design',
    label: 'طراحی، ری‌گیری و عیارسنجی',
    accountCode: '4240',
    accountName: 'اجرت طراحی، ری‌گیری و حکاکی',
    accountPath: '/4000/4200/4240/',
    accountId: 'sys_4240',
    defaultDescription: 'بابت درآمد خدمات ری‌گیری و عیارسنجی',
    icon: Sparkles,
  },
  {
    id: 'inc_repair',
    label: 'تعمیرات و تعویض',
    accountCode: '4230',
    accountName: 'اجرت تعمیرات و تعویض',
    accountPath: '/4000/4200/4230/',
    accountId: 'sys_4230',
    defaultDescription: 'بابت درآمد خدمات تعمیرات و بازسازی طلا',
    icon: Wrench,
  },
  {
    id: 'inc_gem_setting',
    label: 'مخراج‌کاری و نگین',
    accountCode: '4220',
    accountName: 'اجرت مخراج‌کاری و نگین',
    accountPath: '/4000/4200/4220/',
    accountId: 'sys_4220',
    defaultDescription: 'بابت اجرت مخراج‌کاری و مخراج نگین',
    icon: Gem,
  },
  {
    id: 'inc_plating',
    label: 'آبکاری و پوشش‌دهی',
    accountCode: '4210',
    accountName: 'درآمد آبکاری',
    accountPath: '/4000/4200/4210/',
    accountId: 'sys_4210',
    defaultDescription: 'بابت درآمد خدمات آبکاری',
    icon: Flame,
  },
  {
    id: 'inc_misc',
    label: 'درآمدهای متفرقه',
    accountCode: '4300',
    accountName: 'درآمدهای غیرعملیاتی و متفرقه',
    accountPath: '/4000/4300/',
    accountId: 'sys_4300',
    defaultDescription: 'بابت درآمدهای متفرقه غیرعملیاتی',
    icon: Coins,
  },
];

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

  // Current values read directly from draftLine.details with decimal stripping for whole-number format
  const selectedAccountId = draftLine?.details?.incomeExpenseAccountId || null;
  const rawTotalAmountStr = draftLine?.details?.totalAmount || '';
  const totalAmountStr = rawTotalAmountStr.includes('.') ? rawTotalAmountStr.split('.')[0] : rawTotalAmountStr;
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
    // Ensure fractional decimal numbers are stripped and stored as integer string
    const cleanAmount = amountStr.includes('.') ? amountStr.split('.')[0] : amountStr;
    updateDraftDetail('totalAmount', cleanAmount);
  };

  const handleChipSelect = (chip: QuickChip) => {
    handleAccountSelect(chip.accountId, {
      id: chip.accountId,
      code: chip.accountCode,
      name: chip.accountName,
      parentId: null,
      path: chip.accountPath,
      level: 3,
      accountType: isIncome ? 'revenue' : 'expense',
      normalBalance: isIncome ? 'credit' : 'debit',
      requiresWeight: false,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: true,
      sortOrder: 1,
      description: '',
      created: '',
      updated: '',
    });

    // Populate description if currently empty or matching a default chip description
    if (
      !description ||
      description.trim() === '' ||
      QUICK_EXPENSE_CHIPS.some((c) => c.defaultDescription === description) ||
      QUICK_INCOME_CHIPS.some((c) => c.defaultDescription === description)
    ) {
      setDraftLine((current) => ({
        ...current,
        description: chip.defaultDescription,
      }));
    }
  };

  const amountNum = Math.floor(numberValue(totalAmountStr));

  const isFormValid = Boolean(selectedAccountId && amountNum > 0 && description.trim());

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

      {/* Quick Access Chips / Mints Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Tag size={15} className="text-amber-500 shrink-0" />
          <span>میانبرهای پرکاربرد (دسترسی سریع)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isIncome ? QUICK_INCOME_CHIPS : QUICK_EXPENSE_CHIPS).map((chip) => {
            const Icon = chip.icon;
            const isSelected = selectedAccountId === chip.accountId;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChipSelect(chip)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? isIncome
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-white' : 'text-amber-500'} />
                <span>{chip.label}</span>
              </button>
            );
          })}
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
          postableOnly
          maxSelectableLevel={3}
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
          <Field label="شرح ردیف / بابت" required>
            <input
              type="text"
              maxLength={500}
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
              مبلغ <strong className="font-mono">{faNumber(amountNum, 0)} {currencySuffix}</strong> بابت سرفصل «
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

      {/* Dedicated Row Submission Button */}
      {!isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            disabled={!isFormValid || !draftReady}
            onClick={commitDraftLine}
            className={`document-commit-line-button shadow-lg max-w-sm ${
              !isFormValid || !draftReady ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            } ${
              isIncome
                ? '!bg-gradient-to-r !from-emerald-600 !to-teal-600 hover:!from-emerald-500 hover:!to-teal-500'
                : '!bg-gradient-to-r !from-rose-600 !to-red-600 hover:!from-rose-500 hover:!to-red-500'
            }`}
          >
            <ListPlus size={18} />
            <span>
              {editingLineId
                ? `ثبت اصلاح ردیف ${isIncome ? 'درآمد' : 'هزینه'}`
                : `ثبت ردیف ${isIncome ? 'درآمد' : 'هزینه'}`}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
