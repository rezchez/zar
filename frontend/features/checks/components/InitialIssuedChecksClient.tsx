'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Edit3,
  Filter,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppSettings } from '@/components/shared/SettingsProvider';
import { CHEQUE_STATUS_COLORS, CHEQUE_STATUS_LABELS, type CheckRecord } from '@/lib/check';
import InitialIssuedCheckModal from './InitialIssuedCheckModal';

type ChecksSummary = {
  totalCount: number;
  totalAmount: number;
  outstandingCount: number;
  outstandingAmount: number;
  byBank: Record<string, { count: number; amount: number; outstandingCount: number; outstandingAmount: number }>;
};

export default function InitialIssuedChecksClient({
  initialChecks = [],
  initialSummary,
}: {
  initialChecks?: CheckRecord[];
  initialSummary?: ChecksSummary;
}) {
  const { formatMoney, settings } = useAppSettings();
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [checks, setChecks] = useState<CheckRecord[]>(initialChecks);
  const [summary, setSummary] = useState<ChecksSummary>(
    initialSummary || {
      totalCount: initialChecks.length,
      totalAmount: initialChecks.reduce((s, c) => s + (c.amount || 0), 0),
      outstandingCount: initialChecks.filter((c) => ['issued', 'delivered', 'pending', 'due'].includes(c.status)).length,
      outstandingAmount: initialChecks
        .filter((c) => ['issued', 'delivered', 'pending', 'due'].includes(c.status))
        .reduce((s, c) => s + (c.amount || 0), 0),
      byBank: {},
    },
  );

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CheckRecord | null>(null);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/accounting/opening/checks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.checks)) {
          setChecks(data.checks);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setErrorBanner('دریافت فهرست چک‌ها با خطا مواجه شد.');
      }
    } catch {
      setErrorBanner('دریافت فهرست چک‌ها با خطا مواجه شد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChecks();
  }, [fetchChecks]);

  // Unique bank list from checks
  const bankOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of checks) {
      if (c.bankAccount) {
        const name = (c.expand?.bankAccount as Record<string, unknown> | undefined)?.bankName as string || c.bankAccount;
        map.set(c.bankAccount, name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [checks]);

  // Filtered checks
  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      if (selectedBankFilter !== 'all' && c.bankAccount !== selectedBankFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const no = (c.checkNumber || c.sayadId || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const custName = String((c.expand?.customer as Record<string, unknown> | undefined)?.name || '').toLowerCase();
        if (!no.includes(q) && !desc.includes(q) && !custName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [checks, selectedBankFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (check: CheckRecord) => {
    setEditingItem(check);
    setModalOpen(true);
  };

  const handleDelete = async (check: CheckRecord) => {
    if (!confirm(`آیا از حذف چک افتتاحیه شماره ${check.checkNumber || check.sayadId} به مبلغ ${formatMoney(check.amount)} اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/accounting/opening/checks?id=${encodeURIComponent(check.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'حذف چک با خطا مواجه شد.');
        return;
      }
      void fetchChecks();
    } catch (err) {
      setErrorBanner('خطا در برقراری ارتباط با سرور.');
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents/initial-inventory"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="بازگشت"
          >
            <ChevronRight size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                مدیریت اسناد و موجودی
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              موجودی اولیه چک‌های صادرشده
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchChecks}
            disabled={loading}
            className="inline-flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            title="بروزرسانی"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ثبت چک صادرشده اول دوره</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="mr-auto text-xs underline cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تعداد کل چک‌های اول دوره</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <CreditCard size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">فقره</span>
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200/60 bg-amber-50/40 p-5 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">چک‌های در جریان وصول (تعهدات)</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-amber-950 dark:text-amber-200">
            {summary.outstandingCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">فقره</span>
          </p>
          <p className="mt-1 font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
            {formatMoney(summary.outstandingAmount)} {currencySuffix}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مجموع ارزش چک‌های صادرشده</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatMoney(summary.totalAmount)} <span className="text-xs font-bold">{currencySuffix}</span>
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 pr-9 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">همه حساب‌های بانکی ({checks.length})</option>
              {bankOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Filter size={14} />
            </div>
          </div>

          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شماره چک، طرف‌حساب..."
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white pr-9 pl-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={14} />
            </div>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          نمایش {filteredChecks.length.toLocaleString('fa-IR')} از {checks.length.toLocaleString('fa-IR')} چک
        </div>
      </div>

      {/* Table / List */}
      {filteredChecks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <CreditCard size={28} />
          </div>
          <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">
            هنوز چکی ثبت نشده است.
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            در صورتی که قبل از شروع کار با سامانه، چک‌هایی صادر کرده‌اید که هنوز در بانک وصول نشده‌اند، می‌توانید آن‌ها را اینجا ثبت کنید.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ثبت اولین چک صادرشده</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 pr-4 pl-2">بانک حساب</th>
                  <th className="px-3 py-3.5">شماره چک</th>
                  <th className="px-3 py-3.5">طرف‌حساب / ذینفع</th>
                  <th className="px-3 py-3.5">ثبت‌کننده</th>
                  <th className="px-3 py-3.5">مبلغ ({currencySuffix})</th>
                  <th className="px-3 py-3.5">تاریخ صدور / افتتاح</th>
                  <th className="px-3 py-3.5">تاریخ سررسید</th>
                  <th className="px-3 py-3.5">وضعیت</th>
                  <th className="py-3.5 pr-2 pl-4 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredChecks.map((check) => {
                  const bankRecord = check.expand?.bankAccount as Record<string, unknown> | undefined;
                  const customerRecord = check.expand?.customer as Record<string, unknown> | undefined;
                  const creatorRecord = (check.expand?.created_by || check.expand?.createdBy) as Record<string, unknown> | undefined;
                  const creatorDisplayName = String(
                    creatorRecord?.name ||
                    creatorRecord?.full_name ||
                    creatorRecord?.email ||
                    'نامشخص',
                  );
                  const statusColors = CHEQUE_STATUS_COLORS[check.status] || {
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                    border: 'border-slate-200',
                  };
                  const isDeletable = check.status === 'issued' || check.status === 'draft';

                  return (
                    <tr
                      key={check.id}
                      className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      {/* Bank */}
                      <td className="py-3.5 pr-4 pl-2">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Landmark size={14} />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {String(bankRecord?.bankName || 'حساب بانکی')}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {String(bankRecord?.accountNumber || '')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Check Number */}
                      <td className="px-3 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {check.checkNumber || check.sayadId}
                      </td>

                      {/* Customer / Payee */}
                      <td className="px-3 py-3.5 text-slate-700 dark:text-slate-300">
                        {String(customerRecord?.name || '—')}
                      </td>

                      {/* Creator (ثبت‌کننده) */}
                      <td className="px-3 py-3.5 text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {creatorDisplayName}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-3.5 font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatMoney(check.amount)}
                      </td>

                      {/* Issue Date */}
                      <td className="px-3 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {check.issueDateJalali || check.openingBalanceDateJalali || '—'}
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-3.5 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {check.dueDateJalali}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                        >
                          {CHEQUE_STATUS_LABELS[check.status] || check.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-2 pl-4 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(check)}
                            className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit3 size={14} />
                          </button>

                          {isDeletable && (
                            <button
                              type="button"
                              onClick={() => handleDelete(check)}
                              className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-500 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <InitialIssuedCheckModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onSuccess={() => {
          void fetchChecks();
        }}
      />
    </div>
  );
}
