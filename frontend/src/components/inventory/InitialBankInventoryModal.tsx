'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Edit2,
  Landmark,
  Loader2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import {
  formatDynamicAmountLabel,
  type Currency,
} from '@/lib/currencies';
import { dateToJalaliString } from '@/lib/jalali';
import { formatPriceWithCommas, parseLocalizedAmount } from '@/lib/money';
import BankLogo from '@/src/components/documents/BankLogo';

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

  const [bankDefinitions, setBankDefinitions] = useState<BankDefinitionItem[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [customBankName, setCustomBankName] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
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

  const loadMasterData = useCallback(async () => {
    setLoadingMaster(true);
    try {
      const [banksRes, currRes] = await Promise.all([
        fetch('/api/banks/list', { cache: 'no-store' }),
        fetch('/api/currencies', { cache: 'no-store' }),
      ]);

      if (banksRes.ok) {
        const banksData = await banksRes.json();
        if (Array.isArray(banksData.banks)) {
          setBankDefinitions(banksData.banks);
          if (banksData.banks.length > 0 && !editItem) {
            setSelectedBankName(banksData.banks[0].name);
          }
        }
      }

      if (currRes.ok) {
        const currData = await currRes.json();
        if (Array.isArray(currData.currencies)) {
          const list = currData.currencies as Currency[];
          setCurrencies(list);
          setSelectedCurrencyId((curr) => {
            if (editItem?.currencyId && list.some((c) => c.id === editItem.currencyId)) {
              return editItem.currencyId;
            }
            if (editItem?.currencyCode) {
              const matched = list.find((c) => c.code.toUpperCase() === editItem.currencyCode?.toUpperCase());
              if (matched) return matched.id;
            }
            return list.some((c) => c.id === curr) ? curr : list[0]?.id ?? '';
          });
        }
      }
    } catch {
      setError('دریافت اطلاعات پایه انجام نشد.');
    } finally {
      setLoadingMaster(false);
    }
  }, [editItem]);

  useEffect(() => {
    if (isOpen) {
      void loadMasterData();
      setError('');
      setSuccess('');

      if (editItem) {
        setSelectedBankName(editItem.bankName || '');
        setBranchName(editItem.branchName || '');
        setAccountNumber(editItem.accountNumber || '');
        setShebaNumber(editItem.shebaNumber ? editItem.shebaNumber.replace(/^IR/i, '') : '');
        setHasCheckbook(Boolean(editItem.hasCheckbook));
        setHasVirtualCheck(Boolean(editItem.hasVirtualCheck));
        setAmount(editItem.openingBalance ? formatPriceWithCommas(editItem.openingBalance) : '0');
        setOpeningDate(editItem.openingBalanceDate || dateToJalaliString(new Date()));
        setDescription(editItem.description || '');
      } else {
        setOpeningDate(dateToJalaliString(new Date()));
        setSelectedBankName('');
        setCustomBankName('');
        setBranchName('');
        setAccountNumber('');
        setShebaNumber('');
        setHasCheckbook(false);
        setHasVirtualCheck(false);
        setAmount('');
        setDescription('');
      }
    }
  }, [isOpen, loadMasterData, editItem]);

  const activeCurrency = useMemo(() => {
    return currencies.find((c) => c.id === selectedCurrencyId) ?? null;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const effectiveBankName = (selectedBankName === 'custom' ? customBankName : selectedBankName).trim();
    if (!effectiveBankName) {
      setError('نام بانک را مشخص کنید.');
      return;
    }

    const trimmedAccNumber = accountNumber.trim();
    if (!trimmedAccNumber) {
      setError('شماره حساب الزامی است.');
      return;
    }

    const trimmedSheba = shebaNumber.trim().toUpperCase();
    if (trimmedSheba) {
      const cleanSheba = trimmedSheba.startsWith('IR') ? trimmedSheba : `IR${trimmedSheba}`;
      if (!/^IR[0-9]{24}$/.test(cleanSheba)) {
        setError('شماره شبا باید شامل ۲۴ رقم باشد (مثال: IR123456789012345678901234).');
        return;
      }
    }

    const numericAmount = parseLocalizedAmount(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || (amount.trim() !== '' && Number.isNaN(numericAmount))) {
      setError('لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اولیه وارد کنید.');
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
          shebaNumber: fullSheba,
          hasCheckbook,
          hasVirtualCheck,
          currencyId: selectedCurrencyId,
          currency: activeCurrency?.code || 'IRT',
          amount: numericAmount,
          date: openingDate.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت/ویرایش موجودی اولیه حساب بانکی انجام نشد.');
      }

      setSuccess(editItem ? 'حساب بانکی و موجودی اولیه با موفقیت به‌روزرسانی شد.' : 'حساب بانکی و موجودی اولیه با موفقیت ثبت شد.');
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
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت/ویرایش موجودی اولیه حساب بانکی.');
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
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                {editItem ? <Edit2 size={20} className="stroke-[2.2]" /> : <Landmark size={22} className="stroke-[2.2]" />}
              </div>
              <div>
                <h2
                  id="bank-inventory-modal-title"
                  className="text-base font-extrabold text-slate-900 dark:text-white"
                >
                  {editItem ? 'ویرایش موجودی اولیه حساب بانکی' : 'ثبت و تعریف موجودی اولیه حساب بانکی'}
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {editItem ? `ویرایش مقدار و تاریخ موجودی اولیه ${editItem.bankName} (${editItem.accountNumber})` : 'ایجاد حساب بانکی و ثبت موجودی پایه در سیستم'}
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

            {/* Bank Name Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نام بانک *
              </label>

              <div className="flex items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center">
                  <BankLogo bankName={selectedBankName === 'custom' ? customBankName : selectedBankName} size={32} />
                </div>

                <select
                  value={selectedBankName}
                  onChange={(e) => setSelectedBankName(e.target.value)}
                  disabled={loadingMaster || submitting}
                  aria-label="انتخاب بانک"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">انتخاب کنید...</option>
                  {bankDefinitions.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}

            {/* Branch Name & Account Number */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <Building2 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  شماره حساب *
                </label>
                <input
                  type="text"
                  placeholder="12345678"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Sheba Number (شماره شبا) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                شماره شبا
              </label>
              <div className="relative flex items-center dir-ltr">
                <span className="flex h-10 shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 px-3 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  IR
                </span>
                <input
                  type="text"
                  maxLength={24}
                  placeholder="123456789012345678901234"
                  value={shebaNumber}
                  onChange={(e) => setShebaNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={submitting}
                  className="w-full rounded-r-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Checkbook & Virtual Check Checkboxes */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={hasCheckbook}
                  onChange={(e) => setHasCheckbook(e.target.checked)}
                  disabled={submitting}
                  className="size-4 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 dark:border-slate-700"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  دسته چک
                </span>
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={hasVirtualCheck}
                  onChange={(e) => setHasVirtualCheck(e.target.checked)}
                  disabled={submitting}
                  className="size-4 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 dark:border-slate-700"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  چک مجازی
                </span>
              </label>
            </div>

            {/* Currency Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نوع ارز
              </label>
              <select
                value={selectedCurrencyId}
                onChange={(e) => setSelectedCurrencyId(e.target.value)}
                disabled={loadingMaster || submitting || currencies.length === 0}
                aria-label="نوع ارز"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {currencies.map((curr) => (
                  <option key={curr.id} value={curr.id}>
                    {curr.symbol ? `${curr.name} (${curr.symbol})` : curr.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Opening Date Field (PersianLabs DatePicker) */}
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left font-mono text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                placeholder="توضیحات یا جزئیات مربوط به حساب بانکی..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-sm shadow-amber-500/25 transition hover:bg-amber-400 disabled:opacity-60 dark:bg-amber-400 dark:hover:bg-amber-300"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.5} />
                )}
                <span>{editItem ? 'ذخیره تغییرات' : 'ثبت موجودی اولیه'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
