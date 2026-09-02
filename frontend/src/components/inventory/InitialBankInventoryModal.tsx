'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  formatDynamicAmountLabel,
  type Currency,
} from '@/lib/currencies';
import { dateToJalaliString } from '@/lib/jalali';
import { formatPriceWithCommas, parseLocalizedAmount } from '@/lib/money';

export type BankDefinitionItem = {
  id: string;
  code: string;
  name: string;
  iconKey?: string;
  isActive?: boolean;
};

export type InitialBankInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (entry: { bankName: string; accountNumber: string; currency: string; amount: number; description: string; date?: string }) => void;
};

export default function InitialBankInventoryModal({
  isOpen,
  onClose,
  onSuccess,
}: InitialBankInventoryModalProps) {
  let router: { refresh: () => void } | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }

  const [banks, setBanks] = useState<BankDefinitionItem[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Inline Quick Add Currency state
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [addCurrencyError, setAddCurrencyError] = useState('');
  const [addCurrencySuccess, setAddCurrencySuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [banksRes, currenciesRes] = await Promise.all([
        fetch('/api/banks/list', { cache: 'no-store' }),
        fetch('/api/currencies', { cache: 'no-store' }),
      ]);

      if (banksRes.ok) {
        const banksData = await banksRes.json();
        if (Array.isArray(banksData.banks)) {
          setBanks(banksData.banks);
          setSelectedBankName((current) => current || banksData.banks[0]?.name || '');
        }
      }

      if (currenciesRes.ok) {
        const currData = await currenciesRes.json();
        if (Array.isArray(currData.currencies)) {
          const collectionCurrencies = currData.currencies as Currency[];
          setCurrencies(collectionCurrencies);
          setSelectedCurrencyId((current) =>
            collectionCurrencies.some((c) => c.id === current)
              ? current
              : collectionCurrencies[0]?.id ?? '',
          );
        }
      }
    } catch {
      setError('دریافت اطلاعات بانک‌ها و ارزها با خطا مواجه شد.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadData();
      setError('');
      setSuccess('');
      setShowAddCurrency(false);
      setAddCurrencyError('');
      setAddCurrencySuccess('');
      setOpeningDate(dateToJalaliString(new Date()));
      setBranchName('');
      setAccountNumber('');
      setAmount('');
      setDescription('');
    }
  }, [isOpen, loadData]);

  const activeCurrency = useMemo(() => {
    return currencies.find((currency) => currency.id === selectedCurrencyId) ?? null;
  }, [currencies, selectedCurrencyId]);

  const dynamicAmountLabel = useMemo(() => {
    return formatDynamicAmountLabel(activeCurrency);
  }, [activeCurrency]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const numericVal = parseLocalizedAmount(rawVal);
    if (numericVal === 0 && rawVal.trim() === '') {
      setAmount('');
    } else {
      setAmount(formatPriceWithCommas(numericVal));
    }
  }

  async function handleAddCurrencySubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddCurrencyError('');
    setAddCurrencySuccess('');

    const trimmedName = newCurrencyName.trim();
    const trimmedSymbol = newCurrencySymbol.trim();
    const trimmedCode = newCurrencyCode.trim().toUpperCase() || trimmedSymbol;

    if (!trimmedName) {
      setAddCurrencyError('نام ارز الزامی است.');
      return;
    }
    if (!trimmedSymbol) {
      setAddCurrencyError('نماد ارز الزامی است.');
      return;
    }
    if (!trimmedCode) {
      setAddCurrencyError('کد ارز الزامی است.');
      return;
    }

    const normalizedName = trimmedName.toLocaleLowerCase('fa-IR');
    const duplicate = currencies.find((currency) =>
      currency.name.trim().toLocaleLowerCase('fa-IR') === normalizedName
      || currency.code.trim().toUpperCase() === trimmedCode,
    );
    if (duplicate) {
      setAddCurrencyError(`ارز «${duplicate.name}» با کد ${duplicate.code} قبلاً ثبت شده است.`);
      return;
    }

    setAddingCurrency(true);
    try {
      const res = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          symbol: trimmedSymbol,
          code: trimmedCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت ارز جدید انجام نشد.');
      }

      const created: Currency = data.currency;
      setCurrencies((prev) => {
        const filtered = prev.filter((c) => c.code.toUpperCase() !== created.code.toUpperCase());
        return [created, ...filtered];
      });
      setSelectedCurrencyId(created.id);
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      setNewCurrencyCode('');
      setShowAddCurrency(false);
      setAddCurrencySuccess(`ارز «${created.name}» با موفقیت به فهرست اضافه و انتخاب شد.`);
    } catch (err) {
      setAddCurrencyError(err instanceof Error ? err.message : 'ثبت ارز جدید با خطا مواجه شد.');
    } finally {
      setAddingCurrency(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedBankName.trim()) {
      setError('انتخاب یا ورود نام بانک الزامی است.');
      return;
    }

    if (!accountNumber.trim()) {
      setError('ورود شماره حساب الزامی است.');
      return;
    }

    if (!activeCurrency || !selectedCurrencyId) {
      setError('انتخاب ارز الزامی است.');
      return;
    }

    const numericAmount = parseLocalizedAmount(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || (amount.trim() !== '' && Number.isNaN(numericAmount))) {
      setError('لطفاً مبلغ معتبری برای موجودی اولیه وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/accounting/opening/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: selectedBankName.trim(),
          branchName: branchName.trim(),
          accountNumber: accountNumber.trim(),
          currencyId: activeCurrency.id,
          currency: activeCurrency.code,
          amount: numericAmount,
          date: openingDate.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت موجودی اولیه حساب بانکی انجام نشد.');
      }

      setSuccess('حساب بانکی و موجودی اولیه با موفقیت ثبت شد.');
      if (onSuccess) {
        onSuccess({
          bankName: selectedBankName.trim(),
          accountNumber: accountNumber.trim(),
          currency: activeCurrency.code,
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
        setBranchName('');
        setAccountNumber('');
        setAmount('');
        setDescription('');
        setSuccess('');
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت موجودی اولیه حساب بانکی.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.25 }}
          className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-inventory-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400">
                <Building2 size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h2
                  id="bank-inventory-modal-title"
                  className="text-base font-extrabold text-slate-900 dark:text-white"
                >
                  ثبت و تعریف موجودی اولیه حساب بانکی
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  تعریف حساب‌های بانکی و تراز پایه آن‌ها
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="بستن پنجره"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Status alerts */}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            ) : null}

            {/* Bank Name Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نام بانک *
              </label>
              <select
                value={selectedBankName}
                onChange={(e) => setSelectedBankName(e.target.value)}
                disabled={loadingData || submitting || banks.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {banks.length === 0 ? (
                  <option value="">بانکی یافت نشد</option>
                ) : banks.map((bank) => (
                  <option key={bank.id || bank.code} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Name & Account Number */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  شعبه
                </label>
                <input
                  type="text"
                  placeholder="مثال: مرکزی"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  شماره حساب *
                </label>
                <input
                  type="text"
                  placeholder="مثال: 0102030405"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left font-mono text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Currency Selector (نوع ارز) + Inline Add Button */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نوع ارز *
              </label>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedCurrencyId}
                    onChange={(e) => setSelectedCurrencyId(e.target.value)}
                    disabled={loadingData || submitting || currencies.length === 0}
                    aria-label="نوع ارز"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {currencies.length === 0 ? (
                      <option value="">ارزی در کالکشن ثبت نشده است</option>
                    ) : currencies.map((curr) => {
                      const val = curr.id || curr.code;
                      const label = curr.symbol
                        ? `${curr.name} (${curr.symbol})`
                        : curr.name;
                      return (
                        <option key={curr.id || val} value={curr.id || curr.code}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddCurrency((prev) => !prev)}
                  className={`inline-flex size-9.5 shrink-0 items-center justify-center rounded-xl border transition ${
                    showAddCurrency
                      ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-500/50 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="افزودن ارز جدید"
                  aria-label="افزودن ارز جدید"
                >
                  <Plus size={18} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            {addCurrencySuccess ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{addCurrencySuccess}</span>
              </div>
            ) : null}

            {/* Inline Quick Add Currency Sub-form */}
            <AnimatePresence>
              {showAddCurrency && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5 dark:bg-blue-500/10"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black text-blue-900 dark:text-blue-200">
                      <Coins size={15} />
                      تعریف و افزودن ارز جدید به جدول ارزها
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCurrency(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {addCurrencyError && (
                    <p className="mb-2 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      {addCurrencyError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        نام ارز (اجباری) *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: لیر"
                        value={newCurrencyName}
                        onChange={(e) => setNewCurrencyName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        نماد ارز (اجباری) *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: ₺"
                        value={newCurrencySymbol}
                        onChange={(e) => setNewCurrencySymbol(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        کد لاتین (اجباری/یکتا) *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: TRY"
                        value={newCurrencyCode}
                        onChange={(e) => setNewCurrencyCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 uppercase"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddCurrencySubmit}
                      disabled={addingCurrency}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {addingCurrency ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} strokeWidth={2.5} />
                      )}
                      <span>ذخیره در جدول ارزها</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Opening Date Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                تاریخ ثبت موجودی اولیه *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="1405/01/01"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-right font-mono text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <Calendar size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Dynamic Amount Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {dynamicAmountLabel} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left font-mono text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  dir="ltr"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">
                  {activeCurrency?.symbol || activeCurrency?.code || ''}
                </span>
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                توضیحات
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات یا جزئیات مربوط به موجودی اولیه..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={submitting || !activeCurrency}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white shadow-sm shadow-blue-500/25 transition hover:bg-blue-500 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.5} />
                )}
                <span>ثبت موجودی اولیه</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
