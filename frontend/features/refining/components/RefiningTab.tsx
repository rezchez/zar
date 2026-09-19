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
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Customer } from '@/lib/customer';
import type { RefiningCase } from '../types';
import { REFINING_CASE_STATUS_LABELS } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import RefiningCaseDetailModal from './RefiningCaseDetailModal';
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
  date: 'تاریخ',
  status: 'وضعیت',
  totalSentWeight: 'طلای ارسالی',
  totalReceivedWeight: 'طلای دریافتی',
  remainingWeight: 'مانده نزد ریگیر',
  refiningFee: 'اجرت',
};

interface RefiningTabProps {
  customer: Customer;
}

export default function RefiningTab({ customer }: RefiningTabProps) {
  const { settings } = useAppSettings();
  const toast = useToastManager();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [loading, setLoading] = useState(true);

  // New Case Modal State
  const [openNewCaseModal, setOpenNewCaseModal] = useState(false);
  const [newCaseDate, setNewCaseDate] = useState(formatJalaliDate(new Date()));
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);

  // Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/refining/cases?refinerId=${customer.id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      } else {
        toast.error('خطا در دریافت پرونده‌ها', 'خطا در دریافت پرونده‌های ری‌گیری این طرف‌حساب.');
      }
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, [customer.id, toast]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCase(true);

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
        toast.error('خطا در ایجاد پرونده', data.message || 'ثبت پرونده ری‌گیری با خطا مواجه شد.');
        setCreatingCase(false);
        return;
      }

      toast.success(
        'پرونده ری‌گیری ایجاد شد',
        `شماره پرونده: ${data.refiningCase?.caseNumber || 'جدید'}`
      );
      setOpenNewCaseModal(false);
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

  const totalSent = cases.reduce((s, c) => s + c.totalSentWeight, 0);
  const totalReceived = cases.reduce((s, c) => s + c.totalReceivedWeight, 0);
  const totalRemaining = cases.reduce((s, c) => s + c.remainingWeight, 0);
  const totalFees = cases.reduce((s, c) => s + c.refiningFee, 0);

  const columns = useMemo<ColumnDef<typeof appicaTableFeatures, RefiningCase>[]>(
    () => [
      {
        accessorKey: 'caseNumber',
        header: ({ column }) => <SortableHeader column={column}>شماره پرونده</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-mono font-black text-slate-900 dark:text-white">
            <span>{row.original.caseNumber}</span>
            {row.original.stampNumber ? (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                title="شماره انگ"
              >
                {row.original.stampNumber}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column}>تاریخ</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-400">
            {row.original.date || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column}>وضعیت</SortableHeader>,
        cell: ({ row }) => (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {REFINING_CASE_STATUS_LABELS[row.original.status] || row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'totalSentWeight',
        header: ({ column }) => <SortableHeader column={column}>طلای ارسالی</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {formatWeight(row.original.totalSentWeight)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'totalReceivedWeight',
        header: ({ column }) => <SortableHeader column={column}>طلای دریافتی</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
            {formatWeight(row.original.totalReceivedWeight)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'remainingWeight',
        header: ({ column }) => <SortableHeader column={column}>مانده نزد ریگیر</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-amber-700 dark:text-amber-400">
            {formatWeight(row.original.remainingWeight)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'refiningFee',
        header: ({ column }) => <SortableHeader column={column}>اجرت</SortableHeader>,
        cell: ({ row }) => {
          const fee = row.original.refiningFee;
          if (!fee || fee <= 0) return <span className="text-slate-400 font-mono">—</span>;
          const displayFee = settings.baseCurrency === 'IRT' ? Math.floor(fee / 10) : fee;
          return (
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {displayFee.toLocaleString('fa-IR')} {currencySuffix}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-center block">عملیات</span>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setSelectedCaseId(row.original.id)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-800 transition-all hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300"
            >
              <span>مدیریت پرونده</span>
              <ChevronLeft size={14} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [settings.baseCurrency, currencySuffix]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const table = useTable({
    features: appicaTableFeatures,
    data: cases,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
  });

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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10.5px] font-bold text-slate-400">مجموع طلای ارسالی</span>
          <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white">
            {formatWeight(totalSent)} <span className="text-[11px] font-normal text-slate-400">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 px-3.5 py-2.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">طلای شرطی دریافت شده</span>
          <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400">
            {formatWeight(totalReceived)} <span className="text-[11px] font-normal text-emerald-600/70 dark:text-emerald-400/70">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-3.5 py-2.5 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300">مانده طلا نزد این ریگیر</span>
          <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-amber-700 dark:text-amber-400">
            {formatWeight(totalRemaining)} <span className="text-[11px] font-normal text-amber-600/70 dark:text-amber-400/70">گرم</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10.5px] font-bold text-slate-400">مجموع اجرت ری‌گیری</span>
          <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white">
            {(settings.baseCurrency === 'IRT' ? Math.floor(totalFees / 10) : totalFees).toLocaleString('fa-IR')} <span className="text-[11px] font-normal text-slate-400">{currencySuffix}</span>
          </p>
        </div>
      </div>

      {/* Appica Data Table */}
      <AppicaDataTable
        table={table}
        isLoading={loading}
        loadingMessage="در حال دریافت پرونده‌ها..."
        emptyMessage="هنوز پرونده ری‌گیری برای این طرف‌حساب ثبت نشده است."
        emptyIcon={<Flame size={32} className="text-slate-300 dark:text-slate-600" />}
        columnLabels={COLUMN_LABELS}
        searchPlaceholder="جستجو در پرونده‌های این طرف‌حساب..."
        extraActionsSlot={
          <button
            type="button"
            onClick={() => setOpenNewCaseModal(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-amber-600 px-3.5 text-xs font-black text-white hover:bg-amber-500"
          >
            <Plus size={14} />
            <span>پرونده جدید</span>
          </button>
        }
      />

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
