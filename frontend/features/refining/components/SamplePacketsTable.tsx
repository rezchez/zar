'use client';

import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import type { RefiningSample } from '../types';
import { formatWeight } from '@/lib/weight';
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
  packetNumber: 'شماره پاکت',
  declaredWeight: 'وزن اعلام‌شده',
  receivedWeight: 'وزن دریافتی',
  weightDifference: 'افت / اختلاف',
  purity: 'عیار آزمایشگاه',
  status: 'وضعیت',
};

interface SamplePacketsTableProps {
  samples: RefiningSample[];
  onOpenSampleModal: () => void;
  onReceiveSample: (sample: RefiningSample) => void;
  onSettlePurity: (sample: RefiningSample) => void;
  onEditSample: (sample: RefiningSample) => void;
  onDeleteSample: (sample: RefiningSample) => void;
}

export default function SamplePacketsTable({
  samples,
  onOpenSampleModal,
  onReceiveSample,
  onSettlePurity,
  onEditSample,
  onDeleteSample,
}: SamplePacketsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const columns = useMemo<ColumnDef<typeof appicaTableFeatures, RefiningSample>[]>(
    () => [
      {
        accessorKey: 'packetNumber',
        header: ({ column }) => <SortableHeader column={column}>شماره پاکت</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-slate-900 dark:text-white">
            {row.original.packetNumber}
          </span>
        ),
      },
      {
        accessorKey: 'declaredWeight',
        header: ({ column }) => <SortableHeader column={column}>وزن اعلام‌شده</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
            {formatWeight(row.original.declaredWeight)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'receivedWeight',
        header: ({ column }) => <SortableHeader column={column}>وزن دریافتی</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
            {row.original.status === 'received' ? `${formatWeight(row.original.receivedWeight)} گرم` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'weightDifference',
        header: ({ column }) => <SortableHeader column={column}>افت / اختلاف</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
            {row.original.status === 'received' ? `${formatWeight(row.original.weightDifference)} گرم` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'purity',
        header: ({ column }) => <SortableHeader column={column}>عیار آزمایشگاه</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            {row.original.purity ? row.original.purity : '۷۵۰ (موقت)'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column}>وضعیت</SortableHeader>,
        cell: ({ row }) => {
          const isReceived = row.original.status === 'received';
          return (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                isReceived
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {isReceived ? 'دریافت‌شده' : 'نزد ریگیر'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-center block">عملیات</span>,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center justify-center gap-1.5">
              {s.status === 'with_refiner' ? (
                <button
                  type="button"
                  onClick={() => onReceiveSample(s)}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500"
                >
                  <Check size={12} />
                  <span>دریافت پاکت</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onSettlePurity(s)}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-amber-500"
                title="ثبت یا ویرایش عیار اعلامی آزمایشگاه و تبدیل طلای شرطی به آبشده"
              >
                <span>ثبت عیار</span>
              </button>

              <button
                type="button"
                onClick={() => onEditSample(s)}
                className="inline-flex size-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="ویرایش وزن پاکت"
              >
                <Pencil size={12} />
              </button>

              <button
                type="button"
                onClick={() => onDeleteSample(s)}
                className="inline-flex size-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
                title="حذف پاکت"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onReceiveSample, onSettlePurity, onEditSample, onDeleteSample]
  );

  const table = useTable({
    features: appicaTableFeatures,
    data: samples,
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
    <div className="space-y-4">
      <AppicaDataTable
        table={table}
        columnLabels={COLUMN_LABELS}
        searchPlaceholder="جستجو در پاکت‌های نمونه..."
        emptyMessage="هیچ پاکت نمونه‌ای برای این پرونده ثبت نشده است. هنگام ثبت دریافت طلای شرطی، شماره پاکت اعلامی ریگیر را ثبت نمایید."
        extraActionsSlot={
          <button
            type="button"
            onClick={onOpenSampleModal}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Plus size={13} />
            <span>صدور پاکت دستی جدید</span>
          </button>
        }
      />
    </div>
  );
}
