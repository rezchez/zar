import * as React from 'react';
import {
  type Column,
  type ColumnDef,
  type ColumnVisibilityState,
  type SortingState,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';

// Re-export TanStack Table utilities for easy access
export {
  flexRender,
  useTable,
  type Column,
  type ColumnDef,
  type ColumnVisibilityState,
  type SortingState,
};

// ─────────────────────────────────────────────────────────────
// 1. Appica TanStack Table Features Preset
// ─────────────────────────────────────────────────────────────
export const appicaTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

// ─────────────────────────────────────────────────────────────
// 2. Base Table Primitives (Backward Compatible)
// ─────────────────────────────────────────────────────────────
export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', wrapperClassName = '', ...props }, ref) => (
    <div
      className={`relative w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800/80 dark:bg-slate-900 ${wrapperClassName}`}
    >
      <table
        ref={ref}
        className={`w-full caption-bottom text-xs text-right ${className}`}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <thead
    ref={ref}
    className={`border-b border-slate-200/80 bg-slate-50/80 font-bold text-slate-600 dark:border-slate-800/80 dark:bg-slate-800/50 dark:text-slate-300 [&_tr]:border-b-0 ${className}`}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <tbody
    ref={ref}
    className={`divide-y divide-slate-100 dark:divide-slate-800/60 [&_tr:last-child]:border-0 ${className}`}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <tfoot
    ref={ref}
    className={`border-t border-slate-200/80 bg-slate-50/50 font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 [&>tr]:last:border-b-0 ${className}`}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className = '', ...props }, ref) => (
  <tr
    ref={ref}
    className={`transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800 ${className}`}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className = '', ...props }, ref) => (
  <th
    ref={ref}
    className={`h-10 px-3 py-2 text-right align-middle text-[11px] font-black text-slate-600 dark:text-slate-300 whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className = '', ...props }, ref) => (
  <td
    ref={ref}
    className={`px-3 py-2.5 align-middle text-xs whitespace-nowrap text-slate-700 dark:text-slate-300 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className = '', ...props }, ref) => (
  <caption
    ref={ref}
    className={`mt-3 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

// ─────────────────────────────────────────────────────────────
// 3. Appica Sortable Header Component
// ─────────────────────────────────────────────────────────────
export function SortableHeader({
  column,
  children,
  className = '',
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc' | string;
    toggleSorting: (desc?: boolean, isMulti?: boolean) => void;
  };
  children: React.ReactNode;
  className?: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={`group -mx-1 inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-1 py-0.5 text-right font-black transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-amber-500 dark:hover:text-white ${className}`}
    >
      <span>{children}</span>
      {sorted === 'asc' ? (
        <ArrowUp className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
      ) : (
        <ArrowUpDown className="size-3 shrink-0 text-slate-400 opacity-60 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Appica Search Box Component
// ─────────────────────────────────────────────────────────────
export function DataTableSearch({
  value,
  onChange,
  placeholder = 'جستجو در جدول...',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(value ?? '');

  React.useEffect(() => {
    setInternalValue(value ?? '');
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <Search
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={internalValue}
        onChange={(e) => {
          const nextVal = e.target.value;
          setInternalValue(nextVal);
          onChange(nextVal);
        }}
        placeholder={placeholder}
        className="h-10 w-full rounded-2xl border border-slate-200 bg-white pe-4 ps-9 text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
      {internalValue ? (
        <button
          type="button"
          onClick={() => {
            setInternalValue('');
            onChange('');
          }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Appica Columns Visibility Toggle Dropdown
// ─────────────────────────────────────────────────────────────
export function DataTableColumnToggle({
  table,
  columnLabels = {},
  className = '',
}: {
  table: any;
  columnLabels?: Record<string, string>;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const hideableColumns = table.getAllColumns().filter((col: any) => col.getCanHide());

  if (hideableColumns.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Columns3 size={15} className="text-slate-500 dark:text-slate-400" />
        <span>ستون‌ها</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="px-3 py-1.5 text-[11px] font-black text-slate-400">
              نمایش / پنهان‌سازی ستون‌ها
            </div>
            <div className="mt-1 max-h-60 space-y-0.5 overflow-y-auto">
              {hideableColumns.map((col: any) => {
                const label = columnLabels[col.id] || col.id;
                return (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={(e) => col.toggleVisibility(e.target.checked)}
                      className="size-4 rounded-md accent-amber-600"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Appica Pagination Bar
// ─────────────────────────────────────────────────────────────
export function DataTablePagination({
  table,
  pageSizeOptions = [10, 20, 30, 50],
  className = '',
}: {
  table: any;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const tableState = (typeof table.getState === 'function' ? table.getState() : table.state) || {};
  const selectedCount = table.getFilteredSelectedRowModel?.()?.rows?.length || 0;
  const totalCount = table.getFilteredRowModel?.()?.rows?.length || 0;
  const pageIndex = tableState?.pagination?.pageIndex ?? 0;
  const pageCount = table.getPageCount?.() || 1;

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-100 p-4 dark:border-slate-800/80 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
        {selectedCount > 0 ? (
          <span>
            {selectedCount.toLocaleString('fa-IR')} از {totalCount.toLocaleString('fa-IR')} ردیف انتخاب شده
          </span>
        ) : (
          <span>مجموع {totalCount.toLocaleString('fa-IR')} ردیف</span>
        )}

        {pageSizeOptions.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">تعداد در صفحه:</span>
            <select
              value={tableState?.pagination?.pageSize ?? 10}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          صفحه {(pageIndex + 1).toLocaleString('fa-IR')} از {Math.max(1, pageCount).toLocaleString('fa-IR')}
        </span>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="صفحه قبل"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="صفحه بعد"
        >
          <ChevronLeft size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Complete Appica Data Table Wrapper Component
// ─────────────────────────────────────────────────────────────
export interface AppicaDataTableProps {
  table: any;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  columnLabels?: Record<string, string>;
  searchPlaceholder?: string;
  filterSlot?: React.ReactNode;
  extraActionsSlot?: React.ReactNode;
  pageSizeOptions?: number[];
  showSearch?: boolean;
  showColumnToggle?: boolean;
  showPagination?: boolean;
  noHorizontalScroll?: boolean;
  dense?: boolean;
  className?: string;
}

export function AppicaDataTable({
  table,
  isLoading = false,
  loadingMessage = 'در حال دریافت اطلاعات...',
  emptyMessage = 'داده‌ای برای نمایش یافت نشد.',
  emptyIcon,
  columnLabels = {},
  searchPlaceholder = 'جستجو در جدول...',
  filterSlot,
  extraActionsSlot,
  pageSizeOptions = [10, 20, 30, 50],
  showSearch = true,
  showColumnToggle = true,
  showPagination = true,
  noHorizontalScroll = false,
  dense = false,
  className = '',
}: AppicaDataTableProps) {
  const tableState = (typeof table.getState === 'function' ? table.getState() : table.state) || {};
  const globalFilter = tableState.globalFilter ?? '';
  const rows = table.getRowModel?.()?.rows || [];
  const headerGroups = table.getHeaderGroups?.() || [];

  return (
    <div
      className={`overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Top Controls Toolbar */}
      {(showSearch || filterSlot || extraActionsSlot || showColumnToggle) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {showSearch && (
              <DataTableSearch
                value={globalFilter}
                onChange={(val) => table.setGlobalFilter?.(val)}
                placeholder={searchPlaceholder}
                className="w-full sm:max-w-xs"
              />
            )}
            {filterSlot}
          </div>
          <div className="flex items-center gap-2">
            {extraActionsSlot}
            {showColumnToggle && (
              <DataTableColumnToggle table={table} columnLabels={columnLabels} />
            )}
          </div>
        </div>
      )}

      {/* Table Content */}
      {isLoading ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
          <LoaderCircle size={28} className="animate-spin text-amber-500" />
          <span className="text-xs font-bold text-slate-400">{loadingMessage}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 p-8 text-center">
          {emptyIcon}
          <p className="text-xs font-black text-slate-700 dark:text-slate-300">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className={noHorizontalScroll ? 'overflow-x-hidden' : 'overflow-x-auto'}>
          <table className={`w-full text-right text-xs ${noHorizontalScroll ? 'table-auto' : ''}`}>
            <thead className="border-b border-slate-100 bg-slate-50/70 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              {headerGroups.map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => (
                    <th
                      key={header.id}
                      className={`${
                        noHorizontalScroll || dense
                          ? 'px-2.5 py-3 text-[11px]'
                          : 'px-4 py-3.5 whitespace-nowrap'
                      } text-right font-black`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.map((row: any) => {
                const isSelected = row.getIsSelected?.();
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSelected ? 'bg-amber-500/10 dark:bg-amber-500/15' : ''
                    }`}
                  >
                    {row.getVisibleCells().map((cell: any) => (
                      <td
                        key={cell.id}
                        className={`${
                          noHorizontalScroll || dense
                            ? 'px-2.5 py-2.5 text-[11.5px]'
                            : 'px-4 py-3.5 whitespace-nowrap'
                        } align-middle`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {showPagination && !isLoading && rows.length > 0 && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}

