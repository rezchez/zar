'use client';

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Flame,
  LoaderCircle,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Customer } from '@/lib/customer';
import DatePicker from '@/components/ui/date-picker';
import type { RefiningCase } from '../types';
import { REFINING_CASE_STATUS_LABELS } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import RefiningCaseDetailModal from './RefiningCaseDetailModal';

type SortField =
  | 'caseNumber'
  | 'refinerName'
  | 'date'
  | 'status'
  | 'totalSentWeight'
  | 'totalReceivedWeight'
  | 'remainingWeight'
  | 'refiningFee';

type SortOrder = 'asc' | 'desc' | null;

interface ColumnConfig {
  id: string;
  label: string;
  sortable?: boolean;
  sortField?: SortField;
  align?: 'right' | 'center' | 'left';
}

const ALL_COLUMNS: ColumnConfig[] = [
  { id: 'caseNumber', label: 'شماره پرونده', sortable: true, sortField: 'caseNumber' },
  { id: 'refinerName', label: 'ریگیر (آزمایشگاه)', sortable: true, sortField: 'refinerName' },
  { id: 'date', label: 'تاریخ ثبت', sortable: true, sortField: 'date' },
  { id: 'status', label: 'وضعیت', sortable: true, sortField: 'status' },
  { id: 'totalSentWeight', label: 'طلای ارسالی', sortable: true, sortField: 'totalSentWeight' },
  { id: 'totalReceivedWeight', label: 'طلای دریافتی', sortable: true, sortField: 'totalReceivedWeight' },
  { id: 'remainingWeight', label: 'مانده نزد ریگیر', sortable: true, sortField: 'remainingWeight' },
  { id: 'refiningFee', label: 'اجرت', sortable: true, sortField: 'refiningFee' },
  { id: 'actions', label: 'عملیات', sortable: false, align: 'center' },
];

