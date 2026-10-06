'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
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
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import BankLogo from '@/features/banks/components/BankLogo';
import type { CheckRecord } from '@/lib/check';
import InitialIssuedCheckModal from './InitialIssuedCheckModal';
import InitialReceivedCheckModal from './InitialReceivedCheckModal';

export type BankingChecksClientProps = {
  initialIssuedChecks?: CheckRecord[];
  initialReceivedChecks?: CheckRecord[];
  defaultTab?: 'issued' | 'received';
};

export default function BankingChecksClient({
  initialIssuedChecks = [],
  initialReceivedChecks = [],
  defaultTab = 'issued',
}: BankingChecksClientProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const baseCurrency = (settings.baseCurrency || 'IRT') as 'IRR' | 'IRT';
  const currencySuffix = baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [tab, setTab] = useState<'issued' | 'received'>(defaultTab);
  const [issuedChecks, setIssuedChecks] = useState<CheckRecord[]>(initialIssuedChecks);
  const [receivedChecks, setReceivedChecks] = useState<CheckRecord[]>(initialReceivedChecks);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modals
  const [isIssuedModalOpen, setIsIssuedModalOpen] = useState(false);
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<CheckRecord | null>(null);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const all: CheckRecord[] = Array.isArray(data.checks) ? data.checks : [];
        setIssuedChecks(all.filter((c) => c.chequeType !== 'receivable'));
        setReceivedChecks(all.filter((c) => c.chequeType === 'receivable'));
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, []);

  const currentList = tab === 'issued' ? issuedChecks : receivedChecks;

  const filteredChecks = useMemo(() => {
    let result = [...currentList];
    const q = searchQuery.trim().toLowerCase();

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (q) {
      result = result.filter((c) => {
        const matchNum = (c.checkNumber || '').toLowerCase().includes(q);
        const matchSayad = (c.sayadId || '').toLowerCase().includes(q);
        const matchBank = (c.bankName || (c.expand?.bankAccount as any)?.bankName || '').toLowerCase().includes(q);
        const matchCust = ((c.expand?.customer as any)?.name || c.customer || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        return matchNum || matchSayad || matchBank || matchCust || matchDesc;
      });
    }

    return result;
  }, [currentList, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChecks.length / pageSize));
  const paginatedChecks = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredChecks.slice(start, start + pageSize);
  }, [filteredChecks, page, pageSize, totalPages]);

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این چک اطمینان دارید؟')) return;
    try {
      const res = await fetch(`/api/checks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در حذف چک');
      }
      toast.success('چک با موفقیت حذف شد.');
      if (tab === 'issued') {
        setIssuedChecks((prev) => prev.filter((c) => c.id !== id));
      } else {
        setReceivedChecks((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف چک');
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/checks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'خطا در به‌روزرسانی وضعیت');
      }
      toast.success('وضعیت چک به‌روزرسانی شد.');
      void fetchChecks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در به‌روزرسانی وضعیت چک');
    }
  }

  function formatSayad(sayad?: string) {
    if (!sayad) return '—';
    const clean = sayad.replace(/\s+/g, '');
    if (clean.length !== 16) return clean;
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
  }

  function getStatusBadge(status?: string) {
    switch (status) {
      case 'cleared':
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 size={11} />
            پاس شده / وصول شده
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-500/15 dark:text-red-300">
            <XCircle size={11} />
            برگشت خورده
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-400">
            باطل شده
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <Clock size={11} />
            در جریان وصول
          </span>
        );
    }
  }

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
      {/* Page Header (No Back Button in Banking) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مدیریت چک‌ها</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ثبت، پیگیری و اعلام وضعیت چک‌های صادرشده و دریافتی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=2110"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی چک‌ها در درختواره کدینگ حساب‌ها"
            aria-label="مشاهده در درختواره حساب‌ها"
          >
            <FolderTree size={18} className="text-amber-500" />
          </Link>

          <button
            type="button"
            onClick={() => void fetchChecks()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            title="به‌روزرسانی لیست"
            aria-label="به‌روزرسانی لیست"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {tab === 'issued' ? (
            <button
              type="button"
              onClick={() => {
                setEditingCheck(null);
                setIsIssuedModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>ثبت چک پرداختی جدید</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingCheck(null);
                setIsReceivedModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>ثبت چک دریافتی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-fit">
          <button
            type="button"
            onClick={() => {
              setTab('issued');
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              tab === 'issued'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <CreditCard size={15} />
            <span>چک‌های پرداختی (صادرشده)</span>
            <span className="rounded-full bg-slate-950/10 px-1.5 py-0.5 text-[10px] font-black">
              {issuedChecks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('received');
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              tab === 'received'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft size={15} />
            <span>چک‌های دریافتی</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black">
              {receivedChecks.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="جستجو بر اساس شماره چک، صیاد، بانک..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-8.5 pl-3 text-xs text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-amber-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
          <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Info Banner pointing to initial inventory for opening checks */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <span>جهت ثبت یا ویرایش چک‌های اول دوره (موجودی اولیه)، به بخش تعریف موجودی اولیه مراجعه فرمایید.</span>
        </div>
        <Link
          href="/dashboard/documents/initial-inventory/checks"
          className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-xs hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400"
        >
          رفتن به موجودی اولیه چک
        </Link>
      </div>

      {/* Checks Grid / Table */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <CreditCard size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            {tab === 'issued' ? 'هنوز هیچ چک پرداختی ثبت نشده است' : 'هنوز هیچ چک دریافتی ثبت نشده است'}
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            می‌توانید با دکمه زیر اولین چک را ثبت و صیاد آن را پیگیری کنید.
          </p>
          <button
            type="button"
            onClick={() => (tab === 'issued' ? setIsIssuedModalOpen(true) : setIsReceivedModalOpen(true))}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{tab === 'issued' ? 'ثبت چک پرداختی' : 'ثبت چک دریافتی'}</span>
          </button>
        </div>
      ) : filteredChecks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          چکی با این مشخصات یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedChecks.map((chk) => (
              <article
                key={chk.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  {/* Top: Bank & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <BankLogo bankName={chk.bankName || 'بانک'} size={32} />
                      <div>
                        <strong className="block text-xs font-black text-slate-900 dark:text-white">
                          {chk.bankName || (chk.expand?.bankAccount as any)?.bankName || 'بانک'} {chk.branchName ? `(${chk.branchName})` : ''}
                        </strong>
                        <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ش.ح: {(chk.expand?.bankAccount as any)?.accountNumber || '—'}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(chk.status)}
                  </div>

                  {/* Check Details */}
                  <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شماره چک:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{chk.checkNumber || '—'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شناسه صیادی:</span>
                      <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300" dir="ltr">
                        {formatSayad(chk.sayadId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">طرف حساب:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{(chk.expand?.customer as any)?.name || chk.customer || 'عمومی'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">تاریخ سررسید:</span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{chk.dueDateJalali || chk.dueDate || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Amount & Quick Actions */}
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">مبلغ چک</span>
                    <strong className="font-mono text-sm font-black text-slate-900 dark:text-white">
                      {formatMoney(chk.amount || 0)}
                    </strong>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 flex items-center justify-between gap-1">
                    {chk.status !== 'cleared' && chk.status !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(chk.id, 'cleared')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title="اعلام وصول / پاس شدن چک"
                      >
                        <CheckCircle2 size={13} />
                        <span>پاس شد</span>
                      </button>
                    ) : null}

                    {chk.status !== 'returned' ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(chk.id, 'returned')}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                        title="اعلام برگشت چک"
                      >
                        <XCircle size={13} />
                        <span>برگشت</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleDelete(chk.id)}
                      className="mr-auto inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      title="حذف چک"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredChecks.length}
              pageSize={pageSize}
              pageSizeOptions={[12, 24, 48]}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="فقره چک"
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <InitialIssuedCheckModal
        isOpen={isIssuedModalOpen}
        onClose={() => setIsIssuedModalOpen(false)}
        onSuccess={() => void fetchChecks()}
        editItem={editingCheck}
      />

      <InitialReceivedCheckModal
        isOpen={isReceivedModalOpen}
        onClose={() => setIsReceivedModalOpen(false)}
        onSuccess={() => void fetchChecks()}
        editItem={editingCheck}
      />
    </div>
  );
}
