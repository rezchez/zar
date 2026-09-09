'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, CreditCard, Landmark, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import { useAppSettings } from '@/components/shared/SettingsProvider';
import { type CheckRecord } from '@/lib/check';
import { dateToJalaliString, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

type BankOption = {
  id: string;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  currencyCode?: string;
  currencySymbol?: string;
  isBlocked?: boolean;
};

type CustomerOption = {
  id: string;
  name: string;
  customerCode?: number;
};

export default function InitialIssuedCheckModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editItem?: CheckRecord | null;
}) {
  const { settings, formatMoney } = useAppSettings();
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [banks, setBanks] = useState<BankOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(dateToJalaliString(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [banksRes, customersRes] = await Promise.all([
        fetch('/api/banks', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
      ]);

      if (banksRes.ok) {
        const data = await banksRes.json();
        const rawBanks = Array.isArray(data.banks)
          ? data.banks
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];
        setBanks(rawBanks);
      }

      if (customersRes.ok) {
        const data = await customersRes.json();
        const rawCustomers = Array.isArray(data.customers)
          ? data.customers
          : Array.isArray(data.items)
            ? data.items
            : [];
        setCustomers(rawCustomers);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void fetchOptions();

    if (editItem) {
      setSelectedBankId(editItem.bankAccount || '');
      setSelectedCustomerId(editItem.customer || '');
      setCheckNumber(editItem.checkNumber || editItem.sayadId || '');
      setAmount(editItem.amount ? String(editItem.amount) : '');
      setIssueDate(editItem.issueDateJalali || editItem.openingBalanceDateJalali || dateToJalaliString(new Date()));
      setDueDate(editItem.dueDateJalali || '');
      setDescription(editItem.description || '');
      setErrorMsg(null);
    } else {
      setSelectedBankId('');
      setSelectedCustomerId('');
      setCheckNumber('');
      setAmount('');
      setIssueDate(dateToJalaliString(new Date()));
      setDueDate('');
      setDescription('');
      setErrorMsg(null);
    }
  }, [isOpen, editItem, fetchOptions]);

  if (!isOpen) return null;

  const selectedBank = banks.find((b) => b.id === selectedBankId);
  const isSelectedBankBlocked = selectedBank?.isBlocked === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedBankId) {
      setErrorMsg('انتخاب حساب بانکی الزامی است.');
      return;
    }

    if (isSelectedBankBlocked) {
      setErrorMsg('این حساب بانکی مسدود است و امکان ثبت چک جدید برای آن وجود ندارد.');
      return;
    }

    const normalizedNo = normalizeDigits(checkNumber).trim();
    if (!normalizedNo) {
      setErrorMsg('شماره چک الزامی است.');
      return;
    }

    const parsedAmount = parseLocalizedAmount(amount);
    if (parsedAmount <= 0) {
      setErrorMsg('مبلغ چک باید بیشتر از صفر باشد.');
      return;
    }

    if (!dueDate) {
      setErrorMsg('تاریخ سررسید چک معتبر نیست.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/accounting/opening/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem?.id,
          bankAccount: selectedBankId,
          customer: selectedCustomerId || null,
          checkNumber: normalizedNo,
          amount: parsedAmount,
          dueDateJalali: dueDate,
          openingBalanceDateJalali: issueDate,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'ثبت چک افتتاحیه با خطا مواجه شد.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
      />

      <motion.div
        dir="rtl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
              <CreditCard size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                {editItem ? 'ویرایش چک صادرشده اول دوره' : 'ثبت چک صادرشده اول دوره'}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                چک‌های صادرشده پیش از دوره که هنوز در بانک وصول نشده‌اند
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Bank Account Selection */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
              حساب بانکی <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                disabled={loading || submitting}
                required
                className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">-- انتخاب حساب بانکی --</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.isBlocked === true}>
                    {b.bankName} {b.branchName ? `(${b.branchName})` : ''} - {b.accountNumber}
                    {b.isBlocked ? ' ⛔ [مسدود]' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Landmark size={16} />
              </div>
            </div>
            {isSelectedBankBlocked && (
              <p className="mt-1 text-[11px] font-bold text-rose-500">
                این حساب بانکی مسدود است و امکان ثبت چک جدید برای آن وجود ندارد.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Check Number */}
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                شماره چک / شناسه صیاد <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="مثال: ۱۲۳۴۵۶ یا شناسه ۱۶ رقمی"
                required
                disabled={submitting}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Customer / Payee */}
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                طرف‌حساب / ذینفع چک
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                disabled={loading || submitting}
                className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">-- انتخاب طرف‌حساب (اختیاری) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.customerCode ? `(کد: ${c.customerCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
              مبلغ چک ({currencySuffix}) <span className="text-rose-500">*</span>
            </label>
            <PriceInput
              value={amount}
              onValueChange={(_parsed, raw) => setAmount(raw)}
              placeholder="۰"
              baseCurrency={effectiveCurrency}
              currencySuffix={currencySuffix}
              showWords={true}
              disabled={submitting}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                تاریخ صدور / افتتاحیه <span className="text-rose-500">*</span>
              </label>
              <DatePicker
                value={issueDate}
                onValueChange={(_iso, jalali) => setIssueDate(jalali)}
                disabled={submitting}
                placeholder="انتخاب تاریخ صدور"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                تاریخ سررسید <span className="text-rose-500">*</span>
              </label>
              <DatePicker
                value={dueDate}
                onValueChange={(_iso, jalali) => setDueDate(jalali)}
                disabled={submitting}
                placeholder="انتخاب تاریخ سررسید"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
              توضیحات / بابت
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات اختیاری در مورد چک صادرشده..."
              disabled={submitting}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Notice Alert */}
          <div className="rounded-2xl bg-amber-50/70 p-3 text-[11px] font-medium leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>نکته حسابداری:</strong> ثبت چک افتتاحیه نشان‌دهنده تعهد صادرشده قبل از دوره است و تا زمان وصول
            شدن در بانک، از موجودی حساب بانکی کسر نخواهد شد.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 rounded-2xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting || isSelectedBankBlocked}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>{submitting ? 'در حال ثبت...' : editItem ? 'ذخیره تغییرات' : 'ثبت چک افتتاحیه'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
