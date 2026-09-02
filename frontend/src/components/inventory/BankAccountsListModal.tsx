'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import BankLogo from '@/src/components/documents/BankLogo';
import { formatPriceWithCommas, parseLocalizedAmount } from '@/lib/money';

export type BankAccountItem = {
  id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  currency: string;
  currencyId?: string;
  currencyName?: string;
  currencySymbol?: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
  description?: string;
};

export type BankAccountsListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal?: () => void;
};

export default function BankAccountsListModal({
  isOpen,
  onClose,
  onOpenAddModal,
}: BankAccountsListModalProps) {
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Editing State
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/opening/bank', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      } else {
        setError('دریافت لیست موجودی حساب‌های بانکی انجام نشد.');
      }
    } catch {
      setError('دریافت لیست موجودی حساب‌های بانکی انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchAccounts();
      setEditingAccount(null);
      setSearchQuery('');
    }
  }, [isOpen, fetchAccounts]);

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      acc.bankName.toLowerCase().includes(q) ||
      acc.branchName.toLowerCase().includes(q) ||
      acc.accountNumber.toLowerCase().includes(q) ||
      acc.currency.toLowerCase().includes(q) ||
      (acc.currencyName && acc.currencyName.toLowerCase().includes(q))
    );
  });

  function startEditing(acc: BankAccountItem) {
    setEditingAccount(acc);
    setEditAmount(formatPriceWithCommas(acc.openingBalance));
    setEditDate(acc.openingBalanceDate || '');
    setEditDescription(acc.description || '');
    setEditError('');
    setEditSuccess('');
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (!editingAccount) return;

    setEditError('');
    setEditSuccess('');

    const numericAmount = parseLocalizedAmount(editAmount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setEditError('مبلغ معتبری وارد کنید.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch('/api/accounting/opening/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: editingAccount.id,
          amount: numericAmount,
          date: editDate.trim(),
          description: editDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ویرایش موجودی اولیه انجام نشد.');
      }

      setEditSuccess('موجودی اولیه با موفقیت بروزرسانی شد.');
      setTimeout(() => {
        setEditingAccount(null);
        void fetchAccounts();
      }, 800);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'خطا در بروزرسانی.');
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
          className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400">
                <Building2 size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  فهرست و مدیریت موجودی اولیه حساب‌های بانکی
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  مشاهده، جستجو و ویرایش تراز پایه حساب‌های بانکی
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>

          {/* Edit Inline Sub-Modal */}
          {editingAccount && (
            <div className="my-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 dark:bg-blue-500/10">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  ویرایش موجودی اولیه {editingAccount.bankName} - {editingAccount.accountNumber}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              {editError && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-500/10 p-2.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <AlertCircle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} />
                  <span>{editSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      موجودی اولیه *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editAmount}
                      onChange={handleAmountChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ ثبت *
                    </label>
                    <input
                      type="text"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right font-mono text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    توضیحات
                  </label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    disabled={savingEdit}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>ذخیره تغییرات</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search & Actions Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="جستجو در بانک، شماره حساب، ارز..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-10 pl-4 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchAccounts()}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="بروزرسانی لیست"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>بروزرسانی</span>
              </button>

              {onOpenAddModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddModal();
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500"
                >
                  <Plus size={15} />
                  <span>حساب جدید</span>
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Table / List */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
                <span className="mr-2 text-xs font-bold">در حال دریافت حساب‌ها...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                هیچ حساب بانکی یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">بانک / شعبه</th>
                      <th className="py-3 px-4">شماره حساب</th>
                      <th className="py-3 px-4">ارز</th>
                      <th className="py-3 px-4">موجودی اولیه</th>
                      <th className="py-3 px-4">موجودی فعلی</th>
                      <th className="py-3 px-4">تاریخ ثبت</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-extrabold">
                          <div className="flex items-center gap-2">
                            <BankLogo bankName={acc.bankName} size={22} />
                            <span>{acc.bankName}</span>
                            {acc.branchName ? <span className="text-[11px] text-slate-400">({acc.branchName})</span> : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold" dir="ltr">{acc.accountNumber}</td>
                        <td className="py-3 px-4 font-bold">{acc.currencySymbol || acc.currencyName || acc.currency}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatPriceWithCommas(acc.openingBalance)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {formatPriceWithCommas(acc.balance)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{acc.openingBalanceDate || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => startEditing(acc)}
                            className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="ویرایش موجودی اولیه"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
