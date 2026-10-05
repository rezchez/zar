'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  Edit3,
  FileText,
  Landmark,
  ListPlus,
  Plus,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { formatBankSelectOptionLabel, formatRials, getConvertedBankAmount, type BankAccount } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import { formatJalaliDate, isTodayOrPastJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  formatCurrencyAmount,
  parseLocalizedAmount,
} from '@/lib/money';

const getBankOptionLabel = formatBankSelectOptionLabel;
import Field from '@/src/components/documents/Field';
import { useAppSettings } from '@/src/components/SettingsProvider';
import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import SayadInput from '@/components/ui/sayad-input';
import { useToastManager } from '@/components/ui/toast';
import AddBankAccountModal from '@/features/banks/components/AddBankAccountModal';
import BankAccountSelect from '@/features/banks/components/BankAccountSelect';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';

type BankOperationKind =
  | 'check-payment'
  | 'pay-to-customer'
  | 'receive-from-customer'
  | 'cash-to-bank'
  | 'bank-to-cash'
  | 'bank-to-bank';

type BankTabProps = {
  nature: 'received' | 'paid';
  selectedCustomer?: Customer | null;
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
};

// Module-level in-memory cache for bank accounts across tab switches
let cachedBanks: BankAccount[] | null = null;
let banksFetchPromise: Promise<BankAccount[]> | null = null;

export async function fetchBankAccounts(forceRefresh = false): Promise<BankAccount[]> {
  if (!forceRefresh && cachedBanks) {
    return cachedBanks;
  }
  if (!forceRefresh && banksFetchPromise) {
    return banksFetchPromise;
  }
  banksFetchPromise = fetch('/api/banks', { cache: forceRefresh ? 'no-cache' : 'default' })
    .then(async (response) => {
      const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
      cachedBanks = data.banks ?? [];
      return cachedBanks;
    })
    .finally(() => {
      banksFetchPromise = null;
    });
  return banksFetchPromise;
}

export function invalidateBankAccountsCache() {
  cachedBanks = null;
}

