'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
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
  declaredWeight: 'وزن اعلامی',
  receivedWeight: 'وزن دریافتی',
  weightDifference: 'افت / اختلاف',
  purity: 'عیار قطعی آزمایشگاه',
  receivedDate: 'تاریخ دریافت',
  status: 'وضعیت فرآیند',
};

interface SummaryPacketsTableProps {
  samples: RefiningSample[];
}

export default function SummaryPacketsTable({ samples }: SummaryPacketsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const completedSamples = useMemo(
    () => samples.filter((s) => s.status === 'received'),
    [samples]
  );

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
        header: ({ column }) => <SortableHeader column={column}>وزن اعلامی</SortableHeader>,
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
            {formatWeight(row.original.receivedWeight)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'weightDifference',
        header: ({ column }) => <SortableHeader column={column}>افت / اختلاف</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
            {formatWeight(row.original.weightDifference)} گرم
          </span>
        ),
      },
      {
        accessorKey: 'purity',
        header: ({ column }) => <SortableHeader column={column}>عیار قطعی آزمایشگاه</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-amber-600 dark:text-amber-400">
            {row.original.purity}
          </span>
        ),
      },
      {
        accessorKey: 'receivedDate',
        header: ({ column }) => <SortableHeader column={column}>تاریخ دریافت</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-400">
            {row.original.receivedDate || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => <span>وضعیت فرآیند</span>,
        cell: () => (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Check size={11} />
            <span>تکمیل و ورود به انبار</span>
          </span>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  const table = useTable({
    features: appicaTableFeatures,
    data: completedSamples,
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
        searchPlaceholder="جستجو در پاکت‌های آزمایشگاه..."
        emptyMessage="هنوز عیارسنجی نهایی برای پاکت‌های نمونه این پرونده تکمیل نشده است."
      />
    </div>
  );
}
