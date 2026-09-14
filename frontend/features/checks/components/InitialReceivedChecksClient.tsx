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
  FolderTree,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppSettings } from '@/components/shared/SettingsProvider';
import BankLogo from '@/features/banks/components/BankLogo';
import { CHEQUE_STATUS_COLORS, CHEQUE_STATUS_LABELS, type CheckRecord } from '@/lib/check';
import InitialReceivedCheckModal from './InitialReceivedCheckModal';
import PaginationControls from '@/components/shared/PaginationControls';

type ChecksSummary = {
  totalCount: number;
  totalAmount: number;
  outstandingCount: number;
  outstandingAmount: number;
  byBank: Record<string, { count: number; amount: number; outstandingCount: number; outstandingAmount: number; name?: string }>;
};

export default function InitialReceivedChecksClient({
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
      outstandingCount: initialChecks.filter((c) => ['pending', 'issued', 'delivered', 'due'].includes(c.status)).length,
      outstandingAmount: initialChecks
        .filter((c) => ['pending', 'issued', 'delivered', 'due'].includes(c.status))
        .reduce((s, c) => s + (c.amount || 0), 0),
      byBank: {},
    },
  );

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CheckRecord | null>(null);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const displayTotalAmount =
    effectiveCurrency === 'IRT'
      ? Math.floor((summary?.totalAmount || 0) / 10)
      : (summary?.totalAmount || 0);
  const formattedTotalDigits = displayTotalAmount.toLocaleString('fa-IR');

  const totalAmountFontSize =
    formattedTotalDigits.length > 20
      ? 'text-sm sm:text-base'
      : formattedTotalDigits.length > 15
        ? 'text-base sm:text-lg'
        : formattedTotalDigits.length > 10
          ? 'text-lg sm:text-xl'
          : 'text-xl sm:text-2xl';

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/accounting/opening/checks?type=receivable', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.checks)) {
          setChecks(data.checks);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setErrorBanner('دریافت فهرست چک‌های دریافتی با خطا مواجه شد.');
      }
    } catch {
      setErrorBanner('دریافت فهرست چک‌های دریافتی با خطا مواجه شد.');
    } finally {
      setLoading(false);
    }
  }, []);

  const [registeredBanks, setRegisteredBanks] = useState<{ id: string; name: string; iconKey: string }[]>([]);

  useEffect(() => {
    void fetchChecks();
    fetch('/api/banks/list', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.banks)) setRegisteredBanks(data.banks);
      })
      .catch(() => {});
  }, [fetchChecks]);

  // Unique bank options from checks and collection
  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of checks) {
      const bName = c.bankName || (c.expand?.bankAccount as Record<string, unknown> | undefined)?.bankName as string;
      if (bName) set.add(bName);
    }
    for (const b of registeredBanks) {
      if (b.name) set.add(b.name);
    }
    return Array.from(set).sort();
  }, [checks, registeredBanks]);

  // Filtered checks
  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      const bName = c.bankName || (c.expand?.bankAccount as Record<string, unknown> | undefined)?.bankName as string || '';
      if (selectedBankFilter !== 'all' && bName !== selectedBankFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const checkNum = (c.checkNumber || '').toLowerCase();
        const sayad = (c.sayadId || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const custName = String((c.expand?.customer as Record<string, unknown> | undefined)?.name || '').toLowerCase();
        const b = bName.toLowerCase();
        if (!checkNum.includes(q) && !sayad.includes(q) && !desc.includes(q) && !custName.includes(q) && !b.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [checks, selectedBankFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChecks.length / pageSize));
  const paginatedChecks = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredChecks.slice(start, start + pageSize);
  }, [filteredChecks, page, pageSize, totalPages]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CheckRecord) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/accounting/opening/checks?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'حذف چک با خطا مواجه شد.');
      }
      setDeletingId(null);
      await fetchChecks();
    } catch (err: any) {
      setErrorBanner(err.message || 'حذف چک انجام نشد.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
      {/* Top Breadcrumb & Page Header */}
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
              <span className="inline-flex size-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                مدیریت اسناد و موجودی
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              موجودی اولیه چک‌های دریافتی
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1120"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار اسناد دریافتنی در درختواره کدینگ حساب‌ها (۱۱۲۰)"
          >
            <FolderTree size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">مشاهده در درختواره (۱۱۲۰)</span>
          </Link>

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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white shadow-xs transition hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ثبت چک دریافتی اول دوره</span>
          </button>
        </div>
      </div>

      {/* Top Tab Switcher: Receivable (1120) vs Issued (2110) */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2 text-xs font-black text-emerald-800 transition dark:bg-emerald-500/25 dark:text-emerald-300">
          <CreditCard size={15} />
          <span>چک‌های دریافتی (۱۱۲۰)</span>
        </span>
        <Link
          href="/dashboard/documents/initial-inventory/checks"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <CreditCard size={15} />
          <span>چک‌های صادرشده (۲۱۱۰)</span>
        </Link>
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
        <div className="flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">تعداد کل چک‌های دریافتی</span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <CreditCard size={16} />
            </div>
          </div>
          <p className="mt-2 truncate font-mono text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">فقره</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/60 bg-emerald-50/40 p-5 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-emerald-800 dark:text-emerald-300">چک‌های در انتظار وصول</span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <Clock size={16} />
            </div>
          </div>
          <p className="mt-2 truncate font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {summary.outstandingCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">فقره</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">جمع ارزش اسناد دریافتنی</span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1.5 min-w-0 overflow-hidden">
            <span
              className={`font-mono font-black text-slate-900 dark:text-white tracking-tight break-all ${totalAmountFontSize}`}
              title={`${formattedTotalDigits} ${currencySuffix}`}
            >
              {formattedTotalDigits}
            </span>
            <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
              {currencySuffix}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bank Filter */}
          <div className="relative min-w-[180px]">
            <select
              value={selectedBankFilter}
              onChange={(e) => {
                setSelectedBankFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white pr-8 pl-3 text-xs font-bold text-slate-900 shadow-2xs transition-all focus:border-emerald-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
            >
              <option value="all" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">همه بانک‌های صادرکننده</option>
              {bankOptions.map((b) => (
                <option key={b} value={b} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {b}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400">
              <Filter size={14} />
            </div>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو در سریال، صیاد، طرف‌حساب، بانک..."
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white pr-9 pl-3 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400">
              <Search size={14} />
            </div>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          نمایش {filteredChecks.length.toLocaleString('fa-IR')} از {checks.length.toLocaleString('fa-IR')} چک (صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')})
        </div>
      </div>

      {/* Table / List */}
      {filteredChecks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CreditCard size={28} />
          </div>
          <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">
            هنوز چک دریافتی ثبت نشده است.
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            چک‌هایی که قبل از شروع دوره از مشتریان دریافت کرده‌اید و سررسید آن‌ها در دوره فعلی قرار دارد را می‌توانید در این بخش ثبت کنید.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-xs font-black text-white shadow-xs transition hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ثبت اولین چک دریافتی</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="w-full">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 pr-4 pl-2 font-bold w-12 text-center">#</th>
                  <th className="px-3 py-3.5">واگذارکننده (طرف‌حساب)</th>
                  <th className="px-3 py-3.5">مشخصات چک</th>
                  <th className="px-3 py-3.5">بانک صادرکننده</th>
                  <th className="px-3 py-3.5">تاریخ سررسید</th>
                  <th className="px-3 py-3.5">مبلغ ({currencySuffix})</th>
                  <th className="px-3 py-3.5">وضعیت</th>
                  <th className="py-3.5 pr-2 pl-4 text-left w-24">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {paginatedChecks.map((check, idx) => {
                  const customerRecord = check.expand?.customer as Record<string, unknown> | undefined;
                  const statusColors = CHEQUE_STATUS_COLORS[check.status] || {
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                    border: 'border-slate-200',
                  };
                  const isDeletable = ['pending', 'issued', 'draft', 'delivered'].includes(check.status);

                  return (
                    <tr
                      key={check.id}
                      className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      {/* # */}
                      <td className="py-3.5 pr-4 pl-2 font-semibold text-slate-400 text-center">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* Customer / Payer */}
                      <td className="px-3 py-3.5">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {String(customerRecord?.name || '—')}
                        </div>
                        {customerRecord?.customerCode ? (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            کد: {String(customerRecord.customerCode)}
                          </div>
                        ) : null}
                      </td>

                      {/* Check Number & Sayad ID */}
                      <td className="px-3 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>{check.checkNumber || check.sayadId || '—'}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold font-sans">
                            ۱۱۲۰
                          </span>
                        </div>
                        {check.sayadId && check.sayadId !== check.checkNumber ? (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5" title="شناسه صیادی">
                            صیاد: {check.sayadId}
                          </div>
                        ) : null}
                      </td>

                      {/* Drawee Bank & Branch */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <BankLogo bankName={check.bankName} size={28} />
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {check.bankName || 'سایر بانک‌ها'}
                            </div>
                            {check.branchName ? (
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                {check.branchName}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-3.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{check.dueDateJalali || '—'}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(check.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                        >
                          <span className="size-1 rounded-full bg-current" />
                          {CHEQUE_STATUS_LABELS[check.status] || check.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-2 pl-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(check)}
                            className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            title="ویرایش چک"
                          >
                            <Edit3 size={15} />
                          </button>

                          {isDeletable && (
                            <button
                              type="button"
                              onClick={() => setDeletingId(check.id)}
                              className="rounded-xl p-1.5 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="حذف چک"
                            >
                              <Trash2 size={15} />
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

      {/* Pagination Controls */}
      {filteredChecks.length > pageSize && (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredChecks.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="فقره چک"
        />
      )}

      {/* Modal: Create / Edit */}
      <InitialReceivedCheckModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchChecks}
        editItem={editingItem}
      />

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div
            dir="rtl"
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
              حذف چک دریافتی اول دوره
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              آیا از حذف این چک اطمینان دارید؟ با حذف چک، سند افتتاحیه دوبل متناظر آن (کد ۱۱۲۰) نیز از سیستم حذف خواهد شد.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleteLoading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white hover:bg-rose-500 cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? 'در حال حذف...' : 'تایید و حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