export default function BankTab({
  nature,
  selectedCustomer,
  draftLine,
  setDraftLine,
  editingLineId,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency,
}: BankTabProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const effectiveBaseCurrency = (baseCurrency || settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';
  const currencySuffix = effectiveBaseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [banks, setBanks] = useState<BankAccount[]>(() => cachedBanks || []);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState(() => (cachedBanks && cachedBanks.length > 0 ? cachedBanks[0].id : ''));
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankOperationKind>('check-payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Bank Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check Issuance States
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [dueDateJalali, setDueDateJalali] = useState(() => formatJalaliDate());

  // Transfer Fee & Tracking States
  const [transferFee, setTransferFee] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const customerName = selectedCustomer ? selectedCustomer.name : 'طرف‌حساب';

  const operationOptions: Array<{
    value: BankOperationKind;
    label: string;
    icon: typeof ArrowRightLeft;
  }> = [
    { value: 'check-payment', label: 'پرداخت چک از حساب بانکی', icon: CreditCard },
    { value: 'pay-to-customer', label: `پرداخت وجه به ${customerName} از حساب بانکی`, icon: ArrowUpRight },
    { value: 'receive-from-customer', label: `دریافت وجه از ${customerName} به حساب بانکی`, icon: ArrowDownLeft },
  ];

  async function loadBanks() {
    try {
      const loaded = await fetchBankAccounts(true);
      setBanks(loaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های بانکی انجام نشد.');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const paramKind = searchParams.get('kind') || searchParams.get('operation');
    if (paramKind && ['check-payment', 'pay-to-customer', 'receive-from-customer', 'cash-to-bank', 'bank-to-cash', 'bank-to-bank'].includes(paramKind)) {
      setKind(paramKind as BankOperationKind);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBankAccounts(false)
      .then((loadedBanks) => {
        if (!cancelled) {
          setBanks(loadedBanks);
          if (loadedBanks.length > 0) {
            setSelectedSource((prev) => prev || loadedBanks[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && (!cachedBanks || cachedBanks.length === 0)) {
          toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های بانکی انجام نشد.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkPaymentBanks = useMemo(() => {
    return banks.filter((b) => Boolean(b.hasCheckbook || b.hasVirtualCheck));
  }, [banks]);

  useEffect(() => {
    if (kind === 'check-payment') {
      const isValid = checkPaymentBanks.some((b) => b.id === selectedSource);
      if (!isValid) {
        setSelectedSource(checkPaymentBanks[0]?.id || '');
      }
    } else {
      const isValid = banks.some((b) => b.id === selectedSource);
      if (!isValid && banks.length > 0) {
        setSelectedSource(banks[0].id);
      }
    }
  }, [kind, checkPaymentBanks, banks, selectedSource]);

  const numericAmount = parseLocalizedAmount(amount);
  const numericTransferFee = parseLocalizedAmount(transferFee);
  const totalBankDeduction = numericAmount + numericTransferFee;
  const selectedSourceAccount = banks.find((b) => b.id === selectedSource);
  const rawSourceBalance = selectedSourceAccount
    ? (selectedSourceAccount.currentBalance ?? selectedSourceAccount.balance ?? 0)
    : 0;

  const convertedSourceBalance = selectedSourceAccount
    ? getConvertedBankAmount(rawSourceBalance, selectedSourceAccount.currency, effectiveBaseCurrency).amount
    : 0;

  const normalizedSayad = normalizeDigits(sayadId).replace(/\D/g, '');
  const isSayadValid = normalizedSayad.length === 16;
  const isBalanceSufficient = numericAmount <= convertedSourceBalance;
  const isPayToCustomerBalanceSufficient = totalBankDeduction <= convertedSourceBalance;
  const isTodayCheck = isTodayOrPastJalaliDate(dueDateJalali);

  // Keep draftLine details synchronized so external commit (e.g. from pinned lines panel) works seamlessly
  useEffect(() => {
    const opLabel = operationOptions.find((o) => o.value === kind)?.label || 'عملیات بانکی';
    setDraftLine((current) => ({
      ...current,
      documentTab: 'bank',
      sourceTab: 'bank',
      documentNature: nature,
      documentTypeLabel: opLabel,
      description: description || current.description,
      details: {
        ...current.details,
        totalAmount: String(numericAmount),
        transferFee: numericTransferFee > 0 ? String(numericTransferFee) : '',
        trackingNumber: trackingNumber.trim(),
        bankAccountId: selectedSource,
        destinationBankId: selectedDestination,
        bankName: selectedSourceAccount?.bankName || '',
        bankBranch: selectedSourceAccount?.branchName || '',
        accountNumber: selectedSourceAccount?.accountNumber || '',
        bankAccountBalance: convertedSourceBalance,
        rawBankAccountBalance: rawSourceBalance,
        checkNumber: checkNumber.trim(),
        sayadId: normalizedSayad,
        dueDateJalali,
        bankOperationKind: kind,
        currencyUnit: effectiveBaseCurrency,
        baseCurrency: effectiveBaseCurrency,
      },
    }));
  }, [
    kind,
    nature,
    description,
    numericAmount,
    numericTransferFee,
    trackingNumber,
    convertedSourceBalance,
    rawSourceBalance,
    selectedSource,
    selectedDestination,
    selectedSourceAccount,
    checkNumber,
    normalizedSayad,
    dueDateJalali,
    effectiveBaseCurrency,
    setDraftLine,
  ]);

  // Synchronize state when editing an existing line or when draftLine is reset after commit
  const lastDraftIdRef = useRef(draftLine.id);
  useEffect(() => {
    if (editingLineId && draftLine.id === editingLineId) {
      setAmount(draftLine.details?.totalAmount || '');
      setTransferFee(draftLine.details?.transferFee || '');
      setTrackingNumber(draftLine.details?.trackingNumber || '');
      setCheckNumber(draftLine.details?.checkNumber || '');
      setSayadId(draftLine.details?.sayadId || '');
      setDueDateJalali(draftLine.details?.dueDateJalali || formatJalaliDate());
      setDescription(draftLine.description || '');
      if (draftLine.details?.bankAccountId) {
        setSelectedSource(draftLine.details.bankAccountId);
      }
      if (draftLine.details?.destinationBankId) {
        setSelectedDestination(draftLine.details.destinationBankId);
      }
      if (draftLine.details?.bankOperationKind) {
        setKind(draftLine.details.bankOperationKind as BankOperationKind);
      }
      lastDraftIdRef.current = draftLine.id;
    } else if (lastDraftIdRef.current !== draftLine.id && !editingLineId) {
      lastDraftIdRef.current = draftLine.id;
      setAmount('');
      setTransferFee('');
      setTrackingNumber('');
      setCheckNumber('');
      setSayadId('');
      setDueDateJalali(formatJalaliDate());
      setDescription('');
      setSelectedDestination('');
    }
  }, [draftLine.id, editingLineId, draftLine.details, draftLine.description]);

  // Sync state into draft line when committing
  function handleCommitLine() {
    if (!commitDraftLine) return;

    if (!selectedSourceAccount) {
      toast.error('حساب بانکی پرداخت‌کننده را انتخاب کنید.');
      return;
    }

    if (selectedSourceAccount.isBlocked) {
      toast.error('این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.');
      return;
    }

    if (kind === 'bank-to-bank') {
      if (!selectedDestination) {
        toast.error('حساب بانکی مقصد را انتخاب کنید.');
        return;
      }
      if (selectedSource === selectedDestination) {
        toast.error('حساب مبدأ و مقصد نمی‌توانند یکسان باشند.');
        return;
      }
      const destAccount = banks.find((b) => b.id === selectedDestination);
      if (destAccount?.isBlocked) {
        toast.error('حساب بانکی مقصد مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.');
        return;
      }
    }

    if (kind === 'check-payment') {
      if (!selectedSourceAccount.hasCheckbook && !selectedSourceAccount.hasVirtualCheck) {
        toast.error('حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.');
        return;
      }
      if (!checkNumber.trim()) {
        toast.error('شماره چک الزامی است.');
        return;
      }
      if (!isSayadValid) {
        toast.error('شناسه صیاد باید ۱۶ رقم باشد.');
        return;
      }
    }

    if (kind === 'pay-to-customer') {
      if (numericAmount <= 0) {
        toast.error('مبلغ پرداختی به طرف‌حساب باید بیشتر از صفر باشد.');
        return;
      }
      if (!isPayToCustomerBalanceSufficient) {
        toast.error(`مجموع مبلغ پرداختی و کارمزد (${Number(totalBankDeduction).toLocaleString('fa-IR')} ${currencySuffix}) از موجودی حساب بانکی (${Number(convertedSourceBalance).toLocaleString('fa-IR')} ${currencySuffix}) بیشتر است. امکان برداشت بیش از موجودی وجود ندارد.`);
        return;
      }
    }

    if (numericAmount <= 0) {
      toast.error('مبلغ تراکنش بانکی باید بیشتر از صفر باشد.');
      return;
    }

    // Check day warning
    if (kind === 'check-payment' && isTodayCheck && !isBalanceSufficient) {
      toast.warning('با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.');
    }

    const opLabel = operationOptions.find((o) => o.value === kind)?.label || 'عملیات بانکی';

    setDraftLine((current) => ({
      ...current,
      documentTab: 'bank',
      sourceTab: 'bank',
      documentNature: nature,
      documentTypeLabel: opLabel,
      description: description || current.description,
      details: {
        ...current.details,
        totalAmount: String(numericAmount),
        transferFee: numericTransferFee > 0 ? String(numericTransferFee) : '',
        trackingNumber: trackingNumber.trim(),
        bankAccountId: selectedSource,
        destinationBankId: selectedDestination,
        bankName: selectedSourceAccount?.bankName || '',
        bankBranch: selectedSourceAccount?.branchName || '',
        accountNumber: selectedSourceAccount?.accountNumber || '',
        bankAccountBalance: convertedSourceBalance,
        rawBankAccountBalance: rawSourceBalance,
        checkNumber: checkNumber.trim(),
        sayadId: normalizedSayad,
        dueDateJalali,
        bankOperationKind: kind,
        currencyUnit: effectiveBaseCurrency,
        baseCurrency: effectiveBaseCurrency,
      },
    }));

    commitDraftLine();

    // After temporary registration of check / bank row, clear all fields
    setAmount('');
    setTransferFee('');
    setTrackingNumber('');
    setCheckNumber('');
    setSayadId('');
    setDueDateJalali(formatJalaliDate());
    setDescription('');
    setSelectedDestination('');
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Controls: Operation Kind Selector & Add Bank Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {operationOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = kind === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  setKind(opt.value);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/documents/initial-inventory/bank"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-300/80 dark:border-slate-700 cursor-pointer shadow-sm"
          >
            <Edit3 size={14} />
            ویرایش حساب‌های بانکی
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 rounded-xl text-xs font-extrabold transition-colors border border-amber-500/30 cursor-pointer"
          >
            <Plus size={14} />
            حساب جدید
          </button>
        </div>
      </div>

      {/* Dynamic Operation Form */}
      {banks.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20">
          <Building2 className="mx-auto text-amber-500 mb-2" size={32} />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">هنوز هیچ حساب بانکی ثبت نشده است.</p>
          <p className="text-[11px] text-slate-500 mt-1">برای ثبت عملیات چک یا واریز/برداشت، ابتدا یک حساب بانکی تعریف کنید.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard/documents/initial-inventory/bank"
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <Edit3 size={14} />
              تعریف موجودی اولیه حساب بانکی
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Plus size={14} />
              افزودن حساب بانکی
            </button>
          </div>
        </div>
      ) : kind === 'check-payment' ? (
        /* Check Payment Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <Field
              label="حساب بانکی پرداخت‌کننده"
              className="sm:col-span-5"
              action={
                <Link
                  href="/dashboard/documents/initial-inventory/bank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <Edit3 size={12} />
                  ویرایش حساب‌ها
                </Link>
              }
            >
              {checkPaymentBanks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>هیچ حساب بانکی دارای دسته چک فیزیکی یا مجازی فعال یافت نشد.</span>
                </div>
              ) : (
                <BankAccountSelect
                  value={selectedSource}
                  onChange={(bankId) => setSelectedSource(bankId)}
                  banks={checkPaymentBanks}
                  placeholder="انتخاب حساب بانکی..."
                />
              )}
            </Field>

            <Field label="شماره چک" className="sm:col-span-3">
              <input
                value={checkNumber}
                onChange={(e) => {
                  setCheckNumber(e.target.value);
                  updateDraftDetail?.('checkNumber', e.target.value);
                }}
                placeholder="۱۲۳۴۵۶"
                className="h-10 text-xs font-mono"
              />
            </Field>

            {/* PersianLabs Jalali Due Date */}
            <Field label="تاریخ سررسید چک" className="sm:col-span-4">
              <DatePicker
                value={dueDateJalali}
                onValueChange={(_iso, jalali) => {
                  if (jalali) {
                    setDueDateJalali(jalali);
                    updateDraftDetail?.('dueDateJalali', jalali);
                  }
                }}
                calendarType="shamsi"
                showSecondary={false}
                format="yyyy/MM/dd"
                placeholder="انتخاب تاریخ سررسید"
              />
            </Field>

            <Field label={`مبلغ چک (${currencySuffix})`} className="sm:col-span-6">
              <PriceInput
                value={amount}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </Field>

            <Field label="شناسه ۱۶ رقمی صیاد" className="sm:col-span-6">
              <SayadInput
                value={sayadId}
                onChange={(e) => {
                  setSayadId(e.target.value);
                  updateDraftDetail?.('sayadId', e.target.value);
                }}
                placeholder="۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶"
                className="h-10"
              />
            </Field>

            <Field label="بابت / شرح چک" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder="شرح صدور چک صیادی..."
              />
            </Field>
          </div>

          {/* Insufficient Balance Alert */}
          {numericAmount > 0 && !isBalanceSufficient ? (
            isTodayCheck ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold leading-relaxed">
                <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>هشدار چک روز:</strong> با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                <FileText size={16} className="shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>یادآوری:</strong> مبلغ چک از موجودی فعلی حساب بیشتر است. این چک به عنوان اسناد پرداختنی ثبت شده و در سررسید ({dueDateJalali}) پاس خواهد شد.
                </span>
              </div>
            )
          ) : null}
        </div>
      ) : kind === 'pay-to-customer' ? (
        /* Direct Payment to Customer Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <Field
              label="حساب بانکی پرداخت‌کننده"
              className="sm:col-span-6"
              action={
                <Link
                  href="/dashboard/documents/initial-inventory/bank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <Edit3 size={12} />
                  ویرایش حساب‌ها
                </Link>
              }
            >
              <BankAccountSelect
                value={selectedSource}
                onChange={(bankId) => setSelectedSource(bankId)}
                banks={banks}
                placeholder="انتخاب حساب بانکی..."
              />
            </Field>

            <Field label={`مبلغ پرداختی (${currencySuffix})`} className="sm:col-span-6">
              <PriceInput
                value={amount}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </Field>

            <Field
              label={`کارمزد انتقال وجه (${currencySuffix})`}
              className="sm:col-span-6"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <PriceInput
                value={transferFee}
                onValueChange={(parsed, rawVal) => {
                  setTransferFee(rawVal);
                  updateDraftDetail?.('transferFee', String(parsed || 0));
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰ (اختیاری)"
                showWords
              />
            </Field>

            <Field
              label="شماره پیگیری / ارجاع حواله"
              className="sm:col-span-6"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <input
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  updateDraftDetail?.('trackingNumber', e.target.value);
                }}
                placeholder="کد پیگیری، ارجاع، شماره فیش..."
                className="h-10 text-xs font-mono"
              />
            </Field>

            <Field label="شرح پرداخت / بابت" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder={`شرح انتقال وجه به ${customerName}...`}
              />
            </Field>
          </div>

          {/* Balance breakdown and overdraft alert */}
          {numericAmount > 0 ? (
            <div className="space-y-2">
              {!isPayToCustomerBalanceSufficient ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs font-semibold leading-relaxed">
                  <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">موجودی حساب بانکی کافی نیست:</p>
                    <p className="mt-0.5">
                      مجموع مبلغ پرداختی و کارمزد ({formatMoney(totalBankDeduction)} {currencySuffix}) از موجودی فعلی حساب بانکی ({formatMoney(rawSourceBalance)} {currencySuffix}) بیشتر است.
                      امکان برداشت وجه بیش از موجودی از حساب بانکی وجود ندارد.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
                    <span>موجودی فعلی حساب: <strong>{formatMoney(rawSourceBalance)}</strong> {currencySuffix}</span>
                    {numericTransferFee > 0 ? (
                      <span>کارمزد انتقال: <strong>{formatMoney(numericTransferFee)}</strong> {currencySuffix}</span>
                    ) : null}
                    <span>مجموع کسر از حساب: <strong className="text-amber-600 dark:text-amber-400">{formatMoney(totalBankDeduction)}</strong> {currencySuffix}</span>
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                    مانده پس از تراکنش: {formatMoney(rawSourceBalance - totalBankDeduction)} {currencySuffix}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : kind === 'receive-from-customer' ? (
        /* Receive from Customer Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <Field
              label="حساب بانکی واریز شونده"
              className="sm:col-span-6"
              action={
                <Link
                  href="/dashboard/documents/initial-inventory/bank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <Edit3 size={12} />
                  ویرایش حساب‌ها
                </Link>
              }
            >
              <BankAccountSelect
                value={selectedSource}
                onChange={(bankId) => setSelectedSource(bankId)}
                banks={banks}
                placeholder="انتخاب حساب بانکی..."
              />
            </Field>

            <Field label={`مبلغ دریافتی (${currencySuffix})`} className="sm:col-span-6">
              <PriceInput
                value={amount}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </Field>

            <Field
              label="شماره پیگیری / ارجاع واریز"
              className="sm:col-span-12"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <input
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  updateDraftDetail?.('trackingNumber', e.target.value);
                }}
                placeholder="کد پیگیری، ارجاع، شماره فیش..."
                className="h-10 text-xs font-mono"
              />
            </Field>

            <Field label="شرح دریافت / بابت" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder={`شرح دریافت وجه از ${customerName}...`}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {/* Info Banner: Internal Bank & Cash Operations Moved to Bank Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <Landmark size={15} className="text-amber-500 shrink-0" />
          <span>جهت انتقال حساب به حساب یا واریز و برداشت وجه با صندوق‌ها، به بخش «بانک» مراجعه نمایید.</span>
        </span>
        <Link
          href="/dashboard/documents/initial-inventory/bank"
          className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition shrink-0"
        >
          <span>رفتن به عملیات بانکی</span>
          <ArrowRightLeft size={13} />
        </Link>
      </div>

      {/* Blocked Bank Account Warning */}
      {selectedSourceAccount?.isBlocked ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200 text-xs font-bold">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.</span>
        </div>
      ) : null}

      {/* Sticky Commit Line Button */}
      {commitDraftLine && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className={`document-commit-line-button shadow-lg max-w-sm ${
              selectedSourceAccount?.isBlocked || (kind === 'pay-to-customer' && numericAmount > 0 && !isPayToCustomerBalanceSufficient)
                ? 'opacity-50 cursor-not-allowed bg-slate-400 dark:bg-slate-700'
                : 'cursor-pointer'
            }`}
            disabled={Boolean(selectedSourceAccount?.isBlocked) || (kind === 'pay-to-customer' && numericAmount > 0 && !isPayToCustomerBalanceSufficient)}
            onClick={handleCommitLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      {/* MODAL: ADD NEW BANK ACCOUNT */}
      <AddBankAccountModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (newBank) => {
          await loadBanks();
          setSelectedSource(newBank.id);
          toast.success(`حساب بانکی «${newBank.bankName}» با موفقیت ایجاد شد.`);
        }}
      />
    </div>
  );
}
