'use client';

import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Flame,
  LoaderCircle,
  Plus,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { Customer } from '@/lib/customer';
import type { RefiningCase } from '../types';
import { REFINING_CASE_STATUS_LABELS } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import RefiningCaseDetailModal from './RefiningCaseDetailModal';

interface RefiningTabProps {
  customer: Customer;
}

export default function RefiningTab({ customer }: RefiningTabProps) {
  const { settings } = useAppSettings();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // New Case Modal State
  const [openNewCaseModal, setOpenNewCaseModal] = useState(false);
  const [newCaseDate, setNewCaseDate] = useState(formatJalaliDate(new Date()));
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);

  // Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/refining/cases?refinerId=${customer.id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      } else {
        setErrorBanner('خطا در دریافت پرونده‌های ری‌گیری این طرف‌حساب.');
      }
    } catch {
      setErrorBanner('عدم برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCase(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/refining/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refinerId: customer.id,
          date: newCaseDate.trim(),
          description: newCaseDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در ایجاد پرونده ری‌گیری');
        setCreatingCase(false);
        return;
      }

      setOpenNewCaseModal(false);
      setNewCaseDesc('');
      void fetchCases();
      if (data.refiningCase?.id) {
        setSelectedCaseId(data.refiningCase.id);
      }
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setCreatingCase(false);
    }
  };

  const totalSent = cases.reduce((s, c) => s + c.totalSentWeight, 0);
  const totalReceived = cases.reduce((s, c) => s + c.totalReceivedWeight, 0);
  const totalRemaining = cases.reduce((s, c) => s + c.remainingWeight, 0);
  const totalFees = cases.reduce((s, c) => s + c.refiningFee, 0);

  return (
    <div className="space-y-6 pt-2">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <Flame size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              پرونده‌های ری‌گیری {customer.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              مدیریت ارسال طلا، دریافت پاکت نمونه، ثبت طلای خروجی و صدور اسناد دوبل اجرت ریگیر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchCases()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>به‌روزرسانی</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenNewCaseModal(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-600 px-5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500 active:scale-95"
          >
            <Plus size={16} />
            <span>پرونده ری‌گیری جدید</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400">مجموع طلای ارسالی</span>
          <p className="mt-1 font-mono text-base font-black text-slate-900 dark:text-white">
            {formatWeight(totalSent)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/40 p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">طلای خروجی دریافتی</span>
          <p className="mt-1 font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
            {formatWeight(totalReceived)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200/60 bg-amber-50/40 p-4 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">مانده طلا نزد این ریگیر</span>
          <p className="mt-1 font-mono text-base font-black text-amber-700 dark:text-amber-400">
            {formatWeight(totalRemaining)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400">مجموع اجرت ری‌گیری</span>
          <p className="mt-1 font-mono text-base font-black text-slate-900 dark:text-white">
            {totalFees.toLocaleString('fa-IR')} <span className="text-xs font-normal">{currencySuffix}</span>
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {/* Cases Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
            <LoaderCircle size={28} className="animate-spin text-amber-500" />
            <span className="text-xs font-bold text-slate-400">در حال دریافت پرونده‌ها...</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Flame size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
              هنوز پرونده ری‌گیری برای این طرف‌حساب ثبت نشده است.
            </p>
            <button
              type="button"
              onClick={() => setOpenNewCaseModal(true)}
              className="mt-1 text-xs font-black text-amber-600 hover:text-amber-500 dark:text-amber-400"
            >
              + ثبت اولین پرونده ری‌گیری
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <th className="px-4 py-3.5">شماره پرونده</th>
                  <th className="px-4 py-3.5">تاریخ</th>
                  <th className="px-4 py-3.5">وضعیت</th>
                  <th className="px-4 py-3.5">طلای ارسالی</th>
                  <th className="px-4 py-3.5">طلای دریافتی</th>
                  <th className="px-4 py-3.5">مانده نزد ریگیر</th>
                  <th className="px-4 py-3.5">اجرت</th>
                  <th className="px-4 py-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3.5 font-mono font-black text-slate-900 dark:text-white">
                      {c.caseNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                      {c.date || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {REFINING_CASE_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatWeight(c.totalSentWeight)} گرم
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {formatWeight(c.totalReceivedWeight)} گرم
                    </td>
                    <td className="px-4 py-3.5 font-mono font-black text-amber-700 dark:text-amber-400">
                      {formatWeight(c.remainingWeight)} گرم
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {c.refiningFee > 0 ? `${c.refiningFee.toLocaleString('fa-IR')} ${currencySuffix}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedCaseId(c.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-800 transition-all hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300"
                      >
                        <span>مدیریت پرونده</span>
                        <ChevronLeft size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Case Modal */}
      {openNewCaseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                ایجاد پرونده ری‌گیری جدید
              </h4>
              <button type="button" onClick={() => setOpenNewCaseModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
              <div>
                <label className="block font-black mb-1">طرف‌حساب ریگیر</label>
                <input
                  type="text"
                  disabled
                  value={customer.name}
                  className="h-10 w-full rounded-2xl border bg-slate-50 px-3 font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block font-black mb-1">تاریخ پرونده</label>
                <input
                  type="text"
                  required
                  value={newCaseDate}
                  onChange={(e) => setNewCaseDate(e.target.value)}
                  className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-black mb-1">توضیحات</label>
                <textarea
                  rows={3}
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder="توضیحات اختیاری پرونده"
                  className="w-full rounded-2xl border p-3 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenNewCaseModal(false)}
                  className="h-10 rounded-2xl border px-4 font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={creatingCase}
                  className="h-10 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500"
                >
                  {creatingCase ? 'در حال ثبت...' : 'ایجاد پرونده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Case Detail Modal */}
      {selectedCaseId ? (
        <RefiningCaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onUpdated={fetchCases}
        />
      ) : null}
    </div>
  );
}
