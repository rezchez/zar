'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  Landmark,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { useToastManager } from '@/components/ui/toast';
import {
  formatDynamicAmountLabel,
  getCurrenciesForBaseCurrency,
  getCurrencyDisplayName,
  type Currency,
} from '@/lib/currencies';
import { dateToJalaliString } from '@/lib/jalali';
import { formatPriceWithCommas, numberToPersianWords, parseLocalizedAmount } from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import { useAppSettings } from '@/src/components/SettingsProvider';
import {
  BANK_ACCOUNT_TYPES,
  getConvertedBankAmount,
  isDomesticBankCurrency,
  isTomanCurrency,
} from '../services/bank';

export type BankDefinitionItem = {
  id: string;
  code: string;
  name: string;
  iconKey: string;
  isActive: boolean;
};

export type BankAccountEditItem = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType?: string;
  shebaNumber?: string;
  hasCheckbook?: boolean;
  hasVirtualCheck?: boolean;
  currencyId?: string;
  currencyName?: string;
  currencyCode?: string;
  currencySymbol?: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
  description?: string;
};

export type InitialBankInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (entry: { bankName: string; accountNumber: string; amount: number; description: string; date?: string }) => void;
  editItem?: BankAccountEditItem | null;
};

export default function InitialBankInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
}: InitialBankInventoryModalProps) {
  let router: { refresh: () => void } | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }

  const { settings } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';

  const [bankDefinitions, setBankDefinitions] = useState<BankDefinitionItem[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [customBankName, setCustomBankName] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('current');
  const [shebaNumber, setShebaNumber] = useState<string>('');
  const [hasCheckbook, setHasCheckbook] = useState<boolean>(false);
  const [hasVirtualCheck, setHasVirtualCheck] = useState<boolean>(false);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAutoConverted, setIsAutoConverted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setError('');
    setSuccess('');

    async function initModal() {
      setLoadingMaster(true);
      try {
        const [banksRes, currRes] = await Promise.all([
          fetch('/api/banks/list', { cache: 'no-store' }),
          fetch('/api/currencies', { cache: 'no-store' }),
        ]);

        let loadedBanks: BankDefinitionItem[] = [];
        if (banksRes.ok) {
          const banksData = await banksRes.json();
          if (Array.isArray(banksData.banks)) {
            loadedBanks = banksData.banks;
            if (isMounted) setBankDefinitions(loadedBanks);
          }
        }

        let loadedCurrencies: Currency[] = [];
        if (currRes.ok) {
          const currData = await currRes.json();
          if (Array.isArray(currData.currencies)) {
            loadedCurrencies = currData.currencies as Currency[];
            if (isMounted) setCurrencies(loadedCurrencies);
          }
        }

        if (!isMounted) return;

        if (editItem) {
          // Check if editItem's bankName matches a predefined bank
          const isPredefined = loadedBanks.some((b) => b.name === editItem.bankName);
          if (isPredefined || !editItem.bankName) {
            setSelectedBankName(editItem.bankName || (loadedBanks[0]?.name ?? ''));
            setCustomBankName('');
          } else {
            // It's a custom/unlisted bank name
            setSelectedBankName('custom');
            setCustomBankName(editItem.bankName);
          }

          setBranchName(editItem.branchName || '');
          setAccountNumber(editItem.accountNumber || '');
          setAccountType(editItem.accountType || 'current');
          setShebaNumber(editItem.shebaNumber ? editItem.shebaNumber.replace(/^IR/i, '') : '');
          setHasCheckbook(Boolean(editItem.hasCheckbook));
          setHasVirtualCheck(Boolean(editItem.hasVirtualCheck));
          setOpeningDate(editItem.openingBalanceDate || dateToJalaliString(new Date()));
          setDescription(editItem.description || '');

          const converted = getConvertedBankAmount(
            editItem.openingBalance,
            editItem.currencyCode,
            baseCurrency,
            loadedCurrencies,
          );
          setIsAutoConverted(converted.isConverted);
          setAmount(converted.amount ? formatPriceWithCommas(converted.amount) : '0');

          const matched = loadedCurrencies.find((c) => c.code.toUpperCase() === converted.currencyCode);
          if (matched) {
            setSelectedCurrencyId(matched.id);
          } else if (editItem.currencyId && loadedCurrencies.some((c) => c.id === editItem.currencyId)) {
            setSelectedCurrencyId(editItem.currencyId);
          } else {
            setSelectedCurrencyId(loadedCurrencies[0]?.id ?? '');
          }
        } else {
          // Create mode
          setSelectedBankName(loadedBanks[0]?.name || '');
          setCustomBankName('');
          setBranchName('');
          setAccountNumber('');
          setAccountType('current');
          setShebaNumber('');
          setHasCheckbook(false);
          setHasVirtualCheck(false);
          setOpeningDate(dateToJalaliString(new Date()));
          setAmount('');
          setDescription('');
          setIsAutoConverted(false);

          const effectiveCurrencies = getCurrenciesForBaseCurrency(loadedCurrencies, baseCurrency);
          const matchedDomestic = effectiveCurrencies.find((c) =>
            baseCurrency === 'IRT'
              ? isTomanCurrency(c.code)
              : !isTomanCurrency(c.code) && isDomesticBankCurrency(c.code),
          );
          setSelectedCurrencyId(matchedDomestic?.id || effectiveCurrencies[0]?.id || '');
        }
      } catch {
        if (isMounted) setError('دریافت اطلاعات پایه انجام نشد.');
      } finally {
        if (isMounted) setLoadingMaster(false);
      }
    }

    void initModal();

    return () => {
      isMounted = false;
    };
  }, [isOpen, editItem?.id, baseCurrency]);

  const activeCurrencies = useMemo(() => {
    const filtered = getCurrenciesForBaseCurrency(currencies, baseCurrency);
    return [...filtered].sort((a, b) => {
      const aIsBase = a.code?.toUpperCase() === baseCurrency;
      const bIsBase = b.code?.toUpperCase() === baseCurrency;
      if (aIsBase && !bIsBase) return -1;
      if (!aIsBase && bIsBase) return 1;
      return 0;
    });
  }, [currencies, baseCurrency]);

  const activeCurrency = useMemo(() => {
    return activeCurrencies.find((c) => c.id === selectedCurrencyId) ?? activeCurrencies[0] ?? null;
  }, [activeCurrencies, selectedCurrencyId]);

  const dynamicAmountLabel = useMemo(() => {
    return formatDynamicAmountLabel(activeCurrency);
  }, [activeCurrency]);

  // Persian words live preview for the amount
  const persianWordsAmount = useMemo(() => {
    const num = parseLocalizedAmount(amount);
    if (!num) return '';
    const words = numberToPersianWords(num);
    const currName = activeCurrency?.name || (activeCurrency?.code === 'IRT' ? 'تومان' : 'ریال');
    return `${words} ${currName}`;
  }, [amount, activeCurrency]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const numericVal = parseLocalizedAmount(rawVal);
    if (numericVal === 0 && rawVal.trim() === '') {
      setAmount('');
    } else {
      setAmount(formatPriceWithCommas(numericVal));
    }
  }

  // Automatic conversion between Rial and Toman when user switches currency selector in modal
  function handleCurrencyChange(newCurrencyId: string) {
    const prevCurr = currencies.find((c) => c.id === selectedCurrencyId);
    const nextCurr = currencies.find((c) => c.id === newCurrencyId);
    setSelectedCurrencyId(newCurrencyId);

    if (!prevCurr || !nextCurr) return;

    const prevCode = prevCurr.code.toUpperCase();
    const nextCode = nextCurr.code.toUpperCase();
    const prevIsToman = isTomanCurrency(prevCode);
    const nextIsToman = isTomanCurrency(nextCode);
    const prevIsDomestic = isDomesticBankCurrency(prevCode);
    const nextIsDomestic = isDomesticBankCurrency(nextCode);

    if (prevIsDomestic && nextIsDomestic && prevIsToman !== nextIsToman) {
      const numericVal = parseLocalizedAmount(amount);
      if (numericVal > 0) {
        if (!prevIsToman && nextIsToman) {
          // Rial to Toman (/ 10)
          setAmount(formatPriceWithCommas(Math.floor(numericVal / 10)));
        } else if (prevIsToman && !nextIsToman) {
          // Toman to Rial (* 10)
          setAmount(formatPriceWithCommas(Math.round(numericVal * 10)));
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const effectiveBankName = (selectedBankName === 'custom' ? customBankName : selectedBankName).trim();
    if (!effectiveBankName) {
      const msg = 'نام بانک را مشخص کنید.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const trimmedAccNumber = accountNumber.trim();
    if (!trimmedAccNumber) {
      const msg = 'شماره حساب الزامی است.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const trimmedSheba = shebaNumber.trim().toUpperCase();
    if (trimmedSheba) {
      const cleanSheba = trimmedSheba.startsWith('IR') ? trimmedSheba : `IR${trimmedSheba}`;
      if (!/^IR[0-9]{24}$/.test(cleanSheba)) {
        const msg = 'شماره شبا باید شامل ۲۴ رقم بعد از IR باشد (مثال: 123456789012345678901234).';
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    const numericAmount = parseLocalizedAmount(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || (amount.trim() !== '' && Number.isNaN(numericAmount))) {
      const msg = 'لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اولیه وارد کنید.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const fullSheba = trimmedSheba ? (trimmedSheba.startsWith('IR') ? trimmedSheba : `IR${trimmedSheba}`) : '';
      const res = await fetch('/api/accounting/opening/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: editItem?.id,
          bankName: effectiveBankName,
          branchName: branchName.trim(),
          accountNumber: trimmedAccNumber,
          accountType: accountType || 'current',
          shebaNumber: fullSheba,
          hasCheckbook,
          hasVirtualCheck,
          currencyId: selectedCurrencyId,
          currency: activeCurrency?.code || (baseCurrency === 'IRT' ? 'IRT' : 'IRR'),
          amount: numericAmount,
          date: openingDate.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت/ویرایش موجودی اولیه حساب بانکی انجام نشد.');
      }

      const successMsg = editItem ? 'حساب بانکی و موجودی اولیه با موفقیت به‌روزرسانی شد.' : 'حساب بانکی و موجودی اولیه با موفقیت ثبت شد.';
      setSuccess(successMsg);
      toast.success(successMsg);
      if (onSuccess) {
        onSuccess({
          bankName: effectiveBankName,
          accountNumber: trimmedAccNumber,
          amount: numericAmount,
          description: description.trim(),
          date: openingDate.trim(),
        });
      }

      if (router?.refresh) {
        router.refresh();
      }

      setTimeout(() => {
        onClose();
        setSelectedBankName('');
        setCustomBankName('');
        setBranchName('');
        setAccountNumber('');
        setShebaNumber('');
        setHasCheckbook(false);
        setHasVirtualCheck(false);
        setAmount('');
        setDescription('');
        setSuccess('');
      }, 750);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت/ویرایش موجودی اولیه حساب بانکی.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', duration: 0.28, bounce: 0.1 }}
          className="relative z-10 my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-7 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-inventory-modal-title"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-600 border border-amber-500/20 shadow-xs dark:from-amber-500/25 dark:to-amber-500/10 dark:text-amber-400">
                {editItem ? <Edit3 size={22} className="stroke-[2.2]" /> : <Landmark size={24} className="stroke-[2.2]" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="bank-inventory-modal-title"
                    className="text-base font-black text-slate-900 dark:text-white"
                  >
                    {editItem ? 'ویرایش حساب بانکی' : 'افزودن حساب بانکی جدید'}
                  </h2>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${
                    editItem
                      ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                      : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}>
                    {editItem ? 'ویرایش موجودی اولیه' : 'حساب پایه جدید'}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {editItem
                    ? `${editItem.bankName} - شماره حساب: ${editItem.accountNumber}`
                    : 'ثبت اطلاعات حساب بانکی و تعیین موجودی پایه جهت اتصال به درختواره و اسناد مالی'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              aria-label="بستن پنجره"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Status alerts */}
            {error ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                <AlertCircle size={18} className="shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={18} className="shrink-0" />
                <span className="leading-relaxed">{success}</span>
              </div>
            ) : null}

            {/* SECTION 1: مشخصات حساب و بانک */}
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/20">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block dark:text-slate-400">
                مشخصات حساب و بانک
              </span>

              {/* Bank Name Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نام بانک *
                </label>

                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800">
                    <BankLogo bankName={selectedBankName === 'custom' ? customBankName : selectedBankName} size={28} />
                  </div>

                  <select
                    value={selectedBankName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedBankName(val);
                      if (val !== 'custom') {
                        setCustomBankName('');
                      }
                    }}
                    disabled={loadingMaster || submitting}
                    aria-label="انتخاب بانک"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">انتخاب بانک...</option>
                    {bankDefinitions.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    {selectedBankName &&
                      selectedBankName !== 'custom' &&
                      !bankDefinitions.some((b) => b.name === selectedBankName) && (
                        <option value={selectedBankName}>{selectedBankName}</option>
                      )}
                    <option value="custom">سایر بانک‌ها...</option>
                  </select>
                </div>
              </div>

              {/* Custom Bank Name Input */}
              {selectedBankName === 'custom' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نام بانک دلخواه *
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: بانک مهر"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              {/* Account Type, Branch Name & Account Number */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نوع حساب *
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {BANK_ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نام / کد شعبه
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: شعبه بازار"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-9 py-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره حساب *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="12345678"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-9 py-2.5 font-mono text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      dir="ltr"
                    />
                    <CreditCard size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Sheba Number (شماره شبا) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره شبا (IBAN)
                  </label>
                  <span className="font-mono text-[10px] text-slate-400">
                    {shebaNumber ? `${shebaNumber.length} / ۲۴ رقم` : 'اختیاری'}
                  </span>
                </div>
                <div dir="ltr" className="relative flex items-center">
                  <span className="flex h-10 shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 px-3.5 font-mono text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 select-none">
                    IR
                  </span>
                  <input
                    type="text"
                    maxLength={24}
                    placeholder="123456789012345678901234"
                    value={shebaNumber}
                    onChange={(e) => {
                      const cleanVal = e.target.value.toUpperCase().replace(/^IR/, '').replace(/[^0-9]/g, '');
                      setShebaNumber(cleanVal);
                    }}
                    disabled={submitting}
                    className="w-full rounded-r-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tracking-wider text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: امکانات چک */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition select-none ${
                hasCheckbook
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex size-8 items-center justify-center rounded-xl ${
                    hasCheckbook ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <span className="block text-xs font-black">دارای دسته چک</span>
                    <span className="block text-[10px] text-slate-400">قابلیت صدور چک فیزیکی</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hasCheckbook}
                  onChange={(e) => setHasCheckbook(e.target.checked)}
                  disabled={submitting}
                  className="size-4.5 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 dark:border-slate-700"
                />
              </label>

              <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition select-none ${
                hasVirtualCheck
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex size-8 items-center justify-center rounded-xl ${
                    hasVirtualCheck ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <span className="block text-xs font-black">چک مجازی / صیادی</span>
                    <span className="block text-[10px] text-slate-400">سامانه پیچک و صیاد</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hasVirtualCheck}
                  onChange={(e) => setHasVirtualCheck(e.target.checked)}
                  disabled={submitting}
                  className="size-4.5 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 dark:border-slate-700"
                />
              </label>
            </div>

            {/* SECTION 3: موجودی پایه و مشخصات مالی */}
            <div className="space-y-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 dark:border-amber-500/25 dark:bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                  موجودی پایه و واحد مالی
                </span>
                {isAutoConverted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">
                    <ArrowLeftRight size={11} />
                    تبدیل اتوماتیک واحد پولی
                  </span>
                )}
              </div>

              {/* Currency Selector & Opening Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نوع ارز حساب *
                  </label>
                  <select
                    value={selectedCurrencyId}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    disabled={loadingMaster || submitting || activeCurrencies.length === 0}
                    aria-label="نوع ارز"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {activeCurrencies.map((curr) => {
                      const isBase = curr.code?.toUpperCase() === baseCurrency;
                      return (
                        <option key={curr.id} value={curr.id}>
                          {getCurrencyDisplayName(curr)} {isBase ? '★ (ارز پایه سیستم)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ ثبت موجودی اولیه *
                  </label>
                  <DatePicker
                    value={openingDate}
                    onValueChange={(_iso, jalali) => setOpeningDate(jalali)}
                    disabled={submitting}
                    placeholder="انتخاب تاریخ موجودی اولیه"
                  />
                </div>
              </div>

              {/* Dynamic Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                    {dynamicAmountLabel} *
                  </label>
                  {activeCurrency && (
                    <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      واحد: {activeCurrency.name} ({activeCurrency.symbol || activeCurrency.code})
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-white pr-4 pl-16 py-3 font-mono text-base font-black text-slate-900 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    dir="ltr"
                  />
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {activeCurrency?.symbol || activeCurrency?.code || ''}
                  </span>
                </div>

                {/* Persian Words Live Preview */}
                {persianWordsAmount ? (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <span>حروف:</span>
                    <span className="leading-relaxed">{persianWordsAmount}</span>
                  </div>
                ) : null}

                {/* Notice if converted from Rial to Toman or vice versa */}
                {isAutoConverted && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    موجودی این حساب بر اساس تغییر واحد پولی در تنظیمات سیستم ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'}) به صورت خودکار محاسبه و تبدیل شده است.
                  </p>
                )}
              </div>
            </div>

            {/* SECTION 4: توضیحات */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                توضیحات و یادداشت اختیاری
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات، نام صاحب امضا یا جزئیات مربوط به حساب بانکی..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-xs font-black text-slate-950 shadow-md shadow-amber-500/25 transition hover:bg-amber-400 disabled:opacity-60 dark:bg-amber-400 dark:hover:bg-amber-300"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.5} />
                )}
                <span>{editItem ? 'ذخیره تغییرات حساب' : 'ثبت حساب بانکی'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
