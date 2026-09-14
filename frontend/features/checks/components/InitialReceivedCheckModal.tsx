'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, CreditCard, Landmark, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import SayadInput from '@/components/ui/sayad-input';
import { useAppSettings } from '@/components/shared/SettingsProvider';
import { BANKS_REGISTRY } from '@/features/banks/services/bank';
import { type CheckRecord } from '@/lib/check';
import { dateToJalaliString, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

type CustomerOption = {
  id: string;
  name: string;
  customerCode?: number;
};

export default function InitialReceivedCheckModal({
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
  const { settings } = useAppSettings();
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [bankName, setBankName] = useState('');
  const [customBankMode, setCustomBankMode] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(dateToJalaliString(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
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
    void fetchCustomers();

    if (editItem) {
      setSelectedCustomerId(editItem.customer || '');
      const existingBankName = editItem.bankName || '';
      setBankName(existingBankName);
      const isKnown = BANKS_REGISTRY.some((b) => b.name === existingBankName);
      setCustomBankMode(Boolean(existingBankName && !isKnown));
      setBranchName(editItem.branchName || '');
      setCheckNumber(editItem.checkNumber || '');
      setSayadId(editItem.sayadId || '');

      const initialAmountVal =
        effectiveCurrency === 'IRT'
          ? Math.floor((editItem.amount || 0) / 10)
          : (editItem.amount || 0);
      setAmount(initialAmountVal > 0 ? String(initialAmountVal) : '');

      setIssueDate(editItem.issueDateJalali || editItem.openingBalanceDateJalali || dateToJalaliString(new Date()));
      setDueDate(editItem.dueDateJalali || '');
      setDescription(editItem.description || '');
    } else {
      setSelectedCustomerId('');
      setBankName(BANKS_REGISTRY[0]?.name || 'بانک ملی ایران');
      setCustomBankMode(false);
      setBranchName('');
      setCheckNumber('');
      setSayadId('');
      setAmount('');
      setIssueDate(dateToJalaliString(new Date()));
      setDueDate('');
      setDescription('');
    }
    setErrorMsg(null);
  }, [isOpen, editItem, effectiveCurrency, fetchCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normCheckNumber = normalizeDigits(checkNumber).trim();
    const normSayadId = normalizeDigits(sayadId).replace(/\D/g, '').trim();

    if (!selectedCustomerId) {
      setErrorMsg('انتخاب طرف‌حساب واگذارکننده چک الزامی است.');
      return;
    }

    if (!normCheckNumber && !normSayadId) {
      setErrorMsg('وارد کردن شماره چک یا شناسه صیاد الزامی است.');
      return;
    }

    if (normSayadId && normSayadId.length !== 16) {
      setErrorMsg('شناسه صیاد در صورت وارد شدن باید دقیقاً ۱۶ رقم باشد.');
      return;
    }

    const parsedAmount = parseLocalizedAmount(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('مبلغ چک باید بزرگ‌تر از صفر باشد.');
      return;
    }

    // Convert display amount to native IRR integer
    const finalAmountIRR =
      effectiveCurrency === 'IRT' ? Math.round(parsedAmount * 10) : Math.round(parsedAmount);

    if (!dueDate) {
      setErrorMsg('تاریخ سررسید چک الزامی است.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editItem?.id,
        chequeType: 'receivable',
        customer: selectedCustomerId,
        bankName: bankName.trim(),
        branchName: branchName.trim(),
        checkNumber: normCheckNumber || normSayadId,
        sayadId: normSayadId,
        amount: finalAmountIRR,
        currency: 'IRR',
        issueDateJalali: issueDate,
        openingBalanceDateJalali: issueDate,
        dueDateJalali: dueDate,
        description: description.trim(),
        status: 'pending',
      };

      const res = await fetch('/api/accounting/opening/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData?.message || 'ثبت چک دریافتی با خطا مواجه شد.');
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای غیرمنتظره رخ داد.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            dir="rtl"
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editItem ? 'ویرایش چک دریافتی اول دوره' : 'ثبت چک دریافتی اول دوره'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    موجودی اولیه اسناد دریافتنی (کدینگ حسابداری ۱۱۲۰ بدهکار / ۳۱۰۰ بستانکار)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Accounting Rule Banner */}
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300">
              <p className="flex items-center gap-1.5 font-bold">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                سند افتتاحیه دوبل: بدهکار اسناد دریافتنی (۱۱۲۰) / بستانکار سرمایه اول دوره (۳۱۰۰)
              </p>
              <p className="mt-1 text-[11px] opacity-85">
                این چک در صندوق اسناد نگهداری می‌شود و تا زمان وصول در سررسید، هیچ‌گونه تاثیری بر موجودی نقدی بانک‌ها نخواهد داشت.
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Row 1: Customer (واگذارکننده) */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  واگذارکننده چک (طرف‌حساب) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                >
                  <option value="">-- انتخاب طرف‌حساب --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customerCode ? `(کد: ${c.customerCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Drawee Bank & Branch */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      بانک صادرکننده چک
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomBankMode(!customBankMode);
                        if (!customBankMode) setBankName('');
                        else setBankName(BANKS_REGISTRY[0]?.name || '');
                      }}
                      className="text-[11px] font-bold text-amber-600 hover:underline dark:text-amber-400 cursor-pointer"
                    >
                      {customBankMode ? 'انتخاب از لیست بانک‌ها' : 'سایر بانک‌ها / دستی'}
                    </button>
                  </div>
                  {customBankMode ? (
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="نام بانک صادرکننده (مثلاً آینده، رسالت...)"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                    />
                  ) : (
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                    >
                      {BANKS_REGISTRY.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شعبه صادرکننده (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="مثال: شعبه بازار / کد ۱۲۳"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Row 3: Check Number & Sayad ID */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره سریال چک <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    placeholder="مثال: ۶۵۴۳۲۱"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شناسه صیادی (۱۶ رقم)
                  </label>
                  <SayadInput
                    value={sayadId}
                    onChange={(e) => setSayadId(e.target.value)}
                    placeholder="۱۶ رقم صیادی"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Row 4: Amount & Currency */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  مبلغ چک ({currencySuffix}) <span className="text-rose-500">*</span>
                </label>
                <PriceInput
                  value={amount}
                  onValueChange={(_parsed, raw) => setAmount(raw)}
                  placeholder={`مبلغ به ${currencySuffix}`}
                  currencySuffix={currencySuffix}
                  showWords={true}
                  className="w-full"
                />
              </div>

              {/* Row 5: Issue Date & Due Date */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ دریافت / صدور چک
                  </label>
                  <DatePicker
                    value={issueDate}
                    onValueChange={(_iso, jalali) => setIssueDate(jalali)}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ سررسید <span className="text-rose-500">*</span>
                  </label>
                  <DatePicker
                    value={dueDate}
                    onValueChange={(_iso, jalali) => setDueDate(jalali)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Row 6: Description */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  بابت / شرح چک (اختیاری)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثال: بابت مانده طلب فاکتور سال قبل"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-amber-400"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'در حال ثبت...' : editItem ? 'بروزرسانی چک' : 'ثبت چک دریافتی'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
