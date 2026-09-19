'use client';

import {
  AlertCircle,
  Check,
  ChevronLeft,
  Flame,
  LoaderCircle,
  PackageOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Customer } from '@/lib/customer';
import DatePicker from '@/components/ui/date-picker';
import { useToastManager } from '@/components/ui/toast';
import type { RefiningCase } from '../types';
import { REFINING_CASE_STATUS_LABELS } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import RefiningCaseDetailModal from './RefiningCaseDetailModal';
import RefiningCustomerPicker from './RefiningCustomerPicker';
import {
  AppicaDataTable,
  SortableHeader,
  appicaTableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type SortingState,
} from '@/components/ui/data-table';

const COLUMN_LABELS: Record<string, string> = {
  caseNumber: 'شماره پرونده',
  refinerName: 'ریگیر',
  date: 'تاریخ',
  status: 'وضعیت',
  totalSentWeight: 'ارسال',
  totalReceivedWeight: 'دریافت',
  remainingWeight: 'مانده',
  refiningFee: 'اجرت',
};

export default function RefiningManagementClient() {
  const { settings } = useAppSettings();
  const toast = useToastManager();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [refiners, setRefiners] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefiners, setLoadingRefiners] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRefinerFilter, setSelectedRefinerFilter] = useState<string>('all');

  // TanStack Table State (Appica Recipe)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  // New Case Modal State
  const [openNewCaseModal, setOpenNewCaseModal] = useState(false);
  const [selectedRefinerId, setSelectedRefinerId] = useState('');
  const [newCaseDate, setNewCaseDate] = useState(formatJalaliDate(new Date()));
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);

  // Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Delete Case from Table State
  const [caseToDelete, setCaseToDelete] = useState<RefiningCase | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);

  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    setDeletingCase(true);

    try {
      const res = await fetch(`/api/refining/cases/${caseToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('خطا در حذف پرونده', data.message || 'حذف پرونده ری‌گیری انجام نشد.');
        return;
      }

      toast.success('پرونده ری‌گیری با موفقیت حذف شد', `پرونده ${caseToDelete.caseNumber} و گردش‌های انبار مرتبط لغو شدند.`);
      setCaseToDelete(null);
      void fetchCases();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور هنگام حذف پرونده.');
    } finally {
      setDeletingCase(false);
    }
  };

  // Fetch Cases
  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/refining/cases');
      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در بارگذاری اطلاعات', data.message || 'امکان دریافت لیست پرونده‌ها وجود ندارد.');
        setCases([]);
        return;
      }
      setCases(data.cases || []);
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      toast.warning('طرف‌حساب نامشخص', 'لطفاً طرف‌حساب ریگیر را انتخاب کنید.');
      return;
    }

    setCreatingCase(true);

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
        toast.error('خطا در ایجاد پرونده', data.message || 'ثبت پرونده ری‌گیری با خطا مواجه شد.');
        setCreatingCase(false);
        return;
      }

      toast.success(
        'پرونده ری‌گیری با موفقیت ایجاد شد',
        `شماره پرونده: ${data.refiningCase?.caseNumber || 'جدید'}`
      );
      setOpenNewCaseModal(false);
      setSelectedRefinerId('');
      setNewCaseDesc('');
      void fetchCases();
      if (data.refiningCase?.id) {
        setSelectedCaseId(data.refiningCase.id);
      }
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setCreatingCase(false);
    }
  };

  // KPIs
  const totalSent = useMemo(() => cases.reduce((s, c) => s + c.totalSentWeight, 0), [cases]);
  const totalReceived = useMemo(() => cases.reduce((s, c) => s + c.totalReceivedWeight, 0), [cases]);
  const totalRemaining = useMemo(() => cases.reduce((s, c) => s + c.remainingWeight, 0), [cases]);
  const totalFees = useMemo(() => cases.reduce((s, c) => s + c.refiningFee, 0), [cases]);

  // TanStack Table Column Definitions (Appica Recipe)
  const columns = useMemo<ColumnDef<typeof appicaTableFeatures, RefiningCase>[]>(
    () => [
      {
        id: 'select',
        size: 34,
        header: ({ table }) => (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              ref={(input) => {
                if (input) {
                  input.indeterminate =
                    table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                }
              }}
              onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
              className="size-3.5 rounded accent-amber-600 cursor-pointer"
              aria-label="انتخاب همه ردیف‌ها"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={(e) => row.toggleSelected(e.target.checked)}
              className="size-3.5 rounded accent-amber-600 cursor-pointer"
              aria-label="انتخاب سطر"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'caseNumber',
        size: 130,
        header: ({ column }) => <SortableHeader column={column}>شماره پرونده</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono font-black text-slate-900 dark:text-white">
            <span className="truncate">{row.original.caseNumber}</span>
            {row.original.stampNumber ? (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                title="شماره انگ"
              >
                {row.original.stampNumber}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'refinerName',
        size: 130,
        header: ({ column }) => <SortableHeader column={column}>ریگیر</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block text-xs" title={row.original.refinerName}>
            {row.original.refinerName || 'ریگیر نامشخص'}
          </span>
        ),
      },
      {
        accessorKey: 'date',
        size: 85,
        header: ({ column }) => <SortableHeader column={column}>تاریخ</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
            {row.original.date || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        size: 120,
        header: ({ column }) => <SortableHeader column={column}>وضعیت</SortableHeader>,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-black ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : status === 'partially_received'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {REFINING_CASE_STATUS_LABELS[status] || status}
            </span>
          );
        },
      },
      {
        accessorKey: 'totalSentWeight',
        size: 85,
        header: ({ column }) => <SortableHeader column={column}>ارسال</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs">
            {formatWeight(row.original.totalSentWeight)} g
          </span>
        ),
      },
      {
        accessorKey: 'totalReceivedWeight',
        size: 85,
        header: ({ column }) => <SortableHeader column={column}>دریافت</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-xs">
            {formatWeight(row.original.totalReceivedWeight)} g
          </span>
        ),
      },
      {
        accessorKey: 'remainingWeight',
        size: 85,
        header: ({ column }) => <SortableHeader column={column}>مانده</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-amber-700 dark:text-amber-400 whitespace-nowrap text-xs">
            {formatWeight(row.original.remainingWeight)} g
          </span>
        ),
      },
      {
        accessorKey: 'refiningFee',
        size: 105,
        header: ({ column }) => <SortableHeader column={column}>اجرت</SortableHeader>,
        cell: ({ row }) => {
          const fee = row.original.refiningFee;
          return (
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
              {fee > 0
                ? `${(settings.baseCurrency === 'IRT' ? Math.floor(fee / 10) : fee).toLocaleString('fa-IR')} ${currencySuffix}`
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        size: 95,
        header: () => <div className="text-center">عملیات</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedCaseId(row.original.id)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-2 py-1 text-xs font-black text-amber-800 transition-all hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300"
            >
              <span>مدیریت</span>
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCaseToDelete(row.original)}
              className="inline-flex items-center justify-center size-7 rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 transition-all hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40"
              title="حذف پرونده ری‌گیری"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [settings.baseCurrency, currencySuffix],
  );

  // Filter cases by dropdowns (status & refiner)
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (selectedRefinerFilter !== 'all' && c.refinerId !== selectedRefinerFilter) return false;
      return true;
    });
  }, [cases, statusFilter, selectedRefinerFilter]);

  const table = useTable({
    features: appicaTableFeatures,
    data: filteredCases,
    columns,
    state: { sorting, columnVisibility, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

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

        <div className="flex shrink-0 items-center gap-2.5">
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
            onClick={() => setOpenNewCaseModal(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-600 px-5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500 active:scale-95"
          >
            <Plus size={16} />
            <span>پرونده ری‌گیری جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10.5px] font-bold text-slate-400">مجموع طلای ارسالی به ری‌گیری</span>
          <p className="mt-1 font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white">
            {formatWeight(totalSent)} <span className="text-[11px] font-normal text-slate-400">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-3 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">طلای شرطی دریافت شده</span>
          <p className="mt-1 font-mono text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400">
            {formatWeight(totalReceived)} <span className="text-[11px] font-normal text-emerald-600/70 dark:text-emerald-400/70">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-4 py-3 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300">مانده طلا نزد ریگیری‌ها</span>
          <p className="mt-1 font-mono text-sm sm:text-base font-black text-amber-700 dark:text-amber-400">
            {formatWeight(totalRemaining)} <span className="text-[11px] font-normal text-amber-600/70 dark:text-amber-400/70">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10.5px] font-bold text-slate-400">مجموع اجرت ری‌گیری</span>
          <p className="mt-1 font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white">
            {(settings.baseCurrency === 'IRT' ? Math.floor(totalFees / 10) : totalFees).toLocaleString('fa-IR')} <span className="text-[11px] font-normal text-slate-400">{currencySuffix}</span>
          </p>
        </div>
      </div>

      {/* Status Segmented Tabs / Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1.5 shadow-2xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/90">
        {[
          { id: 'all', label: 'همه پرونده‌ها', count: cases.length },
          { id: 'open', label: 'جدید', count: cases.filter((c) => c.status === 'open').length },
          { id: 'sent_to_refiner', label: 'ارسال به ریگیر', count: cases.filter((c) => c.status === 'sent_to_refiner').length },
          { id: 'refining', label: 'در حال ری‌گیری', count: cases.filter((c) => c.status === 'refining').length },
          { id: 'partially_received', label: 'در انتظار تعیین عیار', count: cases.filter((c) => c.status === 'partially_received').length },
          { id: 'completed', label: 'تکمیل‌شده', count: cases.filter((c) => c.status === 'completed').length },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                isActive
                  ? 'bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                    : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tab.count.toLocaleString('fa-IR')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Appica Data Table */}
      <AppicaDataTable
        table={table}
        isLoading={loading}
        loadingMessage="در حال دریافت لیست پرونده‌ها..."
        emptyMessage="پرونده ری‌گیری با این شرایط یافت نشد."
        emptyIcon={<Flame size={36} className="text-slate-300 dark:text-slate-600" />}
        columnLabels={COLUMN_LABELS}
        searchPlaceholder="جستجو در شماره پرونده، ریگیر، توضیحات..."
        noHorizontalScroll={true}
        dense={true}
        filterSlot={
          refiners.length > 0 ? (
            <div className="relative flex items-center">
              <SlidersHorizontal size={13} className="pointer-events-none absolute right-3 text-slate-500 dark:text-slate-400" />
              <select
                value={selectedRefinerFilter}
                onChange={(e) => setSelectedRefinerFilter(e.target.value)}
                className="h-10 rounded-2xl border border-slate-200 bg-slate-50/80 pr-8 pl-3.5 text-xs font-bold text-slate-800 shadow-2xs transition-all hover:border-slate-300 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  همه طرف‌حساب‌ها
                </option>
                {refiners.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      {/* New Case Modal */}
      {openNewCaseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
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
              <RefiningCustomerPicker
                customers={refiners}
                selectedCustomerId={selectedRefinerId}
                onSelectCustomer={(c) => setSelectedRefinerId(c?.id || '')}
                loading={loadingRefiners}
                label="انتخاب طرف‌حساب (ریگیر / مشتری)"
                required
              />

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
