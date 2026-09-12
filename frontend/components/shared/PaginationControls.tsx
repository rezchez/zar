'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import React from 'react';

export type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  itemLabel?: string;
};

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [25, 50, 100, 200],
  onPageChange,
  onPageSizeChange,
  className = '',
  itemLabel = 'مورد',
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page range around current page
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      dir="rtl"
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 ${className}`}
    >
      {/* Items Summary & Page Size */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          نمایش{' '}
          <strong className="font-bold font-mono text-slate-900 dark:text-white">
            {startItem.toLocaleString('fa-IR')}
          </strong>{' '}
          تا{' '}
          <strong className="font-bold font-mono text-slate-900 dark:text-white">
            {endItem.toLocaleString('fa-IR')}
          </strong>{' '}
          از{' '}
          <strong className="font-bold font-mono text-slate-900 dark:text-white">
            {totalItems.toLocaleString('fa-IR')}
          </strong>{' '}
          {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[11px] text-slate-400">تعداد در صفحه:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 self-center sm:self-auto">
          {/* First Page (RTL: ChevronsRight goes to first) */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="صفحه اول"
          >
            <ChevronsRight size={14} />
          </button>

          {/* Previous Page (RTL: ChevronRight goes backward) */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="صفحه قبل"
          >
            <ChevronRight size={14} />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-1">
            {pages.map((p, idx) =>
              p === '...' ? (
                <span key={`el-${idx}`} className="px-1 text-slate-400">
                  ...
                </span>
              ) : (
                <button
                  key={`pg-${p}`}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`flex size-7 items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
                    p === currentPage
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          {/* Next Page (RTL: ChevronLeft goes forward) */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="صفحه بعد"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Last Page (RTL: ChevronsLeft goes to last) */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="صفحه آخر"
          >
            <ChevronsLeft size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
