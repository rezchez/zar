'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  Landmark,
  Loader2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { useToastManager } from '@/components/ui/toast';
import {
  formatDynamicAmountLabel,
  getCurrenciesForBaseCurrency,
  getCurrencyDisplayName,
  type Currency,
} from '@/lib/currencies';
import { dateToJalaliString } from '@/lib/jalali';
import {
  formatPriceWithCommas,
  numberToPersianWords,
  parseLocalizedAmount,
} from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';
import { useAppSettings } from '@/src/components/SettingsProvider';
import {
  getAccountTypeLabel,
  getConvertedBankAmount,
} from '../services/bank';
import type { BankAccountItem } from './BankAccountsListClient';

export type BankOpeningBalanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  account: BankAccountItem | null;
  onSuccess?: () => void;
};

export default function BankOpeningBalanceModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: BankOpeningBalanceModalProps) {
  const { settings } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (settings.baseCurrency || 'IRR') as 'IRR' | 'IRT';

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isAutoConverted, setIsAutoConverted] = useState(false);

  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !account) return;

    setError('');
    setSuccess('');

    async function init() {
      setLoadingCurrencies(true);
      try {
        let loadedCurrencies: Currency[] = [];
        const res = await fetch('/api/currencies', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.currencies)) {
            loadedCurrencies = data.currencies;
            if (isMounted) setCurrencies(loadedCurrencies);
          }
        }

        if (!isMounted || !account) return;

        setOpeningDate(account.openingBalanceDate || dateToJalaliString(new Date()));
        setDescription(account.description || '');

        const converted = getConvertedBankAmount(
          account.openingBalance,
          account.currencyCode,
          baseCurrency,
          loadedCurrencies,
        );
        setIsAutoConverted(converted.isConverted);
        setAmount(converted.amount ? formatPriceWithCommas(converted.amount) : '0');

        const matched = loadedCurrencies.find(
          (c) => c.code.toUpperCase() === converted.currencyCode,
        );
        if (matched) {
          setSelectedCurrencyId(matched.id);
        } else if (
          account.currencyId &&
          loadedCurrencies.some((c) => c.id === account.currencyId)
        ) {
          setSelectedCurrencyId(account.currencyId);
        } else {
          setSelectedCurrencyId(loadedCurrencies[0]?.id ?? '');
        }
      } catch {
        if (isMounted) setError('دریافت اطلاعات ارزها انجام نشد.');
      } finally {
        if (isMounted) setLoadingCurrencies(false);
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, [isOpen, account?.id, baseCurrency]);

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
    return (
      activeCurrencies.find((c) => c.id === selectedCurrencyId) ??
      activeCurrencies[0] ??
      null
    );
  }, [activeCurrencies, selectedCurrencyId]);

  const dynamicAmountLabel = useMemo(() => {
    return formatDynamicAmountLabel(activeCurrency);
  }, [activeCurrency]);

  const persianWordsAmount = useMemo(() => {
    const num = parseLocalizedAmount(amount);
    if (!num) return '';
    const words = numberToPersianWords(num);
    const currName =
      activeCurrency?.name || (activeCurrency?.code === 'IRT' ? 'تومان' : 'ریال');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;

    setError('');
    setSuccess('');

    const numericAmount = parseLocalizedAmount(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      const msg = 'لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اول دوره وارد کنید.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/accounting/opening/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: account.id,
          bankName: account.bankName,
          branchName: account.branchName,
          accountNumber: account.accountNumber,
          accountType: account.accountType || 'current',
          shebaNumber: account.shebaNumber || '',
          hasCheckbook: account.hasCheckbook,
          hasVirtualCheck: account.hasVirtualCheck,
          currencyId: selectedCurrencyId,
          currency: activeCurrency?.code || (baseCurrency === 'IRT' ? 'IRT' : 'IRR'),
          amount: numericAmount,
          date: openingDate.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ویرایش موجودی اول دوره حساب بانکی انجام نشد.');
      }

      const successMsg = 'موجودی اول دوره حساب بانکی با موفقیت به‌روزرسانی شد.';
      setSuccess(successMsg);
      toast.success(successMsg);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 700);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'خطا در ویرایش موجودی اول دوره حساب بانکی.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !account) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', duration: 0.28, bounce: 0.1 }}
          className="relative z-10 my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-7 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                <Coins size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  ویرایش موجودی اول دوره حساب بانکی
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  تنظیم موجودی پایه و اسناد افتتاحیه در بخش موجودی اول دوره
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

          {/* Account Summary Banner */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800">
              <BankLogo bankName={account.bankName} size={28} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {account.bankName}
                </span>
                {account.branchName ? (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    ({account.branchName})
                  </span>
                ) : null}
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {getAccountTypeLabel(account.accountType)}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                <CreditCard size={12} />
                <span dir="ltr">{account.accountNumber}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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

            {/* Currency & Date */}
            <div className="space-y-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 dark:border-amber-500/25 dark:bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  مشخصات مالی موجودی پایه
                </span>
                {isAutoConverted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">
                    <ArrowLeftRight size={11} />
                    تبدیل اتوماتیک واحد پولی
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نوع ارز حساب *
                  </label>
                  <select
                    value={selectedCurrencyId}
                    onChange={(e) => setSelectedCurrencyId(e.target.value)}
                    disabled={loadingCurrencies || submitting || activeCurrencies.length === 0}
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

              {/* Amount Input */}
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

                {persianWordsAmount ? (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <span>حروف:</span>
                    <span className="leading-relaxed">{persianWordsAmount}</span>
                  </div>
                ) : null}

                {isAutoConverted && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    موجودی این حساب بر اساس تغییر واحد پولی سیستم ({baseCurrency === 'IRT' ? 'تومان' : 'ریال'}) به صورت خودکار محاسبه و تبدیل شده است.
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                شرح و توضیحات سند افتتاحیه
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات سند موجودی اول دوره یا شماره پیگیری..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Actions */}
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
                <span>ذخیره موجودی اول دوره</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
