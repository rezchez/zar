'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Edit2,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { dateToJalaliString } from '@/lib/jalali';
import { formatPriceWithCommas, parseLocalizedAmount } from '@/lib/money';

import type { CashFundItem } from './CashFundsListClient';

export type CashFundsListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal?: () => void;
};

export default function CashFundsListModal({
  isOpen,
  onClose,
  onOpenAddModal,
}: CashFundsListModalProps) {
  const [funds, setFunds] = useState<CashFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFund, setEditingFund] = useState<CashFundItem | null>(null);

  // Edit sub-form state
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/cash', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.funds)) {
          setFunds(data.funds);
        }
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchFunds();
      setEditingFund(null);
      setEditError('');
      setEditSuccess('');
    }
  }, [isOpen, fetchFunds]);

  function handleStartEdit(fund: CashFundItem) {
    setEditingFund(fund);
    setEditName(fund.name);
    setEditAmount(formatPriceWithCommas(fund.openingBalance));
    setEditDate(fund.openingBalanceDate || dateToJalaliString(new Date()));
    setEditDescription((fund as any).description || '');
    setEditError('');
    setEditSuccess('');
  }

  function handleCancelEdit() {
    setEditingFund(null);
    setEditError('');
    setEditSuccess('');
  }

  function handleEditAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value;
    const numericVal = parseLocalizedAmount(rawVal);
    if (numericVal === 0 && rawVal.trim() === '') {
      setEditAmount('');
    } else {
      setEditAmount(formatPriceWithCommas(numericVal));
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFund) return;
    setEditError('');
    setEditSuccess('');

    const numericAmount = parseLocalizedAmount(editAmount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setEditError('لطفاً مبلغ معتبری برای موجودی اولیه وارد کنید.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch('/api/accounting/opening/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundId: editingFund.id,
          name: editName.trim() || editingFund.name,
          amount: numericAmount,
          date: editDate.trim(),
          description: editDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ویرایش موجودی اولیه انجام نشد.');
      }

      setEditSuccess('موجودی اولیه با موفقیت ویرایش و به روز شد.');
      await fetchFunds();

      setTimeout(() => {
        setEditingFund(null);
        setEditSuccess('');
      }, 1000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'خطا در ویرایش موجودی اولیه.');
    } finally {
      setSavingEdit(false);
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
          className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cash-funds-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                <List size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h2
                  id="cash-funds-modal-title"
                  className="text-base font-extrabold text-slate-900 dark:text-white"
                >
                  فهرست و ویرایش صندوق‌های وجه نقد
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  مشاهده، تعریف و ویرایش موجودی اول دوره صندوق‌ها
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchFunds}
                disabled={loading}
                className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="به‌روزرسانی"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="بستن پنجره"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Edit Form Section if editing */}
          {editingFund ? (
            <form onSubmit={handleSaveEdit} className="my-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 dark:bg-amber-500/10">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200">
                  <Edit2 size={15} />
                  ویرایش موجودی اولیه «{editingFund.name}» ({editingFund.currencyName})
                </span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              {editError ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertCircle size={15} />
                  <span>{editError}</span>
                </div>
              ) : null}

              {editSuccess ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={15} />
                  <span>{editSuccess}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    نام صندوق
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={savingEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    تاریخ موجودی اولیه *
                  </label>
                  <input
                    type="text"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    disabled={savingEdit}
                    placeholder="1405/01/01"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    موجودی اولیه ({editingFund.currencySymbol || editingFund.currencyCode}) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editAmount}
                    onChange={handleEditAmountChange}
                    disabled={savingEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-bold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    توضیحات
                  </label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={savingEdit}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingEdit}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-black text-slate-950 shadow-sm hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* List Content */}
          <div className="mt-4 space-y-3">
            {funds.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-800/30">
                <Wallet size={32} className="text-slate-400" />
                <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  هنوز هیچ صندوقی ثبت نشده است.
                </p>
                {onOpenAddModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddModal();
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>افزودن صندوق جدید</span>
                  </button>
                ) : null}
              </div>
            ) : (
              funds.map((fund) => {
                const currencyLabel = [fund.currencySymbol, fund.currencyCode].filter(Boolean).join(' · ');
                return (
                  <div
                    key={fund.id}
                    className="relative flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <Banknote size={18} />
                        </div>
                        {/* 1. نام صندوق */}
                        <h3 className="text-xs font-black text-slate-900 dark:text-white">
                          {fund.name}
                        </h3>
                        {/* 2. ارز */}
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {fund.currencyName} {currencyLabel ? `(${currencyLabel})` : ''}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px]">
                        {/* 3. موجودی اولیه */}
                        <span className="text-slate-500 dark:text-slate-400">
                          موجودی اولیه:{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200">
                            {Number(fund.openingBalance || 0).toLocaleString('fa-IR')} {fund.currencySymbol || fund.currencyCode}
                          </strong>
                        </span>

                        {/* 4. موجودی فعلی */}
                        <span className="text-slate-500 dark:text-slate-400">
                          موجودی فعلی:{' '}
                          <strong className="font-mono text-amber-700 dark:text-amber-300">
                            {Number(fund.balance || 0).toLocaleString('fa-IR')} {fund.currencySymbol || fund.currencyCode}
                          </strong>
                        </span>

                        {/* 5. تاریخ موجودی اولیه */}
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Calendar size={12} className="text-slate-400" />
                          <span className="font-mono dir-ltr">{fund.openingBalanceDate || '—'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Action: Edit button */}
                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(fund)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-[11px] font-bold text-slate-700 transition hover:border-amber-500/50 hover:bg-amber-50 hover:text-amber-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                      >
                        <Edit2 size={13} />
                        <span>ویرایش موجودی اولیه</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            {onOpenAddModal ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddModal();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>افزودن صندوق جدید</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