export default function RefiningManagementClient() {
  const { settings } = useAppSettings();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [refiners, setRefiners] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefiners, setLoadingRefiners] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRefinerFilter, setSelectedRefinerFilter] = useState<string>('all');

  // Sorting State
  const [sortField, setSortField] = useState<SortField | null>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination State
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    caseNumber: true,
    refinerName: true,
    date: true,
    status: true,
    totalSentWeight: true,
    totalReceivedWeight: true,
    remainingWeight: true,
    refiningFee: true,
    actions: true,
  });
  const [openColumnsMenu, setOpenColumnsMenu] = useState(false);

  // Selection State
  const [selectedCaseIds, setSelectedCaseIds] = useState<Record<string, boolean>>({});

  // New Case Modal State
  const [openNewCaseModal, setOpenNewCaseModal] = useState(false);
  const [selectedRefinerId, setSelectedRefinerId] = useState('');
  const [newCaseDate, setNewCaseDate] = useState(formatJalaliDate(new Date()));
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Delete Case from Table State
  const [caseToDelete, setCaseToDelete] = useState<RefiningCase | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);

  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    setDeletingCase(true);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/refining/cases/${caseToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در حذف پرونده ری‌گیری.');
        return;
      }

      setCaseToDelete(null);
      void fetchCases();
    } catch {
      setErrorBanner('خطا در برقراری ارتباط با سرور.');
    } finally {
      setDeletingCase(false);
    }
  };

  // Fetch Cases
  const fetchCases = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/refining/cases');
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در دریافت لیست پرونده‌ها');
        setCases([]);
        return;
      }
      setCases(data.cases || []);
    } catch {
      setErrorBanner('خطا در برقراری ارتباط با سرور.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Refiners list
  const fetchRefiners = useCallback(async () => {
    setLoadingRefiners(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (res.ok) {
        setRefiners(data.customers || data.items || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingRefiners(false);
    }
  }, []);

  useEffect(() => {
    void fetchCases();
    void fetchRefiners();
  }, [fetchCases, fetchRefiners]);

  // Handle Create New Case
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefinerId) {
      setCreateError('لطفاً طرف‌حساب ریگیر را انتخاب کنید.');
      return;
    }

    setCreatingCase(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/refining/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refinerId: selectedRefinerId,
          date: newCaseDate,
          description: newCaseDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message || 'خطا در ایجاد پرونده ری‌گیری');
        setCreatingCase(false);
        return;
      }

      setOpenNewCaseModal(false);
      setSelectedRefinerId('');
      setNewCaseDesc('');
      void fetchCases();
      if (data.refiningCase?.id) {
        setSelectedCaseId(data.refiningCase.id);
      }
    } catch {
      setCreateError('خطا در ارتباط با سرور.');
    } finally {
      setCreatingCase(false);
    }
  };

  // Toggle sorting
  const handleSort = (field?: SortField) => {
    if (!field) return;
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // KPIs
  const totalSent = useMemo(() => cases.reduce((s, c) => s + c.totalSentWeight, 0), [cases]);
  const totalReceived = useMemo(() => cases.reduce((s, c) => s + c.totalReceivedWeight, 0), [cases]);
  const totalRemaining = useMemo(() => cases.reduce((s, c) => s + c.remainingWeight, 0), [cases]);
  const totalFees = useMemo(() => cases.reduce((s, c) => s + c.refiningFee, 0), [cases]);

  // Filtered & Sorted cases
  const filteredAndSortedCases = useMemo(() => {
    const list = cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (selectedRefinerFilter !== 'all' && c.refinerId !== selectedRefinerFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNumber = c.caseNumber.toLowerCase().includes(q);
        const matchRefiner = (c.refinerName || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        if (!matchNumber && !matchRefiner && !matchDesc) return false;
      }
      return true;
    });

    if (sortField && sortOrder) {
      list.sort((a, b) => {
        let valA: string | number = a[sortField] ?? '';
        let valB: string | number = b[sortField] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [cases, statusFilter, selectedRefinerFilter, searchQuery, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedCases.length / pageSize) || 1;
  const paginatedCases = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredAndSortedCases.slice(start, start + pageSize);
  }, [filteredAndSortedCases, pageIndex, pageSize]);

  // Reset pagination on filter change
  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, statusFilter, selectedRefinerFilter, pageSize]);

  // Selection helper
  const allCurrentPageSelected =
    paginatedCases.length > 0 && paginatedCases.every((c) => selectedCaseIds[c.id]);
  const someCurrentPageSelected =
    paginatedCases.some((c) => selectedCaseIds[c.id]) && !allCurrentPageSelected;

  const toggleSelectAllCurrentPage = () => {
    if (allCurrentPageSelected) {
      const next = { ...selectedCaseIds };
      paginatedCases.forEach((c) => delete next[c.id]);
      setSelectedCaseIds(next);
    } else {
      const next = { ...selectedCaseIds };
      paginatedCases.forEach((c) => {
        next[c.id] = true;
      });
      setSelectedCaseIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectedCount = Object.keys(selectedCaseIds).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <Flame size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                مدیریت ری‌گیری طلا
              </h1>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                ماژول تخصصی
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              مدیریت مستقل و یکپارچه پرونده‌های ری‌گیری، ارسال و دریافت طلا، کنترل پاکت‌های نمونه و صدور اسناد دوبل اجرت
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/dashboard/refining/packets"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 text-xs font-black text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <PackageOpen size={16} className="text-amber-600 dark:text-amber-400" />
            <span>پاکت‌های نزد ریگیری</span>
          </a>

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
            onClick={() => {
              setCreateError(null);
              setOpenNewCaseModal(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-600 px-5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500 active:scale-95"
          >
            <Plus size={16} />
            <span>پرونده ری‌گیری جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400">مجموع طلای ارسالی به ری‌گیری</span>
          <p className="mt-1.5 font-mono text-lg font-black text-slate-900 dark:text-white">
            {formatWeight(totalSent)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/40 p-5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">طلای خروجی دریافتی</span>
          <p className="mt-1.5 font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">
            {formatWeight(totalReceived)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200/60 bg-amber-50/40 p-5 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">مانده طلا نزد ریگیری ها</span>
          <p className="mt-1.5 font-mono text-lg font-black text-amber-700 dark:text-amber-400">
            {formatWeight(totalRemaining)} <span className="text-xs font-normal">گرم</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400">مجموع اجرت ری‌گیری</span>
          <p className="mt-1.5 font-mono text-lg font-black text-slate-900 dark:text-white">
            {totalFees.toLocaleString('fa-IR')} <span className="text-xs font-normal">{currencySuffix}</span>
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorBanner ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {/* Appica-Inspired Toolbar: Search, Filters & Columns Toggle */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Global Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در پرونده، ریگیر، توضیحات..."
              className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pr-9.5 pl-8 text-xs text-slate-800 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="open">باز / جدید</option>
            <option value="sent_to_refiner">ارسال‌شده به ریگیر</option>
            <option value="refining">در حال ری‌گیری</option>
            <option value="partially_received">دریافت بخشی از طلا</option>
            <option value="completed">تکمیل و تسویه‌شده</option>
          </select>

          {refiners.length > 0 ? (
            <select
              value={selectedRefinerFilter}
              onChange={(e) => setSelectedRefinerFilter(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <option value="all">همه طرف‌حساب‌ها</option>
              {refiners.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Right Tools: Column Visibility Dropdown & Page Size */}
        <div className="flex items-center gap-2">
          {/* Columns Visibility Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenColumnsMenu(!openColumnsMenu)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Columns3 size={15} />
              <span>ستون‌ها</span>
            </button>

            {openColumnsMenu ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpenColumnsMenu(false)}
                />
                <div className="absolute left-0 z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-3 py-1.5 text-[11px] font-black text-slate-400">
                    نمایش / عدم نمایش ستون‌ها
                  </div>
                  <div className="mt-1 space-y-1">
                    {ALL_COLUMNS.filter((col) => col.id !== 'actions').map((col) => (
                      <label
                        key={col.id}
                        className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span>{col.label}</span>
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.id] !== false}
                          onChange={(e) =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [col.id]: e.target.checked,
                            }))
                          }
                          className="size-4 rounded-md accent-amber-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Rows per page selector */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-700 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          >
            <option value={5}>۵ ردیف</option>
            <option value={10}>۱۰ ردیف</option>
            <option value={20}>۲۰ ردیف</option>
            <option value={50}>۵۰ ردیف</option>
          </select>
        </div>
      </div>

      {/* Appica Data Table Container */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <LoaderCircle size={32} className="animate-spin text-amber-500" />
            <span className="text-xs font-bold text-slate-400">در حال دریافت لیست پرونده‌ها...</span>
          </div>
        ) : filteredAndSortedCases.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Flame size={36} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
              پرونده ری‌گیری با این شرایط یافت نشد.
            </p>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setOpenNewCaseModal(true);
              }}
              className="mt-1 text-xs font-black text-amber-600 hover:text-amber-500 dark:text-amber-400"
            >
              + ثبت اولین پرونده ری‌گیری
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  {/* Row Selection Checkbox Header */}
                  <th className="w-12 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someCurrentPageSelected;
                      }}
                      onChange={toggleSelectAllCurrentPage}
                      className="size-4 rounded-md accent-amber-600 cursor-pointer"
                      title="انتخاب همه ردیف‌های این صفحه"
                    />
                  </th>

                  {ALL_COLUMNS.filter((col) => visibleColumns[col.id] !== false).map((col) => (
                    <th
                      key={col.id}
                      className={`px-4 py-3.5 select-none ${col.align === 'center' ? 'text-center' : ''}`}
                    >
                      {col.sortable && col.sortField ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.sortField)}
                          className="inline-flex items-center gap-1.5 font-black text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        >
                          <span>{col.label}</span>
                          {sortField === col.sortField ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={13} className="text-amber-600" />
                            ) : (
                              <ArrowDown size={13} className="text-amber-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedCases.map((c) => {
                  const isSelected = !!selectedCaseIds[c.id];
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30 ${
                        isSelected ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                      }`}
                    >
                      {/* Row Selection Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(c.id)}
                          className="size-4 rounded-md accent-amber-600 cursor-pointer"
                        />
                      </td>

                      {visibleColumns.caseNumber !== false && (
                        <td className="px-4 py-3.5 font-mono font-black text-slate-900 dark:text-white">
                          {c.caseNumber}
                        </td>
                      )}

                      {visibleColumns.refinerName !== false && (
                        <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                          {c.refinerName || 'ریگیر نامشخص'}
                        </td>
                      )}

                      {visibleColumns.date !== false && (
                        <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                          {c.date || '—'}
                        </td>
                      )}

                      {visibleColumns.status !== false && (
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                              c.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : c.status === 'partially_received'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {REFINING_CASE_STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                      )}

                      {visibleColumns.totalSentWeight !== false && (
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatWeight(c.totalSentWeight)} گرم
                        </td>
                      )}

                      {visibleColumns.totalReceivedWeight !== false && (
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatWeight(c.totalReceivedWeight)} گرم
                        </td>
                      )}

                      {visibleColumns.remainingWeight !== false && (
                        <td className="px-4 py-3.5 font-mono font-black text-amber-700 dark:text-amber-400">
                          {formatWeight(c.remainingWeight)} گرم
                        </td>
                      )}

                      {visibleColumns.refiningFee !== false && (
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {c.refiningFee > 0 ? `${c.refiningFee.toLocaleString('fa-IR')} ${currencySuffix}` : '—'}
                        </td>
                      )}

                      {visibleColumns.actions !== false && (
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedCaseId(c.id)}
                              className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-800 transition-all hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300"
                            >
                              <span>مدیریت</span>
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCaseToDelete(c)}
                              className="inline-flex items-center justify-center size-8 rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 transition-all hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40"
                              title="حذف پرونده ری‌گیری"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Appica-Inspired Pagination & Selection Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 p-4 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>
              نمایش{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {filteredAndSortedCases.length === 0 ? 0 : pageIndex * pageSize + 1}
              </span>{' '}
              تا{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {Math.min((pageIndex + 1) * pageSize, filteredAndSortedCases.length)}
              </span>{' '}
              از{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {filteredAndSortedCases.length}
              </span>{' '}
              پرونده
            </span>

            {selectedCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {selectedCount} مورد انتخاب شده
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              صفحه <span className="font-mono font-black text-slate-700 dark:text-slate-300">{pageIndex + 1}</span> از{' '}
              <span className="font-mono font-black text-slate-700 dark:text-slate-300">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="صفحه قبل"
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="صفحه بعد"
              >
                <ChevronLeft size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Case Modal */}
      {openNewCaseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-amber-600" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ایجاد پرونده ری‌گیری جدید
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setOpenNewCaseModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="mt-4 space-y-4">
              {createError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  {createError}
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-800 dark:text-slate-200">
                  انتخاب طرف‌حساب (ریگیر / مشتری) <span className="text-rose-500">*</span>
                </label>
                {loadingRefiners ? (
                  <div className="flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                    <LoaderCircle size={15} className="ml-2 animate-spin text-amber-500" />
                    در حال بارگذاری لیست طرف‌حساب‌ها...
                  </div>
                ) : refiners.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs font-bold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                    هیچ طرف‌حسابی در سامانه ثبت نشده است. لطفاً ابتدا از بخش طرف‌حساب‌ها اقدام به ثبت طرف‌حساب نمایید.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <select
                        value={selectedRefinerId}
                        onChange={(e) => setSelectedRefinerId(e.target.value)}
                        required
                        className="h-11 w-full appearance-none rounded-2xl border border-slate-300 bg-white px-3.5 pr-9 text-xs font-black text-slate-900 shadow-2xs transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-amber-400"
                      >
                        <option value="" className="text-slate-400 dark:text-slate-500">
                          -- انتخاب طرف‌حساب مورد نظر --
                        </option>
                        {refiners.map((r) => (
                          <option
                            key={r.id}
                            value={r.id}
                            className="py-1 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {r.name} {r.groupName ? `[${r.groupName}]` : ''} {r.customerCode ? `(کد: ${r.customerCode})` : ''}
                          </option>
                        ))}
                      </select>
                      <Users
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-800 dark:text-slate-200">
                  تاریخ ایجاد پرونده <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={newCaseDate}
                  onValueChange={(_iso, jalali) => setNewCaseDate(jalali)}
                  calendarType="shamsi"
                  format="yyyy/MM/dd"
                  placeholder="انتخاب تاریخ پرونده"
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  توضیحات و یادداشت پرونده
                </label>
                <textarea
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  rows={3}
                  placeholder="توضیحات اختیاری درباره محموله یا فرآیند ری‌گیری..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenNewCaseModal(false)}
                  disabled={creatingCase}
                  className="h-10 rounded-xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={creatingCase || !selectedRefinerId}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-600 px-5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500 disabled:opacity-50"
                >
                  {creatingCase ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  <span>ایجاد و شروع پرونده</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Case Details Modal */}
      {selectedCaseId ? (
        <RefiningCaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onUpdated={() => void fetchCases()}
        />
      ) : null}

      {/* Delete Confirmation Modal from Table */}
      {caseToDelete ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400">
                <Trash2 size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">حذف پرونده ری‌گیری</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  شماره پرونده: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{caseToDelete.caseNumber}</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs font-bold leading-relaxed text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300 space-y-1.5">
              <p>⚠️ با حذف این پرونده ری‌گیری:</p>
              <ul className="list-disc pr-4 space-y-1 text-[11px] font-medium text-rose-800 dark:text-rose-300">
                <li>تمام اقلام طلا و پاکت‌های نمونه این پرونده حذف می‌گردند.</li>
                <li>کلیه گردش‌های انبار طلا لغو و بازگردانی می‌شوند.</li>
                <li>اسناد دوبل حسابداری ثبت‌شده برای این پرونده حذف می‌گردند.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                disabled={deletingCase}
                className="h-10 rounded-2xl border px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteCase}
                disabled={deletingCase}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deletingCase ? <LoaderCircle size={14} className="animate-spin" /> : null}
                <span>تأیید و حذف قطعی</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
