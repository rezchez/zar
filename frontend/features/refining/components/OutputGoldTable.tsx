'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { RefiningItem } from '../types';
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
  rawWeight: 'وزن دریافتی (گرم)',
  inventoryType: 'نوع موجودی',
  purity: 'عیار',
  convertedWeight: 'معادل ۷۵۰',
  stampNumber: 'شماره انگ',
  labName: 'آزمایشگاه',
  receiptDate: 'تاریخ دریافت',
};

interface OutputGoldTableProps {
  items: RefiningItem[];
  onOpenOutputModal: () => void;
  onEditItem: (item: RefiningItem) => void;
  onDeleteItem: (item: RefiningItem) => void;
}

export default function OutputGoldTable({
  items,
  onOpenOutputModal,
  onEditItem,
  onDeleteItem,
}: OutputGoldTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const columns = useMemo<ColumnDef<typeof appicaTableFeatures, RefiningItem>[]>(
    () => [
      {
        accessorKey: 'rawWeight',
        header: ({ column }) => <SortableHeader column={column}>وزن دریافتی (گرم)</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
            {formatWeight(row.original.rawWeight)}
          </span>
        ),
      },
      {
        accessorKey: 'inventoryType',
        header: ({ column }) => <SortableHeader column={column}>نوع موجودی</SortableHeader>,
        cell: ({ row }) => {
          const isMelted = row.original.inventoryType === 'melted';
          return (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                isMelted
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {isMelted ? 'آبشده قطعی' : 'شرطی (موقت)'}
            </span>
          );
        },
      },
      {
        accessorKey: 'purity',
        header: ({ column }) => <SortableHeader column={column}>عیار</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
            {row.original.purity}
          </span>
        ),
      },
      {
        accessorKey: 'convertedWeight',
        header: ({ column }) => <SortableHeader column={column}>معادل ۷۵۰</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-300">
            {formatWeight(row.original.convertedWeight)}
          </span>
        ),
      },
      {
        accessorKey: 'stampNumber',
        header: ({ column }) => <SortableHeader column={column}>شماره انگ</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-bold">{row.original.stampNumber || '—'}</span>
        ),
      },
      {
        accessorKey: 'labName',
        header: ({ column }) => <SortableHeader column={column}>آزمایشگاه</SortableHeader>,
        cell: ({ row }) => (
          <span>{row.original.labName || '—'}</span>
        ),
      },
      {
        accessorKey: 'receiptDate',
        header: ({ column }) => <SortableHeader column={column}>تاریخ دریافت</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono">{row.original.receiptDate || '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="text-center block">عملیات</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onEditItem(row.original)}
              className="inline-flex size-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title="ویرایش وزن، عیار و مشخصات"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteItem(row.original)}
              className="inline-flex size-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
              title="حذف ردیف دریافتی"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onEditItem, onDeleteItem]
  );

  const table = useTable({
    features: appicaTableFeatures,
    data: items,
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
        searchPlaceholder="جستجو در طلای دریافتی..."
        emptyMessage="هنوز طلایی به عنوان دریافت شرطی برای این پرونده ثبت نشده است."
        extraActionsSlot={
          <button
            type="button"
            onClick={onOpenOutputModal}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500"
          >
            <Plus size={14} />
            <span>ثبت دریافت شرطی و پاکت ری‌گیری</span>
          </button>
        }
      />
    </div>
  );
}
