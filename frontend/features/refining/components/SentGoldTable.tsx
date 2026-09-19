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

const DELIVERY_KIND_LABELS: Record<string, string> = {
  melted: 'آبشده',
  miscellaneous: 'متفرقه',
  conditional: 'شرطی',
  sowaleh: 'سواله',
};

const COLUMN_LABELS: Record<string, string> = {
  inventoryType: 'نوع طلا',
  rawWeight: 'وزن (گرم)',
  purity: 'عیار',
  convertedWeight: 'معادل ۷۵۰',
  stampNumber: 'شماره انگ',
  labName: 'آزمایشگاه',
  description: 'توضیحات',
};

interface SentGoldTableProps {
  items: RefiningItem[];
  onOpenDeliverModal: () => void;
  onEditItem: (item: RefiningItem) => void;
  onDeleteItem: (item: RefiningItem) => void;
}

export default function SentGoldTable({
  items,
  onOpenDeliverModal,
  onEditItem,
  onDeleteItem,
}: SentGoldTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const columns = useMemo<ColumnDef<typeof appicaTableFeatures, RefiningItem>[]>(
    () => [
      {
        accessorKey: 'inventoryType',
        header: ({ column }) => <SortableHeader column={column}>نوع طلا</SortableHeader>,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {DELIVERY_KIND_LABELS[row.original.inventoryType] || row.original.inventoryType || 'آبشده'}
          </span>
        ),
      },
      {
        accessorKey: 'rawWeight',
        header: ({ column }) => <SortableHeader column={column}>وزن (گرم)</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-mono font-black text-slate-900 dark:text-white">
            {formatWeight(row.original.rawWeight)}
          </span>
        ),
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
          <span className="font-mono">{row.original.stampNumber || '—'}</span>
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
        accessorKey: 'description',
        header: ({ column }) => <SortableHeader column={column}>توضیحات</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-slate-500">{row.original.description || '—'}</span>
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
              title="ویرایش وزن و مشخصات"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteItem(row.original)}
              className="inline-flex size-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
              title="حذف ردیف طلا"
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
        searchPlaceholder="جستجو در طلای ارسالی..."
        emptyMessage="هنوز طلایی برای این پرونده خارج/تحویل ریگیر نشده است."
        extraActionsSlot={
          <button
            type="button"
            onClick={onOpenDeliverModal}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
          >
            <Plus size={14} />
            <span>ثبت خروج طلای جدید به ریگیر</span>
          </button>
        }
      />
    </div>
  );
}
